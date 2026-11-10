import { describe, expect, it } from 'vitest'
import { hashPassword, validatePassword, verifyPassword } from './password'

describe('password', () => {
  it('gera hashes diferentes (salt) e verifica corretamente', async () => {
    const a = await hashPassword('senha-segura-1')
    const b = await hashPassword('senha-segura-1')
    expect(a).not.toBe(b)
    expect(await verifyPassword('senha-segura-1', a)).toBe(true)
    expect(await verifyPassword('outra-senha', a)).toBe(false)
  })
  it('rejeita hash malformado', async () => {
    expect(await verifyPassword('x', 'lixo')).toBe(false)
  })
  it('exige no mínimo 8 caracteres', () => {
    expect(validatePassword('1234567')).not.toBeNull()
    expect(validatePassword('12345678')).toBeNull()
  })
})
