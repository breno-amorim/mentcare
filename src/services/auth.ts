import { isValidCpf, normalizeCpf } from '../domain/cpf'
import { toLocalDateString } from '../domain/dates'
import { emailError, normalizeEmail } from '../domain/email'
import { hashPassword, validatePassword, verifyPassword } from '../domain/password'
import {
  isLocked,
  lockedMessage,
  registerFailure,
  remainingAttempts,
  wrongPasswordMessage,
} from '../domain/lockout'
import type { RegisterInput, StoredUser } from '../domain/types'
import { AppError } from './errors'
import { newId } from './guards'
import { getDb, updateDb } from './store'

const SESSION_KEY = 'mentcare_session'

export function getSessionUserId(): string | null {
  try {
    return sessionStorage.getItem(SESSION_KEY)
  } catch {
    return null
  }
}

function setSession(id: string | null): void {
  try {
    if (id) sessionStorage.setItem(SESSION_KEY, id)
    else sessionStorage.removeItem(SESSION_KEY)
  } catch {
    // sem sessionStorage: a sessão vale só enquanto a página estiver aberta
  }
}

/**
 * Login com bloqueio: após 3 senhas erradas o e-mail fica bloqueado por 15 minutos.
 * A contagem é por e-mail (existente ou não), então a resposta não revela se a conta existe.
 */
export async function login(
  email: string,
  password: string,
  now = new Date(),
): Promise<StoredUser> {
  const key = normalizeEmail(email)
  const attempts = getDb().loginAttempts?.[key]
  // Bloqueada: recusa sem nem conferir a senha (nem a correta entra).
  if (isLocked(attempts, now)) throw new AppError(lockedMessage(attempts!, now))

  const user = getDb().users.find((u) => u.email.toLowerCase() === key)
  const ok = user ? await verifyPassword(password, user.passHash) : false
  if (!user || !ok) {
    const next = registerFailure(attempts, now)
    updateDb((db) => {
      db.loginAttempts = { ...db.loginAttempts, [key]: next }
    })
    throw new AppError(
      isLocked(next, now)
        ? lockedMessage(next, now)
        : wrongPasswordMessage(remainingAttempts(next, now)),
    )
  }

  if (attempts) {
    updateDb((db) => {
      if (db.loginAttempts) delete db.loginAttempts[key]
    })
  }
  setSession(user.id)
  return user
}

export function logout(): void {
  setSession(null)
}

export async function registerPatient(input: RegisterInput, now = new Date()): Promise<StoredUser> {
  const name = input.name.trim()
  const email = input.email.trim().toLowerCase()
  const cpf = normalizeCpf(input.cpf)
  if (!name) throw new AppError('Informe o nome completo.')
  if (!isValidCpf(cpf)) throw new AppError('CPF inválido. Confira os números informados.')
  const emailProblem = emailError(email)
  if (emailProblem) throw new AppError(emailProblem)
  if (!input.birth || input.birth > toLocalDateString(now))
    throw new AppError('Data de nascimento inválida.')
  const passwordError = validatePassword(input.password)
  if (passwordError) throw new AppError(passwordError)
  if (getDb().users.some((u) => u.cpf === cpf || u.email.toLowerCase() === email))
    throw new AppError('CPF ou e-mail já cadastrado.')

  const user: StoredUser = {
    id: newId(),
    role: 'patient',
    name,
    cpf,
    birth: input.birth,
    email,
    insurance: input.insurance,
    city: input.city.trim(),
    passHash: await hashPassword(input.password),
  }
  updateDb((db) => {
    db.users.push(user)
  })
  setSession(user.id)
  return user
}
