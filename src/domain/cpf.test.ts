import { describe, expect, it } from 'vitest'
import { formatCpf, isValidCpf, normalizeCpf } from './cpf'

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

describe('formatCpf', () => {
  it('aplica a máscara progressivamente e ignora excesso', () => {
    expect(formatCpf('529')).toBe('529')
    expect(formatCpf('5299')).toBe('529.9')
    expect(formatCpf('5299822')).toBe('529.982.2')
    expect(formatCpf('52998224725')).toBe('529.982.247-25')
    expect(formatCpf('529.982.247-2599')).toBe('529.982.247-25')
  })
})
