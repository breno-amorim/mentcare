import { describe, expect, it } from 'vitest'
import { averageRating, filterClinics, freeSlots, isSlotTaken } from './booking'
import type { Appointment, Availability, Clinic } from './types'

const now = new Date(2026, 10, 10, 12, 0)
const slot = (id: string, date: string, time: string, professionalId = 'd1'): Availability => ({
  id,
  professionalId,
  date,
  time,
})
const appt = (over: Partial<Appointment>): Appointment => ({
  id: 'ap',
  patientId: 'p1',
  professionalId: 'd1',
  clinicId: 'c1',
  date: '2026-11-11',
  time: '14:00',
  status: 'scheduled',
  createdAt: '2026-11-10',
  ...over,
})

describe('freeSlots', () => {
  const availability = [
    slot('a', '2026-11-10', '09:00'), // hoje, já passou
    slot('b', '2026-11-10', '15:00'), // hoje, ainda por vir
    slot('c', '2026-11-11', '14:00'),
    slot('d', '2027-01-20', '10:00'), // além de 30 dias
    slot('e', '2026-11-12', '10:00', 'd2'), // outro profissional
  ]
  it('retorna só horários futuros, dentro de 30 dias, do profissional', () => {
    expect(freeSlots(availability, [], 'd1', now).map((s) => s.id)).toEqual(['b', 'c'])
  })
  it('exclui horários ocupados mas libera os cancelados', () => {
    const taken = [appt({})]
    expect(freeSlots(availability, taken, 'd1', now).map((s) => s.id)).toEqual(['b'])
    const cancelled = [appt({ status: 'cancelled' })]
    expect(freeSlots(availability, cancelled, 'd1', now).map((s) => s.id)).toEqual(['b', 'c'])
  })
  it('ignora a própria consulta ao remarcar', () => {
    const own = [appt({ id: 'mine' })]
    expect(freeSlots(availability, own, 'd1', now, 'mine').map((s) => s.id)).toEqual(['b', 'c'])
  })
})

describe('isSlotTaken', () => {
  it('detecta conflito apenas do mesmo profissional', () => {
    expect(isSlotTaken([appt({})], 'd1', { date: '2026-11-11', time: '14:00' })).toBe(true)
    expect(isSlotTaken([appt({})], 'd2', { date: '2026-11-11', time: '14:00' })).toBe(false)
  })
})

describe('filterClinics', () => {
  const clinic = (over: Partial<Clinic>): Clinic => ({
    id: 'c1',
    name: 'Bem Viver',
    city: 'Taboão da Serra',
    address: '',
    insurance: ['Unimed'],
    specialties: ['Psicologia'],
    modes: [],
    approved: true,
    ...over,
  })
  const all = { query: '', city: '', insurance: 'Todos', specialty: 'Todas' }
  it('filtra por convênio e oculta clínicas não aprovadas', () => {
    const list = [
      clinic({}),
      clinic({ id: 'c2', insurance: ['SUS'] }),
      clinic({ id: 'c3', approved: false }),
    ]
    expect(filterClinics(list, { ...all, insurance: 'SUS' }, () => 0).map((c) => c.id)).toEqual([
      'c2',
    ])
    expect(filterClinics(list, all, () => 0)).toHaveLength(2)
  })
  it('ordena por avaliação média decrescente', () => {
    const list = [clinic({ id: 'a' }), clinic({ id: 'b' })]
    const avg = (id: string) => (id === 'b' ? 5 : 3)
    expect(filterClinics(list, all, avg).map((c) => c.id)).toEqual(['b', 'a'])
  })
})

describe('averageRating', () => {
  it('calcula a média e retorna 0 sem avaliações', () => {
    expect(averageRating([5, 4])).toBe(4.5)
    expect(averageRating([])).toBe(0)
  })
})
