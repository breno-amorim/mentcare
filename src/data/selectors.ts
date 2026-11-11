import type { Appointment, MedicalRecord, Snapshot, User } from '../domain/types'

/** Consultas do usuário. No Supabase o servidor já filtra; aqui garantimos o mesmo no modo demo. */
export function appointmentsFor(data: Snapshot, user: User): Appointment[] {
  switch (user.role) {
    case 'patient':
      return data.appointments.filter((a) => a.patientId === user.id)
    case 'professional':
      return data.appointments.filter((a) => a.professionalId === user.id)
    case 'manager':
      return data.appointments.filter((a) => a.clinicId === user.clinicId)
  }
}

/** Prontuário: paciente lê os seus; profissional só os que registrou; gestor nenhum. */
export function recordsFor(data: Snapshot, user: User): MedicalRecord[] {
  if (user.role === 'patient') return data.records.filter((r) => r.patientId === user.id)
  if (user.role === 'professional') return data.records.filter((r) => r.professionalId === user.id)
  return []
}

export function professionalsOf(data: Snapshot, clinicId: string | undefined): User[] {
  return data.users.filter((u) => u.role === 'professional' && u.clinicId === clinicId)
}

export const clinicRating = (data: Snapshot, clinicId: string): number =>
  data.ratingSummary[clinicId]?.avg ?? 0
