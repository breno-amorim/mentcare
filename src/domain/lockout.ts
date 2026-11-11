export const MAX_FAILED_LOGINS = 3
export const LOCK_MINUTES = 15

/** Tentativas de login de um e-mail. `lockedUntil` em ISO 8601 quando bloqueado. */
export interface LoginAttempts {
  failures: number
  lockedUntil: string | null
}

const FRESH: LoginAttempts = { failures: 0, lockedUntil: null }

export function isLocked(attempts: LoginAttempts | undefined, now: Date): boolean {
  return !!attempts?.lockedUntil && new Date(attempts.lockedUntil).getTime() > now.getTime()
}

/** Bloqueio vencido volta a contar do zero. */
export function current(attempts: LoginAttempts | undefined, now: Date): LoginAttempts {
  if (!attempts) return FRESH
  if (attempts.lockedUntil && !isLocked(attempts, now)) return FRESH
  return attempts
}

/** Registra uma senha errada; na 3ª, bloqueia por 15 minutos. */
export function registerFailure(attempts: LoginAttempts | undefined, now: Date): LoginAttempts {
  const failures = current(attempts, now).failures + 1
  if (failures < MAX_FAILED_LOGINS) return { failures, lockedUntil: null }
  return {
    failures,
    lockedUntil: new Date(now.getTime() + LOCK_MINUTES * 60_000).toISOString(),
  }
}

export const remainingAttempts = (attempts: LoginAttempts | undefined, now: Date): number =>
  Math.max(0, MAX_FAILED_LOGINS - current(attempts, now).failures)

export function lockedMessage(attempts: LoginAttempts, now: Date): string {
  const ms = new Date(attempts.lockedUntil ?? now).getTime() - now.getTime()
  const minutes = Math.max(1, Math.ceil(ms / 60_000))
  return `Conta bloqueada por segurança após ${MAX_FAILED_LOGINS} senhas erradas. Tente novamente em ${minutes} minuto(s).`
}

export function wrongPasswordMessage(remaining: number): string {
  return `E-mail ou senha inválidos. Restam ${remaining} tentativa(s) antes do bloqueio temporário.`
}
