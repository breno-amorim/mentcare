import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../../app/AuthContext'
import { useToast } from '../../app/ToastContext'
import { ErrorBox, Field } from '../../components/ui'
import { Modal } from '../../components/Modal'
import { freeSlots } from '../../domain/booking'
import { formatDate } from '../../domain/dates'
import { bookAppointment } from '../../services/appointments'
import { errorMessage } from '../../services/errors'
import { useDb } from '../../services/store'
import { useNow } from '../../app/useNow'

export function BookingModal({ clinicId, onClose }: { clinicId: string; onClose: () => void }) {
  const user = useUser()
  const db = useDb()
  const now = useNow()
  const toast = useToast()
  const navigate = useNavigate()
  const clinic = db.clinics.find((c) => c.id === clinicId)
  const professionals = db.users.filter((u) => u.role === 'professional' && u.clinicId === clinicId)

  const [professionalId, setProfessionalId] = useState(professionals[0]?.id ?? '')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [error, setError] = useState('')

  const slots = freeSlots(db.availability, db.appointments, professionalId, now)
  const dates = [...new Set(slots.map((s) => s.date))]
  const activeDate = dates.includes(date) ? date : (dates[0] ?? '')
  const times = slots.filter((s) => s.date === activeDate).map((s) => s.time)
  const activeTime = times.includes(time) ? time : (times[0] ?? '')

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    try {
      bookAppointment(user.id, { clinicId, professionalId, date: activeDate, time: activeTime })
      toast('Consulta agendada com sucesso!')
      onClose()
      navigate('/consultas')
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  if (!clinic) return null
  return (
    <Modal title="Agendar consulta" onClose={onClose}>
      <p className="muted">
        {clinic.name} · {clinic.city}
      </p>
      <form onSubmit={onSubmit}>
        <Field label="Profissional" htmlFor="bp">
          <select
            id="bp"
            value={professionalId}
            onChange={(e) => setProfessionalId(e.target.value)}
            required
          >
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.specialty}
              </option>
            ))}
          </select>
        </Field>
        <div className="formgrid">
          <Field label="Data disponível" htmlFor="bd">
            <select id="bd" value={activeDate} onChange={(e) => setDate(e.target.value)} required>
              {dates.length ? (
                dates.map((d) => (
                  <option key={d} value={d}>
                    {formatDate(d)}
                  </option>
                ))
              ) : (
                <option value="">Sem horários livres</option>
              )}
            </select>
          </Field>
          <Field label="Horário" htmlFor="bt">
            <select id="bt" value={activeTime} onChange={(e) => setTime(e.target.value)} required>
              {times.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="notice">
          São exibidos horários disponíveis dos próximos 30 dias. Nenhum pagamento é realizado pela
          plataforma.
        </div>
        <ErrorBox message={error} />
        <div className="modalfoot">
          <button type="button" className="btn ghost" onClick={onClose}>
            Voltar
          </button>
          <button className="btn" disabled={!activeDate}>
            Confirmar agendamento
          </button>
        </div>
      </form>
    </Modal>
  )
}
