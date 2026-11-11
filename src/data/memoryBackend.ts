import { averageRating } from '../domain/booking'
import type { Snapshot, User } from '../domain/types'
import * as appointments from '../services/appointments'
import * as auth from '../services/auth'
import * as clinics from '../services/clinics'
import { AppError } from '../services/errors'
import * as records from '../services/records'
import { getDb, resetDb } from '../services/store'
import type { Backend } from './backend'

/** Remove o hash de senha antes de entregar o usuário à interface. */
function publicUser({ passHash: _passHash, ...user }: User & { passHash?: string }): User {
  return user
}

/** Backend de demonstração: dados em memória/localStorage, mesmas regras dos serviços. */
export function createMemoryBackend(): Backend {
  const actor = (): string => {
    const id = auth.getSessionUserId()
    if (!id) throw new AppError('Faça login para continuar.')
    return id
  }

  return {
    isDemo: true,
    canCreateProfessionals: true,

    async restoreSession() {
      const id = auth.getSessionUserId()
      const user = getDb().users.find((u) => u.id === id)
      return user ? publicUser(user) : null
    },

    async signIn(email, password) {
      // Regras de senha errada e bloqueio ficam no serviço (mensagens já são seguras).
      return publicUser(await auth.login(email, password))
    },

    async signUp(input) {
      return publicUser(await auth.registerPatient(input))
    },

    async signOut() {
      auth.logout()
    },

    async load(): Promise<Snapshot> {
      const db = getDb()
      const ratingSummary: Snapshot['ratingSummary'] = {}
      for (const clinic of db.clinics) {
        const stars = db.ratings.filter((r) => r.clinicId === clinic.id).map((r) => r.stars)
        ratingSummary[clinic.id] = { avg: averageRating(stars), count: stars.length }
      }
      return {
        users: db.users.map(publicUser),
        clinics: db.clinics,
        availability: db.availability,
        appointments: db.appointments,
        records: db.records,
        ratings: db.ratings,
        ratingSummary,
      }
    },

    async reset() {
      resetDb()
      auth.logout()
    },

    async bookAppointment(input) {
      appointments.bookAppointment(actor(), input)
    },
    async cancelAppointment(id) {
      appointments.cancelAppointment(actor(), id)
    },
    async rescheduleAppointment(id, date, time) {
      const appt = getDb().appointments.find((a) => a.id === id)
      const slot = getDb().availability.find(
        (s) => s.professionalId === appt?.professionalId && s.date === date && s.time === time,
      )
      if (!slot) throw new AppError('Este horário não está disponível.')
      appointments.rescheduleAppointment(actor(), id, slot.id)
    },
    async saveRecord(input) {
      records.saveRecord(actor(), input)
    },
    async addAddendum(recordId, text) {
      records.addAddendum(actor(), recordId, text)
    },
    async rateAppointment(input) {
      clinics.rateAppointment(actor(), input)
    },
    async saveClinic(input) {
      clinics.saveClinic(actor(), input)
    },
    async addProfessional(input) {
      await clinics.addProfessional(actor(), input)
    },
    async addAvailability(professionalId, date, time) {
      clinics.addAvailability(actor(), professionalId, date, time)
    },
    async removeAvailability(slotId) {
      clinics.removeAvailability(actor(), slotId)
    },
  }
}
