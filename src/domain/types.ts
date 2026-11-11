export type Role = 'patient' | 'professional' | 'manager'
export type Specialty = 'Psicologia' | 'Psiquiatria'
export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled'

export const INSURANCES = ['Particular', 'SUS', 'Unimed', 'Bradesco Saúde'] as const
export const SPECIALTIES: readonly Specialty[] = ['Psicologia', 'Psiquiatria']

export interface User {
  id: string
  role: Role
  name: string
  email: string
  passHash: string
  cpf?: string
  birth?: string
  insurance?: string
  city?: string
  specialty?: Specialty
  clinicId?: string
}

export interface Clinic {
  id: string
  name: string
  city: string
  address: string
  insurance: string[]
  specialties: string[]
  modes: string[]
  approved: boolean
}

export interface Availability {
  id: string
  professionalId: string
  date: string
  time: string
}

export interface Appointment {
  id: string
  patientId: string
  professionalId: string
  clinicId: string
  date: string
  time: string
  status: AppointmentStatus
  createdAt: string
}

export interface Addendum {
  date: string
  text: string
}

export interface MedicalRecord {
  id: string
  appointmentId: string
  patientId: string
  professionalId: string
  date: string
  text: string
  hypothesis: string
  addenda: Addendum[]
}

export interface Rating {
  id: string
  appointmentId: string
  clinicId: string
  patientId: string
  stars: number
  comment: string
}

export interface Db {
  version: number
  users: User[]
  clinics: Clinic[]
  availability: Availability[]
  appointments: Appointment[]
  records: MedicalRecord[]
  ratings: Rating[]
}

export const ROLE_LABEL: Record<Role, string> = {
  patient: 'Paciente',
  professional: 'Profissional',
  manager: 'Gestor',
}

export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  scheduled: 'Agendada',
  completed: 'Realizada',
  cancelled: 'Cancelada',
}
