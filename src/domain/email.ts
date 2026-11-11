// Formato aceito: nome@dominio.tld (TLD com 2+ letras), sem espaços e sem pontos seguidos.
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/
const MAX_EMAIL_LENGTH = 254

export const normalizeEmail = (value: string): string => value.trim().toLowerCase()

/** Mensagem do problema no e-mail, ou null se estiver válido. */
export function emailError(value: string): string | null {
  const email = value.trim()
  if (!email) return 'Informe o e-mail.'
  if (email.length > MAX_EMAIL_LENGTH || email.includes('..') || !EMAIL_RE.test(email))
    return 'E-mail inválido. Use o formato nome@dominio.com.'
  return null
}

export const isValidEmail = (value: string): boolean => emailError(value) === null
