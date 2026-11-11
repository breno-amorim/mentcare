import type { Appointment, Availability, Clinic } from './types'
import { isSlotInFuture } from './appointment-policy'
import { addDays, toLocalDateString } from './dates'

export const BOOKING_HORIZON_DAYS = 30

const sameSlot = (a: { date: string; time: string }, b: { date: string; time: string }) =>
  a.date === b.date && a.time === b.time

/** Há consulta não cancelada deste profissional neste horário? */
export function isSlotTaken(
  appointments: Appointment[],
  professionalId: string,
  slot: { date: string; time: string },
  ignoreAppointmentId?: string,
): boolean {
  return appointments.some(
    (a) =>
      a.id !== ignoreAppointmentId &&
      a.professionalId === professionalId &&
      a.status !== 'cancelled' &&
      sameSlot(a, slot),
  )
}

/** Horários livres, futuros e dentro do horizonte de 30 dias, em ordem cronológica. */
export function freeSlots(
  availability: Availability[],
  appointments: Appointment[],
  professionalId: string,
  now: Date,
  ignoreAppointmentId?: string,
): Availability[] {
  const limit = addDays(now, BOOKING_HORIZON_DAYS)
  return availability
    .filter(
      (s) =>
        s.professionalId === professionalId &&
        s.date <= limit &&
        isSlotInFuture(s.date, s.time, now) &&
        !isSlotTaken(appointments, professionalId, s, ignoreAppointmentId),
    )
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
}

export interface ClinicFilters {
  query: string
  city: string
  insurance: string
  specialty: string
}

export const ALL_INSURANCES = 'Todos'
export const ALL_SPECIALTIES = 'Todas'

export function filterClinics(
  clinics: Clinic[],
  filters: ClinicFilters,
  averageOf: (clinicId: string) => number,
): Clinic[] {
  const q = filters.query.trim().toLowerCase()
  const city = filters.city.trim().toLowerCase()
  return clinics
    .filter(
      (c) =>
        c.approved &&
        (!q || c.name.toLowerCase().includes(q)) &&
        (!city || c.city.toLowerCase().includes(city)) &&
        (filters.insurance === ALL_INSURANCES || c.insurance.includes(filters.insurance)) &&
        (filters.specialty === ALL_SPECIALTIES || c.specialties.includes(filters.specialty)),
    )
    .sort((a, b) => averageOf(b.id) - averageOf(a.id))
}

export function averageRating(stars: number[]): number {
  return stars.length ? stars.reduce((s, n) => s + n, 0) / stars.length : 0
}

export const todayString = (now: Date) => toLocalDateString(now)
