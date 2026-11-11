import { describe, expect, it } from 'vitest'
import { passwordChecks, validateRegistration } from './registration'

const now = new Date(2026, 10, 11, 12, 0)
const valid = {
  name: 'User Teste',
  cpf: '390.533.447-05',
  birth: '1999-03-02',
  email: 'user@teste.com',
  password: 'Senha-forte-1',
  insurance: 'Particular',
  city: 'São Paulo',
}

describe('validateRegistration', () => {
  it('aceita um cadastro válido', () => {
    expect(validateRegistration(valid, now)).toEqual({})
  })
  it('aponta cada campo errado separadamente', () => {
    const errors = validateRegistration(
      { ...valid, name: ' ', cpf: '492.567.809-98', birth: '2030-01-01', email: 'x@', city: '' },
      now,
    )
    expect(Object.keys(errors).sort()).toEqual(['birth', 'city', 'cpf', 'email', 'name'])
    expect(errors.cpf).toMatch(/dígitos verificadores/)
  })
  it('lista exatamente o que falta na senha', () => {
    expect(validateRegistration({ ...valid, password: 'senhafraca1' }, now).password).toBe(
      'A senha precisa de: uma letra maiúscula, um símbolo (ex.: ! @ # -).',
    )
  })
})

describe('passwordChecks', () => {
  it('marca cada regra', () => {
    expect(passwordChecks('Aa1!aaaa').every((c) => c.ok)).toBe(true)
    expect(passwordChecks('').filter((c) => c.ok)).toHaveLength(0)
  })
})
