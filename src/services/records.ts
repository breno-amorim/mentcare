import { toLocalDateString } from '../domain/dates'
import type { MedicalRecord, User } from '../domain/types'
import { AppError } from './errors'
import { newId, requireRole } from './guards'
import { getDb, updateDb } from './store'

const MAX_TEXT = 5000

/**
 * Prontuários visíveis: o paciente vê os seus; o profissional vê apenas os que
 * ele mesmo registrou (nunca os de outros profissionais). Gestor não tem acesso.
 */
export function listRecords(user: User): MedicalRecord[] {
  const all = getDb().records
  if (user.role === 'patient') return all.filter((r) => r.patientId === user.id)
  if (user.role === 'professional') return all.filter((r) => r.professionalId === user.id)
  return []
}

function cleanText(value: string, label: string): string {
  const text = value.trim()
  if (!text) throw new AppError(`${label} é obrigatório.`)
  if (text.length > MAX_TEXT) throw new AppError(`${label} excede ${MAX_TEXT} caracteres.`)
  return text
}

/** Registra a evolução e marca a consulta como realizada. O registro nunca é editado nem apagado. */
export function saveRecord(
  actorId: string,
  input: { appointmentId: string; text: string; hypothesis: string },
  now = new Date(),
): MedicalRecord {
  const professional = requireRole(actorId, 'professional')
  const db = getDb()
  const appt = db.appointments.find((a) => a.id === input.appointmentId)
  if (!appt || appt.professionalId !== professional.id)
    throw new AppError('Apenas o profissional responsável pode registrar a evolução.')
  if (appt.status !== 'scheduled' || db.records.some((r) => r.appointmentId === appt.id))
    throw new AppError('Esta consulta já possui registro ou não está agendada.')

  const record: MedicalRecord = {
    id: newId(),
    appointmentId: appt.id,
    patientId: appt.patientId,
    professionalId: professional.id,
    date: toLocalDateString(now),
    text: cleanText(input.text, 'A evolução'),
    hypothesis: input.hypothesis.trim().slice(0, 300),
    addenda: [],
  }
  updateDb((d) => {
    d.records.push(record)
    const target = d.appointments.find((a) => a.id === appt.id)
    if (target) target.status = 'completed'
  })
  return record
}

/** Adendo datado: só acrescenta, sem alterar o texto original. */
export function addAddendum(
  actorId: string,
  recordId: string,
  text: string,
  now = new Date(),
): void {
  const professional = requireRole(actorId, 'professional')
  const record = getDb().records.find((r) => r.id === recordId)
  if (!record || record.professionalId !== professional.id)
    throw new AppError('Registro não encontrado.')
  const clean = cleanText(text, 'O adendo')
  updateDb((d) => {
    d.records
      .find((r) => r.id === recordId)
      ?.addenda.push({ date: toLocalDateString(now), text: clean })
  })
}
