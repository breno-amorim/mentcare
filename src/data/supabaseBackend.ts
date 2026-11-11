import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type {
  Appointment,
  Availability,
  Clinic,
  MedicalRecord,
  Rating,
  Role,
  Snapshot,
  Specialty,
  User,
} from '../domain/types'
import { AppError } from '../services/errors'
import type { Backend } from './backend'

const GENERIC = 'Não foi possível concluir a ação. Tente novamente.'
// Mensagens internas do Postgres/PostgREST não devem chegar ao usuário.
const INTERNAL = /^(permission denied|new row violates|duplicate key|violates|JWT|invalid input)/i

interface DbError {
  message: string
  code?: string
}

/** Mensagens das funções do banco (em português) são seguras; o resto vira texto genérico. */
function fail(error: DbError, fallback = GENERIC): never {
  throw new AppError(INTERNAL.test(error.message) ? fallback : error.message || fallback)
}

const hhmm = (t: string) => t.slice(0, 5)

interface ProfileRow {
  id: string
  role: Role
  full_name: string
  specialty: Specialty | null
  clinic_id: string | null
}

function toUser(p: ProfileRow, email = ''): User {
  return {
    id: p.id,
    role: p.role,
    name: p.full_name,
    email,
    specialty: p.specialty ?? undefined,
    clinicId: p.clinic_id ?? undefined,
  }
}

export function createSupabaseBackend(url: string, anonKey: string): Backend {
  const sb: SupabaseClient = createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  })

  /** Perfil + dados do paciente do usuário autenticado. */
  async function loadCurrentUser(): Promise<User | null> {
    const { data: auth } = await sb.auth.getUser()
    if (!auth.user) return null
    const { data: profile, error } = await sb
      .from('profiles')
      .select('id, role, full_name, specialty, clinic_id')
      .eq('id', auth.user.id)
      .maybeSingle<ProfileRow>()
    if (error) fail(error)
    if (!profile) return null
    const user = toUser(profile, auth.user.email ?? '')
    if (profile.role === 'patient') {
      const { data: d } = await sb
        .from('patient_details')
        .select('cpf, birth_date, insurance, city')
        .eq('user_id', profile.id)
        .maybeSingle()
      if (d) {
        user.cpf = d.cpf as string
        user.birth = d.birth_date as string
        user.insurance = d.insurance as string
        user.city = d.city as string
      }
    }
    return user
  }

  const rpc = async (fn: string, args: Record<string, unknown>) => {
    const { data, error } = await sb.rpc(fn, args)
    if (error) fail(error)
    return data
  }

  return {
    isDemo: false,
    canCreateProfessionals: false,

    restoreSession: loadCurrentUser,

    async signIn(email, password) {
      const { error } = await sb.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })
      if (error) {
        if (/not confirmed/i.test(error.message))
          throw new AppError('Confirme seu e-mail antes de entrar (veja a caixa de entrada).')
        throw new AppError('E-mail ou senha inválidos.')
      }
      const user = await loadCurrentUser()
      if (!user) throw new AppError('Perfil não encontrado. Fale com o administrador.')
      return user
    },

    async signUp(input) {
      const { data, error } = await sb.auth.signUp({
        email: input.email.trim().toLowerCase(),
        password: input.password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            full_name: input.name.trim(),
            cpf: input.cpf.replace(/\D/g, ''),
            birth_date: input.birth,
            insurance: input.insurance,
            city: input.city.trim(),
          },
        },
      })
      if (error) {
        if (/password/i.test(error.message))
          throw new AppError('Senha fraca: use 8+ caracteres com maiúsculas, minúsculas e números.')
        // CPF inválido/duplicado falham no gatilho do banco; não revelamos qual.
        throw new AppError('Não foi possível concluir o cadastro. Confira CPF, e-mail e senha.')
      }
      // Com confirmação de e-mail ligada não há sessão até o usuário confirmar.
      return data.session ? await loadCurrentUser() : null
    },

    async signOut() {
      await sb.auth.signOut()
    },

    async load(): Promise<Snapshot> {
      const me = await loadCurrentUser()
      const [profiles, clinics, slots, appts, recs, addenda, ratings, summary] = await Promise.all([
        sb.from('profiles').select('id, role, full_name, specialty, clinic_id'),
        sb.from('clinics').select('*'),
        sb.from('availability_slots').select('*'),
        sb.from('appointments').select('*'),
        sb.from('medical_records').select('*'),
        sb.from('record_addenda').select('*').order('created_at'),
        sb.from('ratings').select('*'),
        sb.rpc('clinic_ratings'),
      ])
      for (const r of [profiles, clinics, slots, appts, recs, addenda, ratings, summary]) {
        if (r.error) fail(r.error)
      }

      // E-mails de profissionais só chegam ao gestor da própria clínica (função do servidor).
      const emails = new Map<string, string>()
      if (me?.role === 'manager') {
        const { data, error } = await sb.rpc('clinic_professionals')
        if (error) fail(error)
        for (const p of (data ?? []) as { id: string; email: string }[]) emails.set(p.id, p.email)
      }

      const users = ((profiles.data ?? []) as ProfileRow[]).map((p) =>
        p.id === me?.id ? me : toUser(p, emails.get(p.id) ?? ''),
      )
      const addendaByRecord = new Map<string, MedicalRecord['addenda']>()
      for (const a of (addenda.data ?? []) as {
        record_id: string
        created_at: string
        content: string
      }[]) {
        const list = addendaByRecord.get(a.record_id) ?? []
        list.push({ date: a.created_at.slice(0, 10), text: a.content })
        addendaByRecord.set(a.record_id, list)
      }

      return {
        users,
        clinics: ((clinics.data ?? []) as Record<string, unknown>[]).map((c): Clinic => ({
          id: c.id as string,
          name: c.name as string,
          city: c.city as string,
          address: c.address as string,
          insurance: c.insurance as string[],
          specialties: c.specialties as string[],
          modes: c.modes as string[],
          approved: c.approved as boolean,
        })),
        availability: ((slots.data ?? []) as Record<string, string>[]).map((s): Availability => ({
          id: s.id!,
          professionalId: s.professional_id!,
          date: s.slot_date!,
          time: hhmm(s.slot_time!),
        })),
        appointments: ((appts.data ?? []) as Record<string, string>[]).map((a): Appointment => ({
          id: a.id!,
          patientId: a.patient_id!,
          professionalId: a.professional_id!,
          clinicId: a.clinic_id!,
          date: a.appt_date!,
          time: hhmm(a.appt_time!),
          status: a.status as Appointment['status'],
          createdAt: a.created_at!.slice(0, 10),
        })),
        records: ((recs.data ?? []) as Record<string, string>[]).map((r): MedicalRecord => ({
          id: r.id!,
          appointmentId: r.appointment_id!,
          patientId: r.patient_id!,
          professionalId: r.professional_id!,
          date: r.record_date!,
          text: r.content!,
          hypothesis: r.hypothesis ?? '',
          addenda: addendaByRecord.get(r.id!) ?? [],
        })),
        ratings: ((ratings.data ?? []) as Record<string, unknown>[]).map((r): Rating => ({
          id: r.id as string,
          appointmentId: r.appointment_id as string,
          clinicId: r.clinic_id as string,
          patientId: r.patient_id as string,
          stars: r.stars as number,
          comment: (r.comment as string) ?? '',
        })),
        ratingSummary: Object.fromEntries(
          (
            (summary.data ?? []) as { clinic_id: string; avg_stars: string; rating_count: number }[]
          ).map((s) => [s.clinic_id, { avg: Number(s.avg_stars), count: s.rating_count }]),
        ),
      }
    },

    async bookAppointment(input) {
      await rpc('book_appointment', {
        p_professional_id: input.professionalId,
        p_date: input.date,
        p_time: input.time,
      })
    },
    async cancelAppointment(id) {
      await rpc('cancel_appointment', { p_id: id })
    },
    async rescheduleAppointment(id, date, time) {
      await rpc('reschedule_appointment', { p_id: id, p_date: date, p_time: time })
    },
    async saveRecord(input) {
      await rpc('save_medical_record', {
        p_appointment_id: input.appointmentId,
        p_content: input.text,
        p_hypothesis: input.hypothesis,
      })
    },
    async addAddendum(recordId, text) {
      await rpc('add_addendum', { p_record_id: recordId, p_content: text })
    },
    async rateAppointment(input) {
      await rpc('rate_appointment', {
        p_appointment_id: input.appointmentId,
        p_stars: input.stars,
        p_comment: input.comment,
      })
    },

    async saveClinic(input) {
      const split = (v: string) =>
        v
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean)
      const specialties = split(input.specialties)
      if (!specialties.length) throw new AppError('Informe ao menos uma especialidade.')
      const me = await loadCurrentUser()
      if (!me?.clinicId) {
        await rpc('create_clinic', {
          p_name: input.name,
          p_city: input.city,
          p_address: input.address,
          p_insurance: split(input.insurance),
          p_specialties: specialties,
        })
        return
      }
      const { data, error } = await sb
        .from('clinics')
        .update({
          name: input.name.trim(),
          city: input.city.trim(),
          address: input.address.trim(),
          insurance: split(input.insurance),
          specialties,
        })
        .eq('id', me.clinicId)
        .select('id')
      if (error)
        fail(error, 'Confira os dados da clínica (nome, cidade e endereço são obrigatórios).')
      if (!data?.length) throw new AppError('Você não tem permissão para editar esta clínica.')
    },

    async addProfessional() {
      throw new AppError(
        'O cadastro de profissionais por convite de e-mail será habilitado na próxima etapa. ' +
          'Por enquanto, o administrador do projeto promove a conta (veja supabase/README.md).',
      )
    },

    async addAvailability(professionalId, date, time) {
      const { error } = await sb
        .from('availability_slots')
        .insert({ professional_id: professionalId, slot_date: date, slot_time: time })
      if (error) {
        if (error.code === '23505') throw new AppError('Este horário já foi cadastrado.')
        throw new AppError(
          'Não foi possível adicionar: use uma data futura (até 90 dias) e um profissional da sua clínica.',
        )
      }
    },

    async removeAvailability(slotId) {
      const { data, error } = await sb
        .from('availability_slots')
        .delete()
        .eq('id', slotId)
        .select('id')
      if (error) fail(error)
      if (!data?.length)
        throw new AppError('Este horário possui uma consulta agendada e não pode ser removido.')
    },
  }
}
