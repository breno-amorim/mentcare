import { describe, expect, it } from 'vitest'
import { emailError, isValidEmail, normalizeEmail } from './email'

// Teste obrigatório T4 · e-mail inválido é recusado na hora. Issue #17.
describe('T4 · regra de e-mail', () => {
  it.each(['paciente@email.com', 'ana.souza+consulta@clinica.com.br', 'A_B-1@sub.dominio.org'])(
    'aceita %s',
    (email) => {
      expect(isValidEmail(email)).toBe(true)
    },
  )

  it.each([
    ['sem arroba', 'pacienteemail.com'],
    ['sem domínio', 'paciente@'],
    ['sem usuário', '@email.com'],
    ['sem extensão', 'paciente@email'],
    ['extensão de 1 letra', 'paciente@email.c'],
    ['com espaço', 'paciente @email.com'],
    ['dois arrobas', 'pa@ciente@email.com'],
    ['pontos seguidos', 'paciente..x@email.com'],
  ])('recusa e-mail %s (%s)', (_motivo, email) => {
    expect(emailError(email)).toBe('E-mail inválido. Use o formato nome@dominio.com.')
  })

  it('pede o e-mail quando o campo está vazio', () => {
    expect(emailError('   ')).toBe('Informe o e-mail.')
  })

  it('ignora espaços nas pontas e normaliza para minúsculas', () => {
    expect(isValidEmail('  Paciente@Email.com  ')).toBe(true)
    expect(normalizeEmail('  Paciente@Email.com  ')).toBe('paciente@email.com')
  })
})
