import type { ClinicInput, RegisterInput, Snapshot, Specialty, User } from '../domain/types'
import { clearSnapshot, setSnapshot } from './snapshot'

/**
 * Contrato único entre a interface e os dados. Há duas implementações:
 * memória (demonstração e testes) e Supabase (produção).
 * Todas as regras de segurança valem no servidor; aqui só há chamadas.
 */
export interface Backend {
  /** true no modo demonstração (mostra contas de exemplo). */
  readonly isDemo: boolean
  /** Cadastro de profissionais por e-mail/senha ainda não disponível no Supabase. */
  readonly canCreateProfessionals: boolean

  restoreSession(): Promise<User | null>
  signIn(email: string, password: string): Promise<User>
  /** Retorna null quando falta confirmar o e-mail antes de entrar. */
  signUp(input: RegisterInput): Promise<User | null>
  signOut(): Promise<void>
  load(): Promise<Snapshot>
  reset?(): Promise<void>

  bookAppointment(input: {
    clinicId: string
    professionalId: string
    date: string
    time: string
  }): Promise<void>
  cancelAppointment(id: string): Promise<void>
  rescheduleAppointment(id: string, date: string, time: string): Promise<void>
  saveRecord(input: { appointmentId: string; text: string; hypothesis: string }): Promise<void>
  addAddendum(recordId: string, text: string): Promise<void>
  rateAppointment(input: { appointmentId: string; stars: number; comment: string }): Promise<void>
  saveClinic(input: ClinicInput): Promise<void>
  addProfessional(input: {
    name: string
    email: string
    specialty: Specialty
    password: string
  }): Promise<void>
  addAvailability(professionalId: string, date: string, time: string): Promise<void>
  removeAvailability(slotId: string): Promise<void>
}

let backend: Backend | null = null

export function setBackend(next: Backend): void {
  backend = next
}

export function getBackend(): Backend {
  if (!backend) throw new Error('Backend não inicializado')
  return backend
}

export async function refreshData(): Promise<void> {
  setSnapshot(await getBackend().load())
}

/** Executa uma ação de escrita e recarrega os dados da tela. */
export async function act(fn: (b: Backend) => Promise<void>): Promise<void> {
  await fn(getBackend())
  await refreshData()
}

export async function endSession(): Promise<void> {
  await getBackend().signOut()
  clearSnapshot()
}
