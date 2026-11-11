-- MentCare: Row Level Security e permissões.
-- Modelo: NEGAR POR PADRÃO. Anônimos não têm acesso a nada. Usuários logados só recebem
-- o mínimo necessário; escritas sensíveis passam por funções (ver migração 002).

alter table public.clinics enable row level security;
alter table public.profiles enable row level security;
alter table public.patient_details enable row level security;
alter table public.availability_slots enable row level security;
alter table public.appointments enable row level security;
alter table public.medical_records enable row level security;
alter table public.record_addenda enable row level security;
alter table public.ratings enable row level security;

-- Parte do zero: remove qualquer permissão herdada e concede explicitamente.
revoke all on all tables in schema public from anon, authenticated;
grant usage on schema public to authenticated;

grant select on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated;

grant select on public.patient_details to authenticated;
grant update (insurance, city) on public.patient_details to authenticated;

grant select on public.clinics to authenticated;
grant update (name, city, address, insurance, specialties, modes) on public.clinics to authenticated;

grant select, insert, delete on public.availability_slots to authenticated;

grant select on public.appointments to authenticated;
grant select on public.medical_records to authenticated;
grant select on public.record_addenda to authenticated;
grant select on public.ratings to authenticated;

-- ---------------------------------------------------------------------------
-- profiles: o próprio; todos os profissionais (para o paciente escolher quem atende);
-- pacientes que têm consulta com o profissional logado.
-- ---------------------------------------------------------------------------
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or role = 'professional'
    or exists (
      select 1 from public.appointments a
      where a.professional_id = (select auth.uid()) and a.patient_id = profiles.id
    )
  );

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- patient_details (CPF): somente o próprio titular.
-- ---------------------------------------------------------------------------
create policy patient_details_select on public.patient_details
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy patient_details_update on public.patient_details
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- clinics: clínicas aprovadas para qualquer logado; o gestor edita só a sua.
-- ---------------------------------------------------------------------------
create policy clinics_select on public.clinics
  for select to authenticated
  using (approved or id = public.auth_clinic_id());

create policy clinics_update on public.clinics
  for update to authenticated
  using (public.auth_role() = 'manager' and id = public.auth_clinic_id())
  with check (public.auth_role() = 'manager' and id = public.auth_clinic_id());

-- ---------------------------------------------------------------------------
-- availability_slots: qualquer logado vê; só o gestor da clínica do profissional altera.
-- ---------------------------------------------------------------------------
create policy availability_select on public.availability_slots
  for select to authenticated
  using (true);

create policy availability_insert on public.availability_slots
  for insert to authenticated
  with check (
    public.auth_role() = 'manager'
    and exists (
      select 1 from public.profiles p
      where p.id = professional_id
        and p.role = 'professional'
        and p.clinic_id = public.auth_clinic_id()
    )
    and public.slot_starts_at(slot_date, slot_time) > now()
    and slot_date <= public.today_br() + 90
  );

create policy availability_delete on public.availability_slots
  for delete to authenticated
  using (
    public.auth_role() = 'manager'
    and exists (
      select 1 from public.profiles p
      where p.id = professional_id
        and p.role = 'professional'
        and p.clinic_id = public.auth_clinic_id()
    )
    and not exists (
      select 1 from public.appointments a
      where a.professional_id = availability_slots.professional_id
        and a.appt_date = availability_slots.slot_date
        and a.appt_time = availability_slots.slot_time
        and a.status = 'scheduled'
    )
  );

-- ---------------------------------------------------------------------------
-- appointments: paciente (as suas), profissional (as suas), gestor (as da sua clínica).
-- Escrita só por funções (book/cancel/reschedule/save_medical_record).
-- ---------------------------------------------------------------------------
create policy appointments_select on public.appointments
  for select to authenticated
  using (
    patient_id = (select auth.uid())
    or professional_id = (select auth.uid())
    or (public.auth_role() = 'manager' and clinic_id = public.auth_clinic_id())
  );

-- ---------------------------------------------------------------------------
-- Prontuário: paciente (os seus) e profissional autor. Gestor NÃO tem acesso.
-- ---------------------------------------------------------------------------
create policy medical_records_select on public.medical_records
  for select to authenticated
  using (patient_id = (select auth.uid()) or professional_id = (select auth.uid()));

create policy record_addenda_select on public.record_addenda
  for select to authenticated
  using (
    exists (select 1 from public.medical_records r where r.id = record_addenda.record_id)
  );

-- ---------------------------------------------------------------------------
-- ratings: cada paciente vê as suas; médias por clínica via clinic_ratings().
-- ---------------------------------------------------------------------------
create policy ratings_select on public.ratings
  for select to authenticated
  using (patient_id = (select auth.uid()));
