import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useUser } from '../../app/AuthContext'
import { useToast } from '../../app/ToastContext'
import { Empty, ErrorBox, Field, PageHeading, StatusPill } from '../../components/ui'
import { Modal } from '../../components/Modal'
import { formatDate } from '../../domain/dates'
import type { Appointment } from '../../domain/types'
import { act } from '../../data/backend'
import { appointmentsFor, recordsFor } from '../../data/selectors'
import { useData } from '../../data/snapshot'
import { errorMessage } from '../../services/errors'

export function AgendaPage() {
  const user = useUser()
  const db = useData()
  const toast = useToast()
  const [recording, setRecording] = useState<Appointment | null>(null)
  const [error, setError] = useState('')

  const list = appointmentsFor(db, user)
    .filter((a) => a.status !== 'cancelled')
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
  // Apenas as evoluções que ESTE profissional registrou (nunca as de outros).
  const ownRecords = recordsFor(db, user)
  const lastNote = (patientId: string) =>
    ownRecords
      .filter((r) => r.patientId === patientId)
      .sort((x, y) => y.date.localeCompare(x.date))[0]?.text

  const close = () => {
    setRecording(null)
    setError('')
  }

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!recording) return
    const f = new FormData(e.currentTarget)
    try {
      await act((b) =>
        b.saveRecord({
          appointmentId: recording.id,
          text: String(f.get('text') ?? ''),
          hypothesis: String(f.get('hypothesis') ?? ''),
        }),
      )
      toast('Evolução registrada e consulta marcada como realizada.')
      close()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <>
      <PageHeading
        role="professional"
        title="Minha agenda"
        subtitle="Consultas agendadas e atendimentos do seu consultório."
      />
      <div className="card">
        <h2>Agenda de atendimentos</h2>
        {list.length ? (
          <table className="table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Paciente</th>
                <th>Horário</th>
                <th>Última evolução</th>
                <th>Status</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              {list.map((a) => (
                <tr key={a.id}>
                  <td>{formatDate(a.date)}</td>
                  <td>{db.users.find((u) => u.id === a.patientId)?.name}</td>
                  <td>{a.time}</td>
                  <td>{(lastNote(a.patientId) ?? '—').slice(0, 65)}</td>
                  <td>
                    <StatusPill status={a.status} />
                  </td>
                  <td>
                    {a.status === 'scheduled' ? (
                      <button type="button" className="btn small" onClick={() => setRecording(a)}>
                        Registrar evolução
                      </button>
                    ) : (
                      <Link className="btn secondary small" to="/prontuarios">
                        Ver prontuário
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty>Sua agenda está vazia.</Empty>
        )}
      </div>

      {recording && (
        <Modal title="Registrar evolução da sessão" onClose={close}>
          <p className="muted">
            Paciente: {db.users.find((u) => u.id === recording.patientId)?.name} ·{' '}
            {formatDate(recording.date)}
          </p>
          <form onSubmit={onSubmit}>
            <Field label="Evolução / observações clínicas" htmlFor="text">
              <textarea
                id="text"
                name="text"
                required
                maxLength={5000}
                placeholder="Registre a evolução do atendimento..."
              />
            </Field>
            <Field label="Hipótese diagnóstica (opcional)" htmlFor="hypothesis">
              <input id="hypothesis" name="hypothesis" maxLength={300} />
            </Field>
            <div className="warning">
              Após salvar, o registro original não poderá ser apagado ou editado. Correções futuras
              devem ser feitas por adendo datado.
            </div>
            <ErrorBox message={error} />
            <div className="modalfoot">
              <button type="button" className="btn ghost" onClick={close}>
                Cancelar
              </button>
              <button className="btn">Salvar registro</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
