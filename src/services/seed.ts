import { addDays } from '../domain/dates'
import type { Availability, Db } from '../domain/types'

export const DB_VERSION = 2

/** PBKDF2 (salt próprio) da senha de demonstração "mentcare123". */
export const DEMO_PASS_HASH =
  'pbkdf2$100000$72b57e405cdef47fd6662d439f8e43f6$5f45714d98d27218581b7682cf45638f2a78bb14a46ff4b59ccb8cc4b2287926'

export const DEMO_PROFESSIONAL_IDS = ['d1', 'd2']

/** Horários de demonstração relativos a `now`. */
export function demoAvailability(now: Date): Availability[] {
  const slot = (id: string, professionalId: string, days: number, time: string) => ({
    id,
    professionalId,
    date: addDays(now, days),
    time,
  })
  return [
    slot('a1', 'd1', 1, '14:00'),
    slot('a2', 'd1', 2, '10:00'),
    slot('a3', 'd1', 4, '15:00'),
    slot('a4', 'd2', 1, '09:00'),
    slot('a5', 'd2', 3, '11:00'),
  ]
}

export function buildSeed(now: Date): Db {
  return {
    version: DB_VERSION,
    users: [
      {
        id: 'p1',
        role: 'patient',
        name: 'Mariana Costa',
        cpf: '52998224725',
        birth: '1998-04-12',
        email: 'mariana@email.com',
        insurance: 'Unimed',
        city: 'Taboão da Serra',
        passHash: DEMO_PASS_HASH,
      },
      {
        id: 'd1',
        role: 'professional',
        name: 'Ana Oliveira',
        email: 'ana@mentcare.com',
        specialty: 'Psicologia',
        clinicId: 'c1',
        city: 'Taboão da Serra',
        passHash: DEMO_PASS_HASH,
      },
      {
        id: 'd2',
        role: 'professional',
        name: 'Rafael Lima',
        email: 'rafael@mentcare.com',
        specialty: 'Psiquiatria',
        clinicId: 'c2',
        city: 'São Paulo',
        passHash: DEMO_PASS_HASH,
      },
      {
        id: 'm1',
        role: 'manager',
        name: 'Gestão Clínica Bem Viver',
        email: 'gestao@mentcare.com',
        clinicId: 'c1',
        passHash: DEMO_PASS_HASH,
      },
    ],
    clinics: [
      {
        id: 'c1',
        name: 'Clínica Bem Viver',
        city: 'Taboão da Serra',
        address: 'Rua das Flores, 120 — Centro',
        insurance: ['Unimed', 'Particular'],
        modes: ['Presencial'],
        specialties: ['Psicologia', 'Psiquiatria'],
        approved: true,
      },
      {
        id: 'c2',
        name: 'Instituto Horizonte',
        city: 'São Paulo',
        address: 'Av. Paulista, 900 — Bela Vista',
        insurance: ['SUS', 'Particular', 'Bradesco Saúde'],
        modes: ['Presencial', 'Online'],
        specialties: ['Psiquiatria', 'Psicologia'],
        approved: true,
      },
      {
        id: 'c3',
        name: 'Espaço Acolher',
        city: 'Taboão da Serra',
        address: 'Rua do Parque, 45 — Jardim Maria Rosa',
        insurance: ['SUS', 'Unimed'],
        modes: ['Presencial'],
        specialties: ['Psicologia'],
        approved: true,
      },
    ],
    availability: demoAvailability(now),
    appointments: [
      {
        id: 'ap0',
        patientId: 'p1',
        professionalId: 'd1',
        clinicId: 'c1',
        date: addDays(now, -7),
        time: '10:00',
        status: 'completed',
        createdAt: addDays(now, -14),
      },
      {
        id: 'ap1',
        patientId: 'p1',
        professionalId: 'd1',
        clinicId: 'c1',
        date: addDays(now, 1),
        time: '14:00',
        status: 'scheduled',
        createdAt: addDays(now, 0),
      },
    ],
    records: [
      {
        id: 'r0',
        appointmentId: 'ap0',
        patientId: 'p1',
        professionalId: 'd1',
        date: addDays(now, -7),
        text: 'Primeira sessão (dado fictício): paciente relata ansiedade no trabalho. Plano: técnicas de respiração e retorno em uma semana.',
        hypothesis: '',
        addenda: [],
      },
    ],
    ratings: [],
  }
}
