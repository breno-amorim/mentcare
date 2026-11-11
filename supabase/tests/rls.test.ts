// @vitest-environment node
//
// Testa as migrações SQL e as políticas RLS num Postgres real (PGlite, em WebAssembly).
// O schema "auth" e as roles do Supabase são simulados no bootstrap abaixo.
import { PGlite } from '@electric-sql/pglite'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const MIGRATIONS = join(import.meta.dirname, '..', 'migrations')

const CLINIC_A = '00000000-0000-0000-0000-00000000000a'
const CLINIC_B = '00000000-0000-0000-0000-00000000000b'
const P1 = '10000000-0000-0000-0000-000000000001' // paciente 1
const P2 = '10000000-0000-0000-0000-000000000002' // paciente 2
const DOC_A = '20000000-0000-0000-0000-00000000000a' // profissional da clínica A
const DOC_B = '20000000-0000-0000-0000-00000000000b' // profissional da clínica B
const MAN_A = '30000000-0000-0000-0000-00000000000a' // gestor da clínica A
const MAN_B = '30000000-0000-0000-0000-00000000000b' // gestor da clínica B
const NEW_MAN = '30000000-0000-0000-0000-0000000000cc' // gestor sem clínica

const BOOTSTRAP = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    raw_user_meta_data jsonb,
    raw_app_meta_data jsonb
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
`

let db: PGlite
let d2: string
let d3: string
let d4: string

const q = async <T = Record<string, unknown>>(text: string, params: unknown[] = []) =>
  (await db.query<T>(text, params)).rows

/** Executa `run` como um usuário logado (ou anônimo), aplicando RLS e permissões reais. */
async function as<T>(user: string | 'anon', run: () => Promise<T>): Promise<T> {
  if (user === 'anon') {
    await db.exec('set role anon')
  } else {
    await db.exec('set role authenticated')
    await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [user])
  }
  try {
    return await run()
  } finally {
    await db.exec('reset role')
    await db.exec(`select set_config('request.jwt.claim.sub', '', false)`)
  }
}

const rpc = (fn: string, ...args: unknown[]) =>
  q(`select public.${fn}(${args.map((_, i) => `$${i + 1}`).join(', ')}) as r`, args)

const insertAppointment = (
  patient: string,
  doc: string,
  clinic: string,
  date: string,
  time: string,
) =>
  q<{ id: string }>(
    `insert into public.appointments (patient_id, professional_id, clinic_id, appt_date, appt_time)
     values ($1, $2, $3, $4, $5) returning id`,
    [patient, doc, clinic, date, time],
  ).then((r) => r[0]!.id)

beforeAll(async () => {
  db = new PGlite()
  await db.exec(BOOTSTRAP)
  for (const file of readdirSync(MIGRATIONS).sort()) {
    await db.exec(readFileSync(join(MIGRATIONS, file), 'utf8'))
  }
}, 120_000)

afterAll(async () => {
  await db.close()
})

beforeEach(async () => {
  await db.exec('truncate auth.users, public.clinics restart identity cascade')
  await q(
    `insert into public.clinics (id, name, city, address, specialties) values
       ($1, 'Clínica A', 'Taboão da Serra', 'Rua 1', '{Psicologia}'),
       ($2, 'Clínica B', 'São Paulo', 'Rua 2', '{Psiquiatria}')`,
    [CLINIC_A, CLINIC_B],
  )
  await q(
    `insert into auth.users (id, email, raw_user_meta_data) values
       ($1, 'p1@x.com', '{"full_name":"Paciente Um","cpf":"52998224725","birth_date":"1990-01-01"}'),
       ($2, 'p2@x.com', '{"full_name":"Paciente Dois","cpf":"39053344705","birth_date":"1991-02-02"}'),
       ($3, 'doca@x.com', '{"full_name":"Dra A"}'),
       ($4, 'docb@x.com', '{"full_name":"Dr B"}'),
       ($5, 'mana@x.com', '{"full_name":"Gestor A"}'),
       ($6, 'manb@x.com', '{"full_name":"Gestor B"}'),
       ($7, 'new@x.com', '{"full_name":"Gestor Novo"}')`,
    [P1, P2, DOC_A, DOC_B, MAN_A, MAN_B, NEW_MAN],
  )
  // Promoção feita por quem tem autoridade (aqui: o dono do banco, como no SQL Editor).
  await q(
    `update public.profiles set role = 'professional', clinic_id = $2, specialty = 'Psicologia' where id = $1`,
    [DOC_A, CLINIC_A],
  )
  await q(
    `update public.profiles set role = 'professional', clinic_id = $2, specialty = 'Psiquiatria' where id = $1`,
    [DOC_B, CLINIC_B],
  )
  await q(`update public.profiles set role = 'manager', clinic_id = $2 where id = $1`, [
    MAN_A,
    CLINIC_A,
  ])
  await q(`update public.profiles set role = 'manager', clinic_id = $2 where id = $1`, [
    MAN_B,
    CLINIC_B,
  ])
  await q(`update public.profiles set role = 'manager' where id = $1`, [NEW_MAN])

  const [days] = await q<{ d2: string; d3: string; d4: string }>(
    `select (public.today_br() + 2)::text d2, (public.today_br() + 3)::text d3, (public.today_br() + 4)::text d4`,
  )
  ;({ d2, d3, d4 } = days!)
  await q(
    `insert into public.availability_slots (professional_id, slot_date, slot_time) values
       ($1, $3, '10:00'), ($1, $4, '10:00'), ($1, $5, '10:00'), ($2, $3, '11:00')`,
    [DOC_A, DOC_B, d2, d3, d4],
  )
})

describe('anônimo não acessa nada', () => {
  it.each([
    'profiles',
    'patient_details',
    'clinics',
    'appointments',
    'medical_records',
    'availability_slots',
  ])('select em %s é negado', async (table) => {
    await expect(as('anon', () => q(`select * from public.${table}`))).rejects.toThrow(
      /permission denied/,
    )
  })
  it('não executa funções de negócio', async () => {
    await expect(as('anon', () => rpc('book_appointment', DOC_A, d2, '10:00'))).rejects.toThrow(
      /permission denied/,
    )
  })
})

describe('cadastro e escalonamento de privilégio', () => {
  it('todo cadastro público vira paciente, mesmo pedindo outro papel nos metadados', async () => {
    await q(
      `insert into auth.users (id, email, raw_user_meta_data) values
         ('40000000-0000-0000-0000-000000000001', 'hacker@x.com',
          '{"role":"manager","full_name":"Hacker","cpf":"11144477735","birth_date":"1990-01-01"}')`,
    )
    const [p] = await q<{ role: string }>(
      `select role from public.profiles where id = '40000000-0000-0000-0000-000000000001'`,
    )
    expect(p?.role).toBe('patient')
  })
  it('rejeita CPF inválido no cadastro', async () => {
    await expect(
      q(
        `insert into auth.users (id, email, raw_user_meta_data) values
           ('40000000-0000-0000-0000-000000000002', 'x@x.com',
            '{"full_name":"X","cpf":"11111111111","birth_date":"1990-01-01"}')`,
      ),
    ).rejects.toThrow(/CPF/)
  })
  it('paciente não vira gestor nem se vincula a uma clínica', async () => {
    await expect(
      as(P1, () => q(`update public.profiles set role = 'manager' where id = $1`, [P1])),
    ).rejects.toThrow(/permission denied/)
    await expect(
      as(P1, () => q(`update public.profiles set clinic_id = $2 where id = $1`, [P1, CLINIC_A])),
    ).rejects.toThrow(/permission denied/)
  })
  it('profissional também não muda o próprio papel ou clínica', async () => {
    await expect(
      as(DOC_A, () =>
        q(`update public.profiles set clinic_id = $2 where id = $1`, [DOC_A, CLINIC_B]),
      ),
    ).rejects.toThrow(/permission denied/)
  })
  it('usuário altera apenas o próprio nome', async () => {
    await as(P1, () => q(`update public.profiles set full_name = 'Novo Nome' where id = $1`, [P1]))
    const rows = await as(P1, () =>
      q(`update public.profiles set full_name = 'Invasor' where id = $1 returning id`, [P2]),
    )
    expect(rows).toHaveLength(0)
  })
})

describe('dados sensíveis (CPF)', () => {
  it('só o titular lê o próprio CPF', async () => {
    expect(await as(P1, () => q(`select cpf from public.patient_details`))).toEqual([
      { cpf: '52998224725' },
    ])
    expect(await as(DOC_A, () => q(`select * from public.patient_details`))).toHaveLength(0)
    expect(await as(MAN_A, () => q(`select * from public.patient_details`))).toHaveLength(0)
  })
})

describe('visibilidade de perfis', () => {
  it('paciente vê profissionais, mas não outros pacientes', async () => {
    const ids = (await as(P1, () => q<{ id: string }>(`select id from public.profiles`))).map(
      (r) => r.id,
    )
    expect(ids).toContain(DOC_A)
    expect(ids).toContain(P1)
    expect(ids).not.toContain(P2)
    expect(ids).not.toContain(MAN_A)
  })
  it('profissional só vê pacientes que atende', async () => {
    await insertAppointment(P1, DOC_A, CLINIC_A, d4, '10:00')
    const ids = (await as(DOC_A, () => q<{ id: string }>(`select id from public.profiles`))).map(
      (r) => r.id,
    )
    expect(ids).toContain(P1)
    expect(ids).not.toContain(P2)
  })
})

describe('agendamento', () => {
  it('paciente agenda; o mesmo horário não pode ser reservado duas vezes', async () => {
    await as(P1, () => rpc('book_appointment', DOC_A, d2, '10:00'))
    await expect(as(P2, () => rpc('book_appointment', DOC_A, d2, '10:00'))).rejects.toThrow(
      /reservado/,
    )
  })
  it('só paciente agenda', async () => {
    await expect(as(DOC_A, () => rpc('book_appointment', DOC_A, d2, '10:00'))).rejects.toThrow(
      /Apenas pacientes/,
    )
    await expect(as(MAN_A, () => rpc('book_appointment', DOC_A, d2, '10:00'))).rejects.toThrow(
      /Apenas pacientes/,
    )
  })
  it('recusa horário sem disponibilidade, passado ou além de 30 dias', async () => {
    await expect(as(P1, () => rpc('book_appointment', DOC_A, d2, '15:30'))).rejects.toThrow(
      /não está disponível/,
    )
    await q(
      `insert into public.availability_slots (professional_id, slot_date, slot_time) values ($1, '2020-01-01', '10:00')`,
      [DOC_A],
    )
    await expect(
      as(P1, () => rpc('book_appointment', DOC_A, '2020-01-01', '10:00')),
    ).rejects.toThrow(/fora da janela/)
    await q(
      `insert into public.availability_slots (professional_id, slot_date, slot_time) values ($1, public.today_br() + 60, '10:00')`,
      [DOC_A],
    )
    await expect(
      as(P1, async () => {
        const [r] = await q<{ d: string }>(`select (public.today_br() + 60)::text d`)
        return rpc('book_appointment', DOC_A, r!.d, '10:00')
      }),
    ).rejects.toThrow(/fora da janela/)
  })
  it('gestor vê apenas consultas da própria clínica; paciente só as suas', async () => {
    await insertAppointment(P1, DOC_A, CLINIC_A, d4, '10:00')
    expect(await as(MAN_A, () => q(`select * from public.appointments`))).toHaveLength(1)
    expect(await as(MAN_B, () => q(`select * from public.appointments`))).toHaveLength(0)
    expect(await as(P2, () => q(`select * from public.appointments`))).toHaveLength(0)
    expect(await as(DOC_B, () => q(`select * from public.appointments`))).toHaveLength(0)
  })
  it('ninguém altera consultas por UPDATE/INSERT/DELETE direto', async () => {
    const id = await insertAppointment(P1, DOC_A, CLINIC_A, d4, '10:00')
    await expect(
      as(P1, () => q(`update public.appointments set status = 'cancelled' where id = $1`, [id])),
    ).rejects.toThrow(/permission denied/)
    await expect(
      as(P1, () => q(`delete from public.appointments where id = $1`, [id])),
    ).rejects.toThrow(/permission denied/)
    await expect(
      as(P1, () =>
        q(
          `insert into public.appointments (patient_id, professional_id, clinic_id, appt_date, appt_time) values ($1, $2, $3, $4, '09:00')`,
          [P1, DOC_A, CLINIC_A, d4],
        ),
      ),
    ).rejects.toThrow(/permission denied/)
  })
})

describe('regra de 24h', () => {
  const nearSlot = async () => {
    const [r] = await q<{ d: string; t: string }>(
      `select (date_trunc('minute', now() + interval '10 hours') at time zone 'America/Sao_Paulo')::date::text d,
              (date_trunc('minute', now() + interval '10 hours') at time zone 'America/Sao_Paulo')::time::text t`,
    )
    return r!
  }
  it('bloqueia cancelar e remarcar com menos de 24h', async () => {
    const { d, t } = await nearSlot()
    const id = await insertAppointment(P1, DOC_A, CLINIC_A, d, t)
    await expect(as(P1, () => rpc('cancel_appointment', id))).rejects.toThrow(/24 horas/)
    await expect(as(P1, () => rpc('reschedule_appointment', id, d3, '10:00'))).rejects.toThrow(
      /24 horas/,
    )
  })
  it('permite com 24h ou mais e libera o horário', async () => {
    const id = await insertAppointment(P1, DOC_A, CLINIC_A, d4, '10:00')
    await as(P1, () => rpc('reschedule_appointment', id, d3, '10:00'))
    expect(
      await q(`select appt_date::text d from public.appointments where id = $1`, [id]),
    ).toEqual([{ d: d3 }])
    await as(P1, () => rpc('cancel_appointment', id))
    await as(P2, () => rpc('book_appointment', DOC_A, d3, '10:00')) // horário voltou a ficar livre
  })
  it('outro paciente não cancela a consulta alheia', async () => {
    const id = await insertAppointment(P1, DOC_A, CLINIC_A, d4, '10:00')
    await expect(as(P2, () => rpc('cancel_appointment', id))).rejects.toThrow(/não encontrada/)
  })
})

describe('prontuário', () => {
  it('só o profissional responsável registra; consulta vira realizada; sem duplicar', async () => {
    const id = await insertAppointment(P1, DOC_A, CLINIC_A, d4, '10:00')
    await expect(as(DOC_B, () => rpc('save_medical_record', id, 'texto', ''))).rejects.toThrow(
      /profissional responsável/,
    )
    await expect(as(P1, () => rpc('save_medical_record', id, 'texto', ''))).rejects.toThrow(
      /profissional responsável/,
    )
    await as(DOC_A, () => rpc('save_medical_record', id, 'Boa evolução', ''))
    expect(await q(`select status from public.appointments where id = $1`, [id])).toEqual([
      { status: 'completed' },
    ])
    await expect(as(DOC_A, () => rpc('save_medical_record', id, 'de novo', ''))).rejects.toThrow()
  })
  it('isola quem lê: paciente titular e profissional autor; nunca gestor ou terceiros', async () => {
    const id = await insertAppointment(P1, DOC_A, CLINIC_A, d4, '10:00')
    await as(DOC_A, () => rpc('save_medical_record', id, 'Conteúdo sigiloso', ''))
    expect(await as(P1, () => q(`select * from public.medical_records`))).toHaveLength(1)
    expect(await as(DOC_A, () => q(`select * from public.medical_records`))).toHaveLength(1)
    expect(await as(P2, () => q(`select * from public.medical_records`))).toHaveLength(0)
    expect(await as(DOC_B, () => q(`select * from public.medical_records`))).toHaveLength(0)
    expect(await as(MAN_A, () => q(`select * from public.medical_records`))).toHaveLength(0)
  })
  it('é imutável: nem o cliente nem o dono do banco alteram ou apagam', async () => {
    const id = await insertAppointment(P1, DOC_A, CLINIC_A, d4, '10:00')
    await as(DOC_A, () => rpc('save_medical_record', id, 'Original', ''))
    await expect(
      as(DOC_A, () => q(`update public.medical_records set content = 'Adulterado'`)),
    ).rejects.toThrow(/permission denied/)
    await expect(q(`update public.medical_records set content = 'Adulterado'`)).rejects.toThrow(
      /não podem ser alterados/,
    )
    await expect(q(`delete from public.medical_records`)).rejects.toThrow(/não podem ser alterados/)
  })
  it('adendo: só o autor adiciona; paciente titular lê; terceiros não', async () => {
    const id = await insertAppointment(P1, DOC_A, CLINIC_A, d4, '10:00')
    const [rec] = await as(DOC_A, () => rpc('save_medical_record', id, 'Original', ''))
    const recordId = (rec as { r: string }).r
    await expect(as(DOC_B, () => rpc('add_addendum', recordId, 'invasor'))).rejects.toThrow(
      /não encontrado/,
    )
    await expect(as(P1, () => rpc('add_addendum', recordId, 'paciente'))).rejects.toThrow(
      /não encontrado/,
    )
    await as(DOC_A, () => rpc('add_addendum', recordId, 'Complemento'))
    expect(await as(P1, () => q(`select content from public.record_addenda`))).toEqual([
      { content: 'Complemento' },
    ])
    expect(await as(P2, () => q(`select * from public.record_addenda`))).toHaveLength(0)
    expect(await as(MAN_A, () => q(`select * from public.record_addenda`))).toHaveLength(0)
    expect(await q(`select content from public.medical_records`)).toEqual([{ content: 'Original' }])
  })
})

describe('avaliação', () => {
  it('só consulta realizada, uma vez, nota de 1 a 5; média sem expor pacientes', async () => {
    const id = await insertAppointment(P1, DOC_A, CLINIC_A, d4, '10:00')
    await expect(as(P1, () => rpc('rate_appointment', id, 5, ''))).rejects.toThrow(/realizadas/)
    await as(DOC_A, () => rpc('save_medical_record', id, 'ok', ''))
    await expect(as(P1, () => rpc('rate_appointment', id, 6, ''))).rejects.toThrow(/1 a 5/)
    await expect(as(P2, () => rpc('rate_appointment', id, 5, ''))).rejects.toThrow(/não encontrada/)
    await as(P1, () => rpc('rate_appointment', id, 4, 'bom'))
    await expect(as(P1, () => rpc('rate_appointment', id, 5, ''))).rejects.toThrow(
      /já foi avaliada/,
    )
    const avg = await as(P2, () =>
      q<{ clinic_id: string; avg_stars: string }>(`select * from public.clinic_ratings()`),
    )
    expect(avg).toEqual([expect.objectContaining({ clinic_id: CLINIC_A, avg_stars: '4.0' })])
    expect(await as(P2, () => q(`select * from public.ratings`))).toHaveLength(0)
  })
})

describe('gestão da clínica', () => {
  it('gestor edita só a própria clínica e nunca o campo approved', async () => {
    await as(MAN_A, () =>
      q(`update public.clinics set name = 'Renomeada' where id = $1`, [CLINIC_A]),
    )
    const other = await as(MAN_A, () =>
      q(`update public.clinics set name = 'Invasão' where id = $1 returning id`, [CLINIC_B]),
    )
    expect(other).toHaveLength(0)
    await expect(
      as(MAN_A, () => q(`update public.clinics set approved = false where id = $1`, [CLINIC_A])),
    ).rejects.toThrow(/permission denied/)
    // Paciente: o RLS filtra (0 linhas) e o nome continua o mesmo.
    const byPatient = await as(P1, () =>
      q(`update public.clinics set name = 'x' where id = $1 returning id`, [CLINIC_A]),
    )
    expect(byPatient).toHaveLength(0)
    expect(await q(`select name from public.clinics where id = $1`, [CLINIC_A])).toEqual([
      { name: 'Renomeada' },
    ])
  })
  it('gestor cadastra horários só para profissionais da sua clínica, futuros e em até 90 dias', async () => {
    await as(MAN_A, () =>
      q(
        `insert into public.availability_slots (professional_id, slot_date, slot_time) values ($1, public.today_br() + 10, '08:00')`,
        [DOC_A],
      ),
    )
    await expect(
      as(MAN_A, () =>
        q(
          `insert into public.availability_slots (professional_id, slot_date, slot_time) values ($1, public.today_br() + 10, '08:00')`,
          [DOC_B],
        ),
      ),
    ).rejects.toThrow(/row-level security/)
    await expect(
      as(MAN_A, () =>
        q(
          `insert into public.availability_slots (professional_id, slot_date, slot_time) values ($1, '2020-01-01', '08:00')`,
          [DOC_A],
        ),
      ),
    ).rejects.toThrow(/row-level security/)
    await expect(
      as(MAN_A, () =>
        q(
          `insert into public.availability_slots (professional_id, slot_date, slot_time) values ($1, public.today_br() + 120, '08:00')`,
          [DOC_A],
        ),
      ),
    ).rejects.toThrow(/row-level security/)
    await expect(
      as(P1, () =>
        q(
          `insert into public.availability_slots (professional_id, slot_date, slot_time) values ($1, public.today_br() + 10, '09:00')`,
          [DOC_A],
        ),
      ),
    ).rejects.toThrow(/row-level security/)
  })
  it('não remove horário com consulta agendada, mas remove horário livre', async () => {
    await as(P1, () => rpc('book_appointment', DOC_A, d2, '10:00'))
    const booked = await as(MAN_A, () =>
      q(
        `delete from public.availability_slots where professional_id = $1 and slot_date = $2 returning id`,
        [DOC_A, d2],
      ),
    )
    expect(booked).toHaveLength(0)
    const free = await as(MAN_A, () =>
      q(
        `delete from public.availability_slots where professional_id = $1 and slot_date = $2 returning id`,
        [DOC_A, d3],
      ),
    )
    expect(free).toHaveLength(1)
    const foreign = await as(MAN_B, () =>
      q(
        `delete from public.availability_slots where professional_id = $1 and slot_date = $2 returning id`,
        [DOC_A, d4],
      ),
    )
    expect(foreign).toHaveLength(0)
  })
  it('gestor sem clínica cria a sua uma única vez; outros papéis não criam', async () => {
    await as(NEW_MAN, () =>
      rpc('create_clinic', 'Nova Clínica', 'Santos', 'Rua X', ['SUS'], ['Psicologia']),
    )
    expect(
      await q(`select clinic_id is not null as ok from public.profiles where id = $1`, [NEW_MAN]),
    ).toEqual([{ ok: true }])
    await expect(
      as(NEW_MAN, () => rpc('create_clinic', 'Outra', 'Santos', 'Rua Y', ['SUS'], ['Psicologia'])),
    ).rejects.toThrow(/já administra/)
    await expect(
      as(P1, () => rpc('create_clinic', 'Falsa', 'X', 'Y', [], ['Psicologia'])),
    ).rejects.toThrow(/Apenas gestores/)
  })
  it('lista profissionais com e-mail só para o gestor da clínica', async () => {
    const mine = await as(MAN_A, () =>
      q<{ email: string }>(`select * from public.clinic_professionals()`),
    )
    expect(mine.map((r) => r.email)).toEqual(['doca@x.com'])
    expect(await as(P1, () => q(`select * from public.clinic_professionals()`))).toHaveLength(0)
    expect(
      (
        await as(MAN_B, () => q<{ email: string }>(`select * from public.clinic_professionals()`))
      ).map((r) => r.email),
    ).toEqual(['docb@x.com'])
  })
})
