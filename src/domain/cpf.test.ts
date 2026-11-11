import { describe, expect, it } from 'vitest'
import { isValidCpf, normalizeCpf } from './cpf'

describe('isValidCpf', () => {
  it('aceita CPF válido com e sem máscara', () => {
    expect(isValidCpf('52998224725')).toBe(true)
    expect(isValidCpf('529.982.247-25')).toBe(true)
  })
  it('rejeita dígito verificador errado', () => {
    expect(isValidCpf('52998224726')).toBe(false)
  })
  it('rejeita sequências repetidas e tamanho errado', () => {
    expect(isValidCpf('11111111111')).toBe(false)
    expect(isValidCpf('1234')).toBe(false)
    expect(isValidCpf('')).toBe(false)
  })
  it('normaliza removendo máscara', () => {
    expect(normalizeCpf('529.982.247-25')).toBe('52998224725')
  })
})
