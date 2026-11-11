import { useState, type FormEvent } from 'react'
import { useToast } from '../../app/ToastContext'
import { useUser } from '../../app/AuthContext'
import { ErrorBox, Field, StatusPill } from '../../components/ui'
import { Modal } from '../../components/Modal'
import { canChangeAppointment } from '../../domain/appointment-policy'
import { freeSlots } from '../../domain/booking'
import { formatDate } from '../../domain/dates'
import type { Appointment } from '../../domain/types'
import { act } from '../../data/backend'
import { useData } from '../../data/snapshot'
import { errorMessage } from '../../services/errors'
import { useNow } from '../../app/useNow'

type View = 'none' | 'details' | 'change' | 'reschedule' | 'rate'

export function AppointmentCard({ appt }: { appt: Appointment }) {
  const user = useUser()
  const db = useData()
  const toast = useToast()
  const [view, setView] = useState<View>('none')
  const [error, setError] = useState('')
  const close = () => {
    setView('none')
    setError('')
  }

  const clinic = db.clinics.find((c) => c.id === appt.clinicId)
  const professional = db.users.find((u) => u.id === appt.professionalId)
  const canRate =
    user.role === 'patient' &&
    appt.status === 'completed' &&
    !db.ratings.some((r) => r.appointmentId === appt.id)

  const run = async (action: () => Promise<void>, success: string) => {
    try {
      await action()
      toast(success)
      close()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  const onReschedule = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const slotId = String(new FormData(e.currentTarget).get('slot') ?? '')
    const slot = slots.find((s) => s.id === slotId)
    if (!slot) {
      setError('Escolha um horário disponível.')
      return
    }
    void run(
      () => act((b) => b.rescheduleAppointment(appt.id, slot.date, slot.time)),
      'Consulta remarcada!',
    )
  }

  const onRate = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    void run(
      () =>
        act((b) =>
          b.rateAppointment({
            appointmentId: appt.id,
            stars: Number(f.get('stars')),
            comment: String(f.get('comment') ?? ''),
          }),
        ),
      'Obrigado pela avaliação!',
    )
  }

  const now = useNow()
  const slots = freeSlots(db.availability, db.appointments, appt.professionalId, now, appt.id)

  return (
    <div className="item">
      <div className="row">
        <b>{clinic?.name ?? 'Clínica'}</b>
        <StatusPill status={appt.status} />
      </div>
      <div className="muted">
        {professional?.name ?? 'Profissional'} · {professional?.specialty ?? ''}
      </div>
      <div style={{ marginTop: 7 }}>
        📅 {formatDate(appt.date)} às {appt.time}
      </div>
      <div className="actions" style={{ marginTop: 10 }}>
        <button type="button" className="btn secondary small" onClick={() => setView('details')}>
          Detalhes
        </button>
        {appt.status === 'scheduled' && user.role === 'patient' && (
          <button type="button" className="btn ghost small" onClick={() => setView('change')}>
            Cancelar / remarcar
          </button>
        )}
      </div>

      {view === 'details' && (
        <Modal title="Detalhes da consulta" onClose={close}>
          <p>
            <b>Clínica:</b> {clinic?.name}
          </p>
          <p>
            <b>Profissional:</b> {professional?.name}
          </p>
          <p>
            <b>Data:</b> {formatDate(appt.date)} às {appt.time}
          </p>
          <p>
            <b>Status:</b> <StatusPill status={appt.status} />
          </p>
          {canRate && (
            <button type="button" className="btn" onClick={() => setView('rate')}>
              Avaliar clínica
            </button>
          )}
        </Modal>
      )}

      {view === 'change' && (
        <Modal title="Cancelar ou remarcar" onClose={close}>
          {canChangeAppointment(appt.date, appt.time, now) ? (
            <>
              <p>
                O que deseja fazer com a consulta de {formatDate(appt.date)} às {appt.time}?
              </p>
              <ErrorBox message={error} />
              <div className="actions">
                <button
                  type="button"
                  className="btn danger"
                  onClick={() =>
                    void run(
                      () => act((b) => b.cancelAppointment(appt.id)),
                      'Consulta cancelada; horário liberado.',
                    )
                  }
                >
                  Cancelar consulta
                </button>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => setView('reschedule')}
                >
                  Remarcar
                </button>
                <button type="button" className="btn ghost" onClick={close}>
                  Voltar
                </button>
              </div>
            </>
          ) : (
            <div className="warning">
              Cancelamento e remarcação exigem pelo menos 24 horas de antecedência. Para esta
              consulta, fale diretamente com a clínica.
            </div>
          )}
        </Modal>
      )}

      {view === 'reschedule' && (
        <Modal title="Remarcar consulta" onClose={close}>
          <form onSubmit={onReschedule}>
            <Field label="Novo horário" htmlFor="slot">
              <select id="slot" name="slot" required disabled={!slots.length}>
                {slots.map((s) => (
                  <option key={s.id} value={s.id}>
                    {formatDate(s.date)} às {s.time}
                  </option>
                ))}
              </select>
            </Field>
            {!slots.length && <div className="warning">Não há outros horários livres.</div>}
            <ErrorBox message={error} />
            <div className="modalfoot">
              <button type="button" className="btn ghost" onClick={close}>
                Voltar
              </button>
              <button className="btn" disabled={!slots.length}>
                Confirmar
              </button>
            </div>
          </form>
        </Modal>
      )}

      {view === 'rate' && (
        <Modal title="Avaliar atendimento" onClose={close}>
          <form onSubmit={onRate}>
            <Field label="Sua nota (1 a 5 estrelas)" htmlFor="stars">
              <select id="stars" name="stars" defaultValue="5">
                <option value="5">5 — Excelente</option>
                <option value="4">4 — Muito bom</option>
                <option value="3">3 — Bom</option>
                <option value="2">2 — Regular</option>
                <option value="1">1 — Ruim</option>
              </select>
            </Field>
            <Field label="Comentário (opcional)" htmlFor="comment">
              <textarea id="comment" name="comment" maxLength={500} />
            </Field>
            <ErrorBox message={error} />
            <div className="modalfoot">
              <button type="button" className="btn ghost" onClick={close}>
                Cancelar
              </button>
              <button className="btn">Enviar avaliação</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
