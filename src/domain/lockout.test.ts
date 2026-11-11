import { describe, expect, it } from 'vitest'
import {
  LOCK_MINUTES,
  isLocked,
  lockedMessage,
  registerFailure,
  remainingAttempts,
} from './lockout'

// Teste obrigatório T5 · bloqueio após 3 senhas erradas. Issue #18.
const now = new Date(2026, 10, 11, 12, 0)
const later = (minutes: number) => new Date(now.getTime() + minutes * 60_000)

describe('T5 · regra de bloqueio', () => {
  it('conta as tentativas e bloqueia na 3ª senha errada', () => {
    const first = registerFailure(undefined, now)
    expect(remainingAttempts(first, now)).toBe(2)
    const second = registerFailure(first, now)
    expect(isLocked(second, now)).toBe(false)
    expect(remainingAttempts(second, now)).toBe(1)
    const third = registerFailure(second, now)
    expect(isLocked(third, now)).toBe(true)
    expect(remainingAttempts(third, now)).toBe(0)
  })

  it(`o bloqueio dura ${LOCK_MINUTES} minutos`, () => {
    const locked = registerFailure(registerFailure(registerFailure(undefined, now), now), now)
    expect(isLocked(locked, later(LOCK_MINUTES - 1))).toBe(true)
    expect(isLocked(locked, later(LOCK_MINUTES + 1))).toBe(false)
    expect(lockedMessage(locked, later(10))).toMatch(/Tente novamente em 5 minuto/)
  })

  it('bloqueio vencido volta a contar do zero', () => {
    let a = registerFailure(undefined, now)
    a = registerFailure(a, now)
    a = registerFailure(a, now)
    const afterLock = registerFailure(a, later(LOCK_MINUTES + 1))
    expect(isLocked(afterLock, later(LOCK_MINUTES + 1))).toBe(false)
    expect(remainingAttempts(afterLock, later(LOCK_MINUTES + 1))).toBe(2)
  })
})
