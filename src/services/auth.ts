import { isValidCpf, normalizeCpf } from '../domain/cpf'
import { toLocalDateString } from '../domain/dates'
import { hashPassword, validatePassword, verifyPassword } from '../domain/password'
import type { RegisterInput, Role, StoredUser } from '../domain/types'
import { AppError } from './errors'
import { newId } from './guards'
import { getDb, updateDb } from './store'

const SESSION_KEY = 'mentcare_session'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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

export async function login(email: string, password: string, role: Role): Promise<StoredUser> {
  const normalized = email.trim().toLowerCase()
  const user = getDb().users.find((u) => u.email.toLowerCase() === normalized && u.role === role)
  // Mensagem única para não revelar se o e-mail existe.
  const invalid = new AppError('E-mail, senha ou perfil inválidos.')
  if (!user) throw invalid
  if (!(await verifyPassword(password, user.passHash))) throw invalid
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
  if (!EMAIL_RE.test(email)) throw new AppError('E-mail inválido.')
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
