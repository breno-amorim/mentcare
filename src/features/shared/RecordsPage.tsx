import { useState, type FormEvent } from 'react'
import { useUser } from '../../app/AuthContext'
import { useToast } from '../../app/ToastContext'
import { Empty, ErrorBox, Field, PageHeading } from '../../components/ui'
import { Modal } from '../../components/Modal'
import { formatDate } from '../../domain/dates'
import { act } from '../../data/backend'
import { recordsFor } from '../../data/selectors'
import { useData } from '../../data/snapshot'
import { errorMessage } from '../../services/errors'

/** Prontuário: o paciente lê os seus; o profissional lê e complementa (por adendo) os que registrou. */
export function RecordsPage() {
  const user = useUser()
  const db = useData()
  const toast = useToast()
  const [addendumFor, setAddendumFor] = useState<string | null>(null)
  const [error, setError] = useState('')

  const rows = recordsFor(db, user).sort((a, b) => b.date.localeCompare(a.date))
  const isPatient = user.role === 'patient'
  const name = (id: string) => db.users.find((u) => u.id === id)?.name ?? ''

  const close = () => {
    setAddendumFor(null)
    setError('')
  }

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!addendumFor) return
    const text = String(new FormData(e.currentTarget).get('text') ?? '')
    try {
      await act((b) => b.addAddendum(addendumFor, text))
      toast('Adendo incluído no prontuário.')
      close()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <>
      <PageHeading
        role={user.role}
        title={isPatient ? 'Meu prontuário' : 'Prontuários dos meus pacientes'}
        subtitle="Registros de acompanhamento e evolução das sessões."
      />
      <div className="warning">
        Informações demonstrativas. Em produção, prontuários exigem controle de acesso,
        criptografia, auditoria e infraestrutura compatível com a LGPD.
      </div>
      <div className="card">
        <h2>Histórico de evoluções</h2>
        {rows.length ? (
          rows.map((r) => (
            <div className="item" key={r.id}>
              <div className="row">
                <b>
                  {formatDate(r.date)} · {name(r.professionalId)}
                </b>
                <span className="pill green">Registro salvo</span>
              </div>
              <div className="muted">Paciente: {name(r.patientId)}</div>
              <p>{r.text}</p>
              {r.hypothesis && (
                <div className="clinic-meta">Hipótese diagnóstica informada: {r.hypothesis}</div>
              )}
              {r.addenda.map((ad, i) => (
                <div className="notice" key={i}>
                  <b>Adendo · {formatDate(ad.date)}</b>
                  <br />
                  {ad.text}
                </div>
              ))}
              {user.role === 'professional' && (
                <button
                  type="button"
                  className="btn secondary small"
                  onClick={() => setAddendumFor(r.id)}
                >
                  Adicionar adendo
                </button>
              )}
            </div>
          ))
        ) : (
          <Empty title="Nenhum registro disponível">
            Os registros aparecerão aqui após as sessões.
          </Empty>
        )}
      </div>

      {addendumFor && (
        <Modal title="Adicionar adendo" onClose={close}>
          <form onSubmit={onSubmit}>
            <Field label="Complemento datado" htmlFor="text">
              <textarea id="text" name="text" required maxLength={5000} />
            </Field>
            <div className="warning">
              O registro original não é alterado: o adendo é acrescentado com a data de hoje.
            </div>
            <ErrorBox message={error} />
            <div className="modalfoot">
              <button type="button" className="btn ghost" onClick={close}>
                Cancelar
              </button>
              <button className="btn">Salvar adendo</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
