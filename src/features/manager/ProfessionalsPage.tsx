import { useState, type FormEvent } from 'react'
import { useUser } from '../../app/AuthContext'
import { useToast } from '../../app/ToastContext'
import { Empty, ErrorBox, Field, PageHeading } from '../../components/ui'
import { Modal } from '../../components/Modal'
import { addDays, formatDate, toLocalDateString } from '../../domain/dates'
import { SPECIALTIES, type Specialty } from '../../domain/types'
import { act, getBackend } from '../../data/backend'
import { professionalsOf } from '../../data/selectors'
import { useData } from '../../data/snapshot'
import { errorMessage } from '../../services/errors'
import { useNow } from '../../app/useNow'

function AvailabilityModal({
  professionalId,
  onClose,
}: {
  professionalId: string
  onClose: () => void
}) {
  const db = useData()
  const [error, setError] = useState('')
  const professional = db.users.find((u) => u.id === professionalId)
  const slots = db.availability
    .filter((s) => s.professionalId === professionalId)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
  const now = useNow()

  const guard = async (action: () => Promise<void>) => {
    try {
      await action()
      setError('')
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  const onAdd = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const f = new FormData(form)
    void guard(async () => {
      await act((b) =>
        b.addAvailability(professionalId, String(f.get('date')), String(f.get('time'))),
      )
      form.reset()
    })
  }

  return (
    <Modal title={`Disponibilidade — ${professional?.name ?? ''}`} onClose={onClose}>
      <form onSubmit={onAdd}>
        <div className="formgrid">
          <Field label="Adicionar data" htmlFor="avd">
            <input
              id="avd"
              name="date"
              type="date"
              required
              min={toLocalDateString(now)}
              max={addDays(now, 90)}
            />
          </Field>
          <Field label="Horário" htmlFor="avt">
            <input id="avt" name="time" type="time" defaultValue="09:00" required />
          </Field>
        </div>
        <button className="btn">Adicionar horário</button>
      </form>
      <ErrorBox message={error} />
      <h3 style={{ marginTop: 20 }}>Horários cadastrados</h3>
      {slots.length ? (
        slots.map((s) => (
          <div className="row item" key={s.id}>
            <span>
              {formatDate(s.date)} às {s.time}
            </span>
            <button
              type="button"
              className="btn danger small"
              onClick={() => void guard(() => act((b) => b.removeAvailability(s.id)))}
            >
              Remover
            </button>
          </div>
        ))
      ) : (
        <p className="muted">Nenhum horário cadastrado.</p>
      )}
      <div className="modalfoot">
        <button type="button" className="btn ghost" onClick={onClose}>
          Fechar
        </button>
      </div>
    </Modal>
  )
}

export function ProfessionalsPage() {
  const user = useUser()
  const data = useData()
  const toast = useToast()
  const [adding, setAdding] = useState(false)
  const [availabilityFor, setAvailabilityFor] = useState<string | null>(null)
  const [error, setError] = useState('')
  const list = professionalsOf(data, user.clinicId)

  const close = () => {
    setAdding(false)
    setError('')
  }

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    try {
      await act((b) =>
        b.addProfessional({
          name: String(f.get('name') ?? ''),
          email: String(f.get('email') ?? ''),
          specialty: f.get('specialty') as Specialty,
          password: String(f.get('password') ?? ''),
        }),
      )
      toast('Profissional cadastrado.')
      close()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <>
      <PageHeading
        role="manager"
        title="Profissionais"
        subtitle="Cadastre e gerencie os profissionais vinculados à clínica."
        action={
          <button type="button" className="btn" onClick={() => setAdding(true)}>
            + Adicionar profissional
          </button>
        }
      />
      <div className="card">
        {list.length ? (
          list.map((p) => (
            <div className="item row" key={p.id}>
              <div>
                <b>{p.name}</b>
                <div className="muted">
                  {p.specialty} · {p.email}
                </div>
              </div>
              <button
                type="button"
                className="btn secondary small"
                onClick={() => setAvailabilityFor(p.id)}
              >
                Disponibilidade
              </button>
            </div>
          ))
        ) : (
          <Empty>Nenhum profissional cadastrado.</Empty>
        )}
      </div>

      {adding && !getBackend().canCreateProfessionals && (
        <Modal title="Adicionar profissional" onClose={close}>
          <div className="warning">
            O cadastro de profissionais por convite de e-mail será habilitado na próxima etapa. Por
            enquanto, o administrador do projeto promove a conta do profissional (veja
            supabase/README.md).
          </div>
          <div className="modalfoot">
            <button type="button" className="btn ghost" onClick={close}>
              Fechar
            </button>
          </div>
        </Modal>
      )}

      {adding && getBackend().canCreateProfessionals && (
        <Modal title="Adicionar profissional" onClose={close}>
          <form onSubmit={onSubmit}>
            <Field label="Nome completo" htmlFor="pn">
              <input id="pn" name="name" required />
            </Field>
            <Field label="E-mail" htmlFor="pe">
              <input id="pe" name="email" type="email" required />
            </Field>
            <Field label="Especialidade" htmlFor="ps">
              <select id="ps" name="specialty">
                {SPECIALTIES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label="Senha inicial (mínimo 8 caracteres)" htmlFor="pp">
              <input
                id="pp"
                name="password"
                type="password"
                minLength={8}
                required
                autoComplete="new-password"
              />
            </Field>
            <ErrorBox message={error} />
            <div className="modalfoot">
              <button type="button" className="btn ghost" onClick={close}>
                Cancelar
              </button>
              <button className="btn">Cadastrar</button>
            </div>
          </form>
        </Modal>
      )}
      {availabilityFor && (
        <AvailabilityModal
          professionalId={availabilityFor}
          onClose={() => setAvailabilityFor(null)}
        />
      )}
    </>
  )
}
