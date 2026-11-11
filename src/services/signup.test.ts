import { beforeEach, describe, expect, it } from 'vitest'
import { MIN_PASSWORD_LENGTH, verifyPassword } from '../domain/password'
import { registerPatient } from './auth'
import { getDb, resetDb } from './store'

// Testes obrigatórios do cadastro: T1 (L1) e T6 (L6). Issues #14 e #19.
const now = new Date(2026, 10, 10, 12, 0)

const novoPaciente = {
  name: 'Paula Teste',
  cpf: '390.533.447-05',
  birth: '1995-05-20',
  email: 'paula@email.com',
  password: 'senha-da-paula',
  insurance: 'SUS',
  city: 'São Paulo',
}

const buscarPorEmail = (email: string) => getDb().users.find((u) => u.email === email)

beforeEach(() => {
  resetDb(now)
})

describe('T1 · cadastro válido grava senha diferente da digitada (L1)', () => {
  it('cria o usuário e guarda só o hash da senha', async () => {
    await registerPatient(novoPaciente, now)

    const salvo = buscarPorEmail('paula@email.com')
    expect(salvo).toBeDefined()
    expect(salvo?.passHash).not.toBe(novoPaciente.password)
    expect(salvo?.passHash.startsWith('pbkdf2$')).toBe(true)
    expect(JSON.stringify(getDb())).not.toContain(novoPaciente.password)
  })

  it('o hash gravado confere com a senha digitada', async () => {
    await registerPatient(novoPaciente, now)
    const salvo = buscarPorEmail('paula@email.com')
    expect(await verifyPassword(novoPaciente.password, salvo?.passHash ?? '')).toBe(true)
    expect(await verifyPassword('senha-errada', salvo?.passHash ?? '')).toBe(false)
  })
})

describe('T6 · senha curta é rejeitada no cadastro (L6)', () => {
  it(`recusa senha com menos de ${MIN_PASSWORD_LENGTH} caracteres e não cria o usuário`, async () => {
    const curta = 'a'.repeat(MIN_PASSWORD_LENGTH - 1)
    await expect(registerPatient({ ...novoPaciente, password: curta }, now)).rejects.toThrow(
      `ao menos ${MIN_PASSWORD_LENGTH} caracteres`,
    )
    expect(buscarPorEmail('paula@email.com')).toBeUndefined()
  })

  it(`aceita senha com exatamente ${MIN_PASSWORD_LENGTH} caracteres`, async () => {
    const limite = 'b'.repeat(MIN_PASSWORD_LENGTH)
    await expect(registerPatient({ ...novoPaciente, password: limite }, now)).resolves.toBeTruthy()
  })

  it('recusa senha formada só por espaços', async () => {
    await expect(
      registerPatient({ ...novoPaciente, password: ' '.repeat(MIN_PASSWORD_LENGTH) }, now),
    ).rejects.toThrow('só por espaços')
    expect(buscarPorEmail('paula@email.com')).toBeUndefined()
  })
})
