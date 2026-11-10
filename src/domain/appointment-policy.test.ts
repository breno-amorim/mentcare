import { describe, expect, it } from 'vitest'
import { canChangeAppointment, isSlotInFuture } from './appointment-policy'
import { toLocalDateString } from './dates'

const now = new Date(2026, 10, 10, 12, 0) // 10/11/2026 12:00 local

describe('canChangeAppointment (regra de 24h)', () => {
  it('permite com mais de 24h', () => {
    expect(canChangeAppointment('2026-11-11', '12:01', now)).toBe(true)
  })
  it('permite exatamente 24h', () => {
    expect(canChangeAppointment('2026-11-11', '12:00', now)).toBe(true)
  })
  it('bloqueia com menos de 24h', () => {
    expect(canChangeAppointment('2026-11-11', '11:59', now)).toBe(false)
  })
})

describe('isSlotInFuture', () => {
  it('rejeita horário de hoje que já passou', () => {
    expect(isSlotInFuture('2026-11-10', '09:00', now)).toBe(false)
  })
  it('aceita horário de hoje ainda por vir', () => {
    expect(isSlotInFuture('2026-11-10', '15:00', now)).toBe(true)
  })
})

describe('toLocalDateString', () => {
  it('usa a data local, não UTC (22h em UTC-3 continua no mesmo dia)', () => {
    expect(toLocalDateString(new Date(2026, 10, 10, 22, 30))).toBe('2026-11-10')
  })
})
