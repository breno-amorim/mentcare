import { canChangeAppointment, isSlotInFuture } from '../domain/appointment-policy'
import { freeSlots, isSlotTaken } from '../domain/booking'
import { toLocalDateString } from '../domain/dates'
import type { Appointment, User } from '../domain/types'
import { AppError } from './errors'
import { newId, requireRole } from './guards'
import { getDb, updateDb } from './store'

/** Consultas visíveis para o usuário, conforme o papel (cada um vê só as suas). */
export function listAppointments(user: User): Appointment[] {
  const all = getDb().appointments
  switch (user.role) {
    case 'patient':
      return all.filter((a) => a.patientId === user.id)
    case 'professional':
      return all.filter((a) => a.professionalId === user.id)
    case 'manager':
      return all.filter((a) => a.clinicId === user.clinicId)
  }
}

export function bookAppointment(
  actorId: string,
  input: { clinicId: string; professionalId: string; date: string; time: string },
  now = new Date(),
): Appointment {
  const patient = requireRole(actorId, 'patient')
  const db = getDb()
  const professional = db.users.find(
    (u) =>
      u.id === input.professionalId && u.role === 'professional' && u.clinicId === input.clinicId,
  )
  if (!professional) throw new AppError('Profissional não encontrado nesta clínica.')
  const offered = freeSlots(db.availability, db.appointments, professional.id, now).some(
    (s) => s.date === input.date && s.time === input.time,
  )
  if (!offered) throw new AppError('Este horário não está mais disponível. Escolha outro.')
  if (
    db.appointments.some(
      (a) =>
        a.patientId === patient.id &&
        a.status === 'scheduled' &&
        a.date === input.date &&
        a.time === input.time,
    )
  )
    throw new AppError('Você já possui uma consulta neste horário.')

  const appointment: Appointment = {
    id: newId(),
    patientId: patient.id,
    professionalId: professional.id,
    clinicId: input.clinicId,
    date: input.date,
    time: input.time,
    status: 'scheduled',
    createdAt: toLocalDateString(now),
  }
  updateDb((d) => {
    d.appointments.push(appointment)
  })
  return appointment
}

function ownScheduled(actorId: string, appointmentId: string): Appointment {
  const patient = requireRole(actorId, 'patient')
  const appt = getDb().appointments.find((a) => a.id === appointmentId)
  if (!appt || appt.patientId !== patient.id) throw new AppError('Consulta não encontrada.')
  if (appt.status !== 'scheduled')
    throw new AppError('Somente consultas agendadas podem ser alteradas.')
  return appt
}

const TOO_LATE =
  'Cancelamento e remarcação exigem pelo menos 24 horas de antecedência. Fale diretamente com a clínica.'

export function cancelAppointment(actorId: string, appointmentId: string, now = new Date()): void {
  const appt = ownScheduled(actorId, appointmentId)
  if (!canChangeAppointment(appt.date, appt.time, now)) throw new AppError(TOO_LATE)
  updateDb((d) => {
    const target = d.appointments.find((a) => a.id === appt.id)
    if (target) target.status = 'cancelled'
  })
}

export function rescheduleAppointment(
  actorId: string,
  appointmentId: string,
  slotId: string,
  now = new Date(),
): void {
  const appt = ownScheduled(actorId, appointmentId)
  if (!canChangeAppointment(appt.date, appt.time, now)) throw new AppError(TOO_LATE)
  const db = getDb()
  const slot = db.availability.find(
    (s) => s.id === slotId && s.professionalId === appt.professionalId,
  )
  if (
    !slot ||
    !isSlotInFuture(slot.date, slot.time, now) ||
    isSlotTaken(db.appointments, appt.professionalId, slot, appt.id)
  )
    throw new AppError('Este horário não está disponível.')
  updateDb((d) => {
    const target = d.appointments.find((a) => a.id === appt.id)
    if (target) {
      target.date = slot.date
      target.time = slot.time
    }
  })
}
