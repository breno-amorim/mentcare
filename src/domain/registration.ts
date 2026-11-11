import { isValidCpf } from './cpf'
import { toLocalDateString } from './dates'
import { emailError } from './email'
import { MIN_PASSWORD_LENGTH } from './password'
import type { RegisterInput } from './types'

export type RegisterField = 'name' | 'cpf' | 'birth' | 'email' | 'password' | 'city'
export type FieldErrors = Partial<Record<RegisterField, string>>

/** Regras de senha iguais às configuradas no Supabase Auth. */
export function passwordChecks(password: string) {
  return [
    {
      id: 'length',
      label: `${MIN_PASSWORD_LENGTH} ou mais caracteres`,
      ok: password.length >= MIN_PASSWORD_LENGTH,
    },
    { id: 'lower', label: 'uma letra minúscula', ok: /[a-z]/.test(password) },
    { id: 'upper', label: 'uma letra maiúscula', ok: /[A-Z]/.test(password) },
    { id: 'digit', label: 'um número', ok: /\d/.test(password) },
    { id: 'symbol', label: 'um símbolo (ex.: ! @ # -)', ok: /[^A-Za-z0-9]/.test(password) },
  ]
}

/** Valida o cadastro e diz exatamente qual campo está errado. Vazio = tudo certo. */
export function validateRegistration(input: RegisterInput, now = new Date()): FieldErrors {
  const errors: FieldErrors = {}
  if (input.name.trim().length < 3) errors.name = 'Informe o nome completo.'
  if (!input.cpf.trim()) errors.cpf = 'Informe o CPF.'
  else if (!isValidCpf(input.cpf))
    errors.cpf = 'CPF inválido: os dígitos verificadores não conferem.'
  if (!input.birth) errors.birth = 'Informe a data de nascimento.'
  else if (input.birth > toLocalDateString(now) || input.birth < '1900-01-01')
    errors.birth = 'Data de nascimento inválida.'
  const emailProblem = emailError(input.email)
  if (emailProblem) errors.email = emailProblem
  const missing = passwordChecks(input.password).filter((c) => !c.ok)
  if (missing.length)
    errors.password = `A senha precisa de: ${missing.map((c) => c.label).join(', ')}.`
  if (!input.city.trim()) errors.city = 'Informe a cidade.'
  return errors
}
