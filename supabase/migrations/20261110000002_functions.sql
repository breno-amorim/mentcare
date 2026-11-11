-- MentCare: funções auxiliares e ações com regra de negócio no servidor.
-- Todas rodam como "security definer" com search_path vazio e só são executáveis por usuários logados.

create or replace function public.auth_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = (select auth.uid())
$$;

create or replace function public.auth_clinic_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select clinic_id from public.profiles where id = (select auth.uid())
$$;

-- Instante de início de um horário, sempre no fuso de Brasília.
create or replace function public.slot_starts_at(d date, t time)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select (d + t) at time zone 'America/Sao_Paulo'
$$;

create or replace function public.today_br()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'America/Sao_Paulo')::date
$$;

-- Todo cadastro público vira PACIENTE. Metadados do cliente nunca definem o papel.
-- Para virar profissional/gestor, a conta é promovida depois por quem tem autoridade
-- (função de servidor com service_role, ou SQL Editor pelo dono do projeto).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_name text := btrim(coalesce(m ->> 'full_name', ''));
  v_cpf text := regexp_replace(coalesce(m ->> 'cpf', ''), '\D', '', 'g');
  v_birth date;
begin
  if v_name = '' then
    v_name := split_part(new.email, '@', 1);
  end if;
  insert into public.profiles (id, role, full_name)
  values (new.id, 'patient', left(v_name, 120));

  if v_cpf <> '' then
    if not public.is_valid_cpf(v_cpf) then
      raise exception 'CPF inválido';
    end if;
    begin
      v_birth := (m ->> 'birth_date')::date;
    exception when others then
      raise exception 'Data de nascimento inválida';
    end;
    if v_birth is null or v_birth > public.today_br() then
      raise exception 'Data de nascimento inválida';
    end if;
    insert into public.patient_details (user_id, cpf, birth_date, insurance, city)
    values (
      new.id,
      v_cpf,
      v_birth,
      left(coalesce(nullif(m ->> 'insurance', ''), 'Particular'), 60),
      left(coalesce(m ->> 'city', ''), 80)
    );
  end if;
  return new;
end
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Defesa extra: quem acessa como "authenticated" (cliente) nunca altera o próprio papel,
-- clínica ou especialidade por UPDATE direto. Funções de servidor (security definer), o
-- SQL Editor e a service_role rodam com outro papel e podem promover contas.
-- Esta função é SECURITY INVOKER de propósito: current_user precisa refletir quem executa.
create or replace function public.protect_profile_authority()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon')
     and (new.role is distinct from old.role
          or new.clinic_id is distinct from old.clinic_id
          or new.specialty is distinct from old.specialty
          or new.id is distinct from old.id) then
    raise exception 'Você não pode alterar papel, clínica ou especialidade.' using errcode = '42501';
  end if;
  return new;
end
$$;

create trigger profiles_protect_authority
  before update on public.profiles
  for each row execute function public.protect_profile_authority();

-- ---------------------------------------------------------------------------
-- Agendamento
-- ---------------------------------------------------------------------------
create or replace function public.book_appointment(p_professional_id uuid, p_date date, p_time time)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_patient uuid := (select auth.uid());
  v_clinic uuid;
  v_start timestamptz;
  v_id uuid;
begin
  if public.auth_role() is distinct from 'patient' then
    raise exception 'Apenas pacientes podem agendar consultas.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.patient_details where user_id = v_patient) then
    raise exception 'Complete seu cadastro (CPF) antes de agendar.';
  end if;
  select clinic_id into v_clinic
  from public.profiles where id = p_professional_id and role = 'professional';
  if v_clinic is null then
    raise exception 'Profissional não encontrado.';
  end if;
  if not exists (
    select 1 from public.availability_slots
    where professional_id = p_professional_id and slot_date = p_date and slot_time = p_time
  ) then
    raise exception 'Este horário não está disponível.';
  end if;
  v_start := public.slot_starts_at(p_date, p_time);
  if v_start <= now() or v_start > now() + interval '30 days' then
    raise exception 'Horário fora da janela de agendamento (próximos 30 dias).';
  end if;

  insert into public.appointments (patient_id, professional_id, clinic_id, appt_date, appt_time)
  values (v_patient, p_professional_id, v_clinic, p_date, p_time)
  returning id into v_id;
  return v_id;
exception when unique_violation then
  raise exception 'Este horário acabou de ser reservado. Escolha outro.' using errcode = '23505';
end
$$;

create or replace function public.cancel_appointment(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.appointments;
begin
  select * into a from public.appointments
  where id = p_id and patient_id = (select auth.uid()) and status = 'scheduled'
  for update;
  if not found then
    raise exception 'Consulta não encontrada ou não está agendada.';
  end if;
  if public.slot_starts_at(a.appt_date, a.appt_time) - now() < interval '24 hours' then
    raise exception 'Cancelamento e remarcação exigem pelo menos 24 horas de antecedência.' using errcode = 'P0001';
  end if;
  update public.appointments set status = 'cancelled' where id = a.id;
end
$$;

create or replace function public.reschedule_appointment(p_id uuid, p_date date, p_time time)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.appointments;
begin
  select * into a from public.appointments
  where id = p_id and patient_id = (select auth.uid()) and status = 'scheduled'
  for update;
  if not found then
    raise exception 'Consulta não encontrada ou não está agendada.';
  end if;
  if public.slot_starts_at(a.appt_date, a.appt_time) - now() < interval '24 hours' then
    raise exception 'Cancelamento e remarcação exigem pelo menos 24 horas de antecedência.' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.availability_slots
    where professional_id = a.professional_id and slot_date = p_date and slot_time = p_time
  ) or public.slot_starts_at(p_date, p_time) <= now() then
    raise exception 'Este horário não está disponível.';
  end if;
  update public.appointments set appt_date = p_date, appt_time = p_time where id = a.id;
exception when unique_violation then
  raise exception 'Este horário acabou de ser reservado. Escolha outro.' using errcode = '23505';
end
$$;

-- ---------------------------------------------------------------------------
-- Prontuário
-- ---------------------------------------------------------------------------
create or replace function public.save_medical_record(p_appointment_id uuid, p_content text, p_hypothesis text default '')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.appointments;
  v_id uuid;
begin
  select * into a from public.appointments
  where id = p_appointment_id and professional_id = (select auth.uid())
  for update;
  if not found then
    raise exception 'Apenas o profissional responsável pode registrar a evolução.' using errcode = '42501';
  end if;
  if a.status <> 'scheduled' then
    raise exception 'Esta consulta não está agendada.';
  end if;
  insert into public.medical_records (appointment_id, patient_id, professional_id, record_date, content, hypothesis)
  values (a.id, a.patient_id, a.professional_id, public.today_br(), p_content, left(coalesce(p_hypothesis, ''), 300))
  returning id into v_id;
  update public.appointments set status = 'completed' where id = a.id;
  return v_id;
exception when unique_violation then
  raise exception 'Esta consulta já possui registro.';
end
$$;

create or replace function public.add_addendum(p_record_id uuid, p_content text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not exists (
    select 1 from public.medical_records
    where id = p_record_id and professional_id = (select auth.uid())
  ) then
    raise exception 'Registro não encontrado.' using errcode = '42501';
  end if;
  insert into public.record_addenda (record_id, professional_id, content)
  values (p_record_id, (select auth.uid()), p_content)
  returning id into v_id;
  return v_id;
end
$$;

-- ---------------------------------------------------------------------------
-- Avaliações e clínica
-- ---------------------------------------------------------------------------
create or replace function public.rate_appointment(p_appointment_id uuid, p_stars int, p_comment text default '')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.appointments;
  v_id uuid;
begin
  select * into a from public.appointments
  where id = p_appointment_id and patient_id = (select auth.uid());
  if not found then
    raise exception 'Consulta não encontrada.';
  end if;
  if a.status <> 'completed' then
    raise exception 'Somente consultas realizadas podem ser avaliadas.';
  end if;
  if p_stars is null or p_stars not between 1 and 5 then
    raise exception 'A nota deve ser de 1 a 5.';
  end if;
  insert into public.ratings (appointment_id, clinic_id, patient_id, stars, comment)
  values (a.id, a.clinic_id, a.patient_id, p_stars, left(coalesce(p_comment, ''), 500))
  returning id into v_id;
  return v_id;
exception when unique_violation then
  raise exception 'Esta consulta já foi avaliada.';
end
$$;

-- Média por clínica sem expor comentários nem identidade dos pacientes.
create or replace function public.clinic_ratings()
returns table (clinic_id uuid, avg_stars numeric, rating_count int)
language sql
stable
security definer
set search_path = ''
as $$
  select r.clinic_id, round(avg(r.stars)::numeric, 1), count(*)::int
  from public.ratings r
  group by r.clinic_id
$$;

-- Gestor sem clínica cria a sua e passa a administrá-la.
create or replace function public.create_clinic(
  p_name text, p_city text, p_address text, p_insurance text[], p_specialties text[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if public.auth_role() is distinct from 'manager' then
    raise exception 'Apenas gestores podem cadastrar clínicas.' using errcode = '42501';
  end if;
  if public.auth_clinic_id() is not null then
    raise exception 'Você já administra uma clínica.';
  end if;
  insert into public.clinics (name, city, address, insurance, specialties)
  values (btrim(p_name), btrim(p_city), btrim(p_address), coalesce(p_insurance, '{}'), p_specialties)
  returning id into v_id;
  -- Roda como dono da função (não "authenticated"), então o gatilho de proteção permite.
  update public.profiles set clinic_id = v_id where id = (select auth.uid());
  return v_id;
end
$$;

-- Profissionais da clínica do gestor, com e-mail (que fica em auth.users, fora do alcance do cliente).
create or replace function public.clinic_professionals()
returns table (id uuid, full_name text, specialty text, email text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.full_name, p.specialty, u.email::text
  from public.profiles p
  join auth.users u on u.id = p.id
  where public.auth_role() = 'manager'
    and p.role = 'professional'
    and p.clinic_id = public.auth_clinic_id()
  order by p.full_name
$$;

-- ---------------------------------------------------------------------------
-- Permissões de execução: só usuários logados; nunca anônimos.
-- ---------------------------------------------------------------------------
revoke all on function
  public.auth_role(), public.auth_clinic_id(), public.slot_starts_at(date, time), public.today_br(),
  public.handle_new_user(), public.protect_profile_authority(),
  public.book_appointment(uuid, date, time), public.cancel_appointment(uuid),
  public.reschedule_appointment(uuid, date, time), public.save_medical_record(uuid, text, text),
  public.add_addendum(uuid, text), public.rate_appointment(uuid, int, text),
  public.clinic_ratings(), public.create_clinic(text, text, text, text[], text[]),
  public.clinic_professionals()
from public, anon;

grant execute on function
  public.auth_role(), public.auth_clinic_id(), public.slot_starts_at(date, time), public.today_br(),
  public.book_appointment(uuid, date, time), public.cancel_appointment(uuid),
  public.reschedule_appointment(uuid, date, time), public.save_medical_record(uuid, text, text),
  public.add_addendum(uuid, text), public.rate_appointment(uuid, int, text),
  public.clinic_ratings(), public.create_clinic(text, text, text, text[], text[]),
  public.clinic_professionals()
to authenticated;

-- Funções de gatilho nunca devem ser chamadas pelo cliente.
revoke all on function public.forbid_modification() from public, anon, authenticated;
revoke all on function public.handle_new_user() from authenticated;
revoke all on function public.protect_profile_authority() from authenticated;
