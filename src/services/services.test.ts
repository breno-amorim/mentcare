import { beforeEach, describe, expect, it } from 'vitest'
import {
  bookAppointment,
  cancelAppointment,
  listAppointments,
  rescheduleAppointment,
} from './appointments'
import { login, registerPatient } from './auth'
import { addAvailability, addProfessional, rateAppointment, removeAvailability } from './clinics'
import { AppError } from './errors'
import { addAddendum, listRecords, saveRecord } from './records'
import { getDb, resetDb } from './store'

// Seed relativo a 10/11/2026 12:00: consulta ap1 em 11/11 às 14:00 (26h depois).
const now = new Date(2026, 10, 10, 12, 0)

beforeEach(() => {
  resetDb(now)
})

const user = (id: string) => {
  const u = getDb().users.find((x) => x.id === id)
  if (!u) throw new Error(`usuário ${id} inexistente`)
  return u
}

describe('login', () => {
  it('aceita a conta de demonstração com a senha correta', async () => {
    const u = await login('mariana@email.com', 'mentcare123', 'patient')
    expect(u.id).toBe('p1')
  })
  it('rejeita senha errada e perfil errado com a mesma mensagem', async () => {
    await expect(login('mariana@email.com', 'errada123', 'patient')).rejects.toThrow(
      'E-mail, senha ou perfil inválidos.',
    )
    await expect(login('mariana@email.com', 'mentcare123', 'manager')).rejects.toThrow(
      'E-mail, senha ou perfil inválidos.',
    )
    await expect(login('naoexiste@x.com', 'mentcare123', 'patient')).rejects.toThrow(
      'E-mail, senha ou perfil inválidos.',
    )
  })
})

describe('registerPatient', () => {
  const valid = {
    name: 'João Silva',
    cpf: '529.982.247-25',
    birth: '1990-01-01',
    email: 'joao@email.com',
    password: 'senha-forte-1',
    insurance: 'SUS',
    city: 'São Paulo',
  }
  it('rejeita CPF inválido, senha curta e duplicidade', async () => {
    await expect(registerPatient({ ...valid, cpf: '111.111.111-11' }, now)).rejects.toThrow(
      'CPF inválido',
    )
    await expect(
      registerPatient({ ...valid, cpf: '390.533.447-05', password: '123' }, now),
    ).rejects.toThrow('8 caracteres')
    await expect(registerPatient(valid, now)).rejects.toThrow('já cadastrado') // CPF da Mariana
  })
  it('cria o paciente guardando apenas o hash da senha', async () => {
    const u = await registerPatient({ ...valid, cpf: '390.533.447-05' }, now)
    expect(u.passHash.startsWith('pbkdf2$')).toBe(true)
    expect(JSON.stringify(getDb())).not.toContain('senha-forte-1')
    await expect(login('joao@email.com', 'senha-forte-1', 'patient')).resolves.toBeTruthy()
  })
})

describe('agendamento', () => {
  const slot = { clinicId: 'c1', professionalId: 'd1', date: '2026-11-12', time: '10:00' }

  it('agenda um horário livre e impede reservar o mesmo horário de novo', async () => {
    bookAppointment('p1', slot, now)
    expect(() => bookAppointment('p1', slot, now)).toThrow(AppError)
  })
  it('só paciente agenda', () => {
    expect(() => bookAppointment('d1', slot, now)).toThrow('permissão')
    expect(() => bookAppointment('m1', slot, now)).toThrow('permissão')
  })
  it('não oferece horário que já passou nem de outra clínica', () => {
    expect(() => bookAppointment('p1', { ...slot, date: '2026-11-09' }, now)).toThrow(AppError)
    expect(() => bookAppointment('p1', { ...slot, clinicId: 'c2' }, now)).toThrow(AppError)
  })
  it('cada perfil lista só as consultas que lhe pertencem', () => {
    expect(listAppointments(user('p1')).length).toBeGreaterThan(0)
    expect(listAppointments(user('d2'))).toHaveLength(0)
  })
})

describe('cancelamento e remarcação (regra de 24h)', () => {
  it('bloqueia com menos de 24h e permite com 24h ou mais', () => {
    const late = new Date(2026, 10, 10, 15, 0) // 23h antes
    expect(() => cancelAppointment('p1', 'ap1', late)).toThrow('24 horas')
    expect(() => rescheduleAppointment('p1', 'ap1', 'a2', late)).toThrow('24 horas')
    cancelAppointment('p1', 'ap1', now)
    expect(getDb().appointments.find((a) => a.id === 'ap1')?.status).toBe('cancelled')
  })
  it('remarca para um horário livre e recusa horário de outro profissional', () => {
    expect(() => rescheduleAppointment('p1', 'ap1', 'a4', now)).toThrow(AppError) // a4 é do d2
    rescheduleAppointment('p1', 'ap1', 'a2', now)
    expect(getDb().appointments.find((a) => a.id === 'ap1')?.time).toBe('10:00')
  })
  it('outro paciente não altera a consulta alheia', async () => {
    const outro = await registerPatient(
      {
        name: 'Outro',
        cpf: '390.533.447-05',
        birth: '1990-01-01',
        email: 'o@x.com',
        password: 'senha-forte-1',
        insurance: 'SUS',
        city: 'SP',
      },
      now,
    )
    expect(() => cancelAppointment(outro.id, 'ap1', now)).toThrow('não encontrada')
  })
})

describe('prontuário', () => {
  it('somente o profissional responsável registra; consulta vira realizada', () => {
    expect(() =>
      saveRecord('d2', { appointmentId: 'ap1', text: 'x', hypothesis: '' }, now),
    ).toThrow('responsável')
    expect(() =>
      saveRecord('p1', { appointmentId: 'ap1', text: 'x', hypothesis: '' }, now),
    ).toThrow('permissão')
    saveRecord('d1', { appointmentId: 'ap1', text: 'Boa evolução', hypothesis: '' }, now)
    expect(getDb().appointments.find((a) => a.id === 'ap1')?.status).toBe('completed')
    expect(() =>
      saveRecord('d1', { appointmentId: 'ap1', text: 'de novo', hypothesis: '' }, now),
    ).toThrow(AppError)
  })
  it('adendo preserva o texto original e só o dono pode adicionar', () => {
    const original = getDb().records.find((r) => r.id === 'r0')?.text
    addAddendum('d1', 'r0', 'Correção posterior', now)
    const rec = getDb().records.find((r) => r.id === 'r0')
    expect(rec?.text).toBe(original)
    expect(rec?.addenda).toEqual([{ date: '2026-11-10', text: 'Correção posterior' }])
    expect(() => addAddendum('d2', 'r0', 'invasor', now)).toThrow('não encontrado')
    expect(() => addAddendum('p1', 'r0', 'paciente', now)).toThrow('permissão')
  })
  it('isola a visibilidade: profissional não vê registros de outro; gestor não vê nenhum', () => {
    expect(listRecords(user('p1')).map((r) => r.id)).toContain('r0')
    expect(listRecords(user('d1')).map((r) => r.id)).toContain('r0')
    expect(listRecords(user('d2'))).toHaveLength(0)
    expect(listRecords(user('m1'))).toHaveLength(0)
  })
})

describe('avaliação', () => {
  it('só consulta realizada, uma vez, e nota de 1 a 5', () => {
    expect(() => rateAppointment('p1', { appointmentId: 'ap1', stars: 5, comment: '' })).toThrow(
      'realizadas',
    )
    expect(() => rateAppointment('p1', { appointmentId: 'ap0', stars: 6, comment: '' })).toThrow(
      '1 a 5',
    )
    rateAppointment('p1', { appointmentId: 'ap0', stars: 5, comment: 'ótimo' })
    expect(() => rateAppointment('p1', { appointmentId: 'ap0', stars: 4, comment: '' })).toThrow(
      'já foi avaliada',
    )
  })
})

describe('gestão da clínica', () => {
  it('gestor só administra profissionais da própria clínica', () => {
    expect(() => addAvailability('m1', 'd2', '2026-11-20', '09:00', now)).toThrow('não pertence')
    addAvailability('m1', 'd1', '2026-11-20', '09:00', now)
    expect(() => addAvailability('m1', 'd1', '2026-11-20', '09:00', now)).toThrow(
      'já foi cadastrado',
    )
    expect(() => addAvailability('m1', 'd1', '2026-11-09', '09:00', now)).toThrow('futura')
  })
  it('não remove horário com consulta agendada', () => {
    expect(() => removeAvailability('m1', 'a1')).toThrow('não pode ser removido')
  })
  it('cria profissional com senha própria (sem senha padrão)', async () => {
    await expect(
      addProfessional('m1', {
        name: 'Novo',
        email: 'novo@x.com',
        specialty: 'Psicologia',
        password: '123',
      }),
    ).rejects.toThrow('8 caracteres')
    const p = await addProfessional('m1', {
      name: 'Novo',
      email: 'novo@x.com',
      specialty: 'Psicologia',
      password: 'senha-forte-1',
    })
    await expect(login('novo@x.com', 'mentcare123', 'professional')).rejects.toThrow()
    await expect(login(p.email, 'senha-forte-1', 'professional')).resolves.toBeTruthy()
  })
  it('paciente não gerencia a clínica', () => {
    expect(() => addAvailability('p1', 'd1', '2026-11-20', '09:00', now)).toThrow('permissão')
  })
})
