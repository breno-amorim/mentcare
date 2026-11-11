-- MentCare: schema inicial
-- Princípios: negar por padrão, nomes em inglês (snake_case), registros clínicos imutáveis.

create type public.user_role as enum ('patient', 'professional', 'manager');
create type public.appointment_status as enum ('scheduled', 'completed', 'cancelled');

-- Validação de CPF (dígitos verificadores). Função pura, pode ser pública.
create or replace function public.is_valid_cpf(cpf text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  d text := regexp_replace(coalesce(cpf, ''), '\D', '', 'g');
  s int;
  r int;
  i int;
begin
  if length(d) <> 11 or d ~ '^(\d)\1{10}$' then
    return false;
  end if;
  s := 0;
  for i in 1..9 loop
    s := s + substr(d, i, 1)::int * (11 - i);
  end loop;
  r := (s * 10) % 11;
  if r = 10 then r := 0; end if;
  if r <> substr(d, 10, 1)::int then
    return false;
  end if;
  s := 0;
  for i in 1..10 loop
    s := s + substr(d, i, 1)::int * (12 - i);
  end loop;
  r := (s * 10) % 11;
  if r = 10 then r := 0; end if;
  return r = substr(d, 11, 1)::int;
end
$$;

create table public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  city text not null check (char_length(city) between 1 and 80),
  address text not null check (char_length(address) between 1 and 200),
  insurance text[] not null default '{}',
  specialties text[] not null default '{}' check (cardinality(specialties) >= 1),
  modes text[] not null default '{Presencial}',
  approved boolean not null default true,
  created_at timestamptz not null default now()
);

-- Dados não sensíveis de todos os usuários. O papel (role) nunca vem do cliente.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'patient',
  full_name text not null check (char_length(full_name) between 1 and 120),
  specialty text check (specialty in ('Psicologia', 'Psiquiatria')),
  clinic_id uuid references public.clinics (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint patient_has_no_clinic check (role <> 'patient' or (clinic_id is null and specialty is null)),
  constraint professional_has_clinic check (role <> 'professional' or (clinic_id is not null and specialty is not null))
);

-- Dados sensíveis do paciente (CPF) separados: só o próprio titular lê.
create table public.patient_details (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  cpf text not null unique check (public.is_valid_cpf(cpf)),
  birth_date date not null,
  insurance text not null default 'Particular' check (char_length(insurance) <= 60),
  city text not null default '' check (char_length(city) <= 80)
);

create table public.availability_slots (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.profiles (id) on delete cascade,
  slot_date date not null,
  slot_time time not null,
  created_at timestamptz not null default now(),
  unique (professional_id, slot_date, slot_time)
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles (id),
  professional_id uuid not null references public.profiles (id),
  clinic_id uuid not null references public.clinics (id),
  appt_date date not null,
  appt_time time not null,
  status public.appointment_status not null default 'scheduled',
  created_at timestamptz not null default now()
);

-- Impede dois agendamentos no mesmo horário, mesmo com duas abas/requisições simultâneas.
create unique index appointments_professional_slot_uniq
  on public.appointments (professional_id, appt_date, appt_time)
  where status <> 'cancelled';
create unique index appointments_patient_slot_uniq
  on public.appointments (patient_id, appt_date, appt_time)
  where status = 'scheduled';
create index appointments_patient_idx on public.appointments (patient_id);
create index appointments_professional_idx on public.appointments (professional_id);
create index appointments_clinic_idx on public.appointments (clinic_id);

create table public.medical_records (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique references public.appointments (id),
  patient_id uuid not null references public.profiles (id),
  professional_id uuid not null references public.profiles (id),
  record_date date not null,
  content text not null check (char_length(btrim(content)) between 1 and 5000),
  hypothesis text not null default '' check (char_length(hypothesis) <= 300),
  created_at timestamptz not null default now()
);
create index medical_records_patient_idx on public.medical_records (patient_id);
create index medical_records_professional_idx on public.medical_records (professional_id);

create table public.record_addenda (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.medical_records (id),
  professional_id uuid not null references public.profiles (id),
  content text not null check (char_length(btrim(content)) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index record_addenda_record_idx on public.record_addenda (record_id);

create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique references public.appointments (id),
  clinic_id uuid not null references public.clinics (id),
  patient_id uuid not null references public.profiles (id),
  stars smallint not null check (stars between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 500),
  created_at timestamptz not null default now()
);
create index ratings_clinic_idx on public.ratings (clinic_id);

-- Prontuário é append-only: nem o dono do banco altera ou apaga registros clínicos por engano.
create or replace function public.forbid_modification()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Registros clínicos não podem ser alterados ou apagados.' using errcode = '42501';
end
$$;

create trigger medical_records_immutable
  before update or delete on public.medical_records
  for each row execute function public.forbid_modification();
create trigger record_addenda_immutable
  before update or delete on public.record_addenda
  for each row execute function public.forbid_modification();
