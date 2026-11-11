// @vitest-environment node
//
// T5 (servidor) · bloqueio após 3 senhas erradas via Password Verification Hook. Issue #18.
// Roda o SQL de supabase/optional num Postgres real (PGlite), com as roles do Supabase simuladas.
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const HOOK_SQL = join(import.meta.dirname, '..', 'optional', 'password_lockout_hook.sql')
const USER = '10000000-0000-0000-0000-000000000001'

let db: PGlite

/** Chama o gancho como o serviço de Auth faria (role supabase_auth_admin, sujeita a RLS). */
async function attempt(valid: boolean): Promise<{ decision: string; message?: string }> {
  await db.exec('set role supabase_auth_admin')
  try {
    const { rows } = await db.query<{ r: { decision: string; message?: string } }>(
      `select public.hook_password_verification_attempt($1::jsonb) as r`,
      [JSON.stringify({ user_id: USER, valid })],
    )
    return rows[0]!.r
  } finally {
    await db.exec('reset role')
  }
}

beforeAll(async () => {
  db = new PGlite()
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role supabase_auth_admin nologin;
    create schema auth;
    create table auth.users (id uuid primary key);
  `)
  await db.exec(readFileSync(HOOK_SQL, 'utf8'))
}, 120_000)

afterAll(async () => {
  await db.close()
})

beforeEach(async () => {
  await db.exec('truncate public.auth_login_attempts; delete from auth.users;')
  await db.query('insert into auth.users (id) values ($1)', [USER])
})

describe('T5 · bloqueio no servidor após 3 senhas erradas (#18)', () => {
  it('deixa passar as 2 primeiras senhas erradas e bloqueia na 3ª', async () => {
    expect((await attempt(false)).decision).toBe('continue')
    expect((await attempt(false)).decision).toBe('continue')
    const third = await attempt(false)
    expect(third.decision).toBe('reject')
    expect(third.message).toMatch(/bloqueada/)
  })

  it('enquanto bloqueada, recusa até a senha correta', async () => {
    for (let i = 0; i < 3; i++) await attempt(false)
    expect((await attempt(true)).decision).toBe('reject')
  })

  it('senha correta antes do limite zera a contagem', async () => {
    await attempt(false)
    await attempt(false)
    expect((await attempt(true)).decision).toBe('continue')
    expect((await attempt(false)).decision).toBe('continue') // contagem recomeçou
  })

  it('depois dos 15 minutos o bloqueio cai e a senha correta entra', async () => {
    for (let i = 0; i < 3; i++) await attempt(false)
    await db.query(
      `update public.auth_login_attempts set locked_until = now() - interval '1 second'`,
    )
    expect((await attempt(true)).decision).toBe('continue')
    expect((await db.query('select * from public.auth_login_attempts')).rows).toHaveLength(0)
  })

  it('clientes (anon/authenticated) não leem a tabela nem chamam o gancho', async () => {
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`)
      try {
        await expect(db.query('select * from public.auth_login_attempts')).rejects.toThrow(
          /permission denied/,
        )
        await expect(
          db.query(`select public.hook_password_verification_attempt('{}'::jsonb)`),
        ).rejects.toThrow(/permission denied/)
      } finally {
        await db.exec('reset role')
      }
    }
  })
})
