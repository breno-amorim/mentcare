import { toLocalDateString, addDays } from '../domain/dates'
import { isValidEmail } from '../domain/email'
import { hashPassword, validatePassword } from '../domain/password'
import type { Clinic, ClinicInput, Rating, Specialty, StoredUser, User } from '../domain/types'
import { SPECIALTIES } from '../domain/types'
import { AppError } from './errors'
import { newId, requireRole } from './guards'
import { getDb, updateDb } from './store'

const splitList = (value: string) =>
  value
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)

export function ratingsOf(clinicId: string): number[] {
  return getDb()
    .ratings.filter((r) => r.clinicId === clinicId)
    .map((r) => r.stars)
}

export function rateAppointment(
  actorId: string,
  input: { appointmentId: string; stars: number; comment: string },
): Rating {
  const patient = requireRole(actorId, 'patient')
  const db = getDb()
  const appt = db.appointments.find((a) => a.id === input.appointmentId)
  if (!appt || appt.patientId !== patient.id) throw new AppError('Consulta não encontrada.')
  if (appt.status !== 'completed')
    throw new AppError('Somente consultas realizadas podem ser avaliadas.')
  if (db.ratings.some((r) => r.appointmentId === appt.id))
    throw new AppError('Esta consulta já foi avaliada.')
  if (!Number.isInteger(input.stars) || input.stars < 1 || input.stars > 5)
    throw new AppError('A nota deve ser de 1 a 5.')
  const rating: Rating = {
    id: newId(),
    appointmentId: appt.id,
    clinicId: appt.clinicId,
    patientId: patient.id,
    stars: input.stars,
    comment: input.comment.trim().slice(0, 500),
  }
  updateDb((d) => {
    d.ratings.push(rating)
  })
  return rating
}

/** Cria a clínica do gestor ou edita a que ele já administra (nunca a de outro gestor). */
export function saveClinic(actorId: string, input: ClinicInput): Clinic {
  const manager = requireRole(actorId, 'manager')
  const name = input.name.trim()
  const city = input.city.trim()
  const address = input.address.trim()
  if (!name || !city || !address) throw new AppError('Nome, cidade e endereço são obrigatórios.')
  const insurance = splitList(input.insurance)
  const specialties = splitList(input.specialties)
  if (!specialties.length) throw new AppError('Informe ao menos uma especialidade.')

  const existing = manager.clinicId
    ? getDb().clinics.find((c) => c.id === manager.clinicId)
    : undefined
  const clinic: Clinic = {
    id: existing?.id ?? newId(),
    name,
    city,
    address,
    insurance,
    specialties,
    modes: existing?.modes ?? ['Presencial'],
    approved: true,
  }
  updateDb((d) => {
    const i = d.clinics.findIndex((c) => c.id === clinic.id)
    if (i >= 0) d.clinics[i] = clinic
    else d.clinics.push(clinic)
    const me = d.users.find((u) => u.id === manager.id)
    if (me) me.clinicId = clinic.id
  })
  return clinic
}

export function listProfessionals(manager: User): User[] {
  return getDb().users.filter((u) => u.role === 'professional' && u.clinicId === manager.clinicId)
}

export async function addProfessional(
  actorId: string,
  input: { name: string; email: string; specialty: Specialty; password: string },
): Promise<StoredUser> {
  const manager = requireRole(actorId, 'manager')
  if (!manager.clinicId) throw new AppError('Cadastre a clínica antes de adicionar profissionais.')
  const email = input.email.trim().toLowerCase()
  if (!input.name.trim()) throw new AppError('Informe o nome do profissional.')
  if (!isValidEmail(email)) throw new AppError('E-mail inválido. Use o formato nome@dominio.com.')
  if (!SPECIALTIES.includes(input.specialty)) throw new AppError('Especialidade inválida.')
  const passwordError = validatePassword(input.password)
  if (passwordError) throw new AppError(passwordError)
  if (getDb().users.some((u) => u.email.toLowerCase() === email))
    throw new AppError('Este e-mail já está cadastrado.')
  const professional: StoredUser = {
    id: newId(),
    role: 'professional',
    name: input.name.trim(),
    email,
    specialty: input.specialty,
    clinicId: manager.clinicId,
    passHash: await hashPassword(input.password),
  }
  updateDb((d) => {
    d.users.push(professional)
  })
  return professional
}

function ownProfessional(manager: User, professionalId: string): User {
  const p = getDb().users.find(
    (u) => u.id === professionalId && u.role === 'professional' && u.clinicId === manager.clinicId,
  )
  if (!p) throw new AppError('Profissional não pertence à sua clínica.')
  return p
}

export function addAvailability(
  actorId: string,
  professionalId: string,
  date: string,
  time: string,
  now = new Date(),
): void {
  const manager = requireRole(actorId, 'manager')
  ownProfessional(manager, professionalId)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time))
    throw new AppError('Informe uma data e um horário válidos.')
  if (date < toLocalDateString(now) || date > addDays(now, 90))
    throw new AppError('Escolha uma data futura, em até 90 dias.')
  if (
    getDb().availability.some(
      (s) => s.professionalId === professionalId && s.date === date && s.time === time,
    )
  )
    throw new AppError('Este horário já foi cadastrado.')
  updateDb((d) => {
    d.availability.push({ id: newId(), professionalId, date, time })
  })
}

export function removeAvailability(actorId: string, slotId: string): void {
  const manager = requireRole(actorId, 'manager')
  const db = getDb()
  const slot = db.availability.find((s) => s.id === slotId)
  if (!slot) return
  ownProfessional(manager, slot.professionalId)
  const booked = db.appointments.some(
    (a) =>
      a.professionalId === slot.professionalId &&
      a.date === slot.date &&
      a.time === slot.time &&
      a.status === 'scheduled',
  )
  if (booked)
    throw new AppError('Este horário possui uma consulta agendada e não pode ser removido.')
  updateDb((d) => {
    d.availability = d.availability.filter((s) => s.id !== slotId)
  })
}
