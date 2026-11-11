import { useState } from 'react'
import { useUser } from '../../app/AuthContext'
import { Empty, Field, PageHeading } from '../../components/ui'
import {
  ALL_INSURANCES,
  ALL_SPECIALTIES,
  filterClinics,
  type ClinicFilters,
} from '../../domain/booking'
import { INSURANCES, SPECIALTIES } from '../../domain/types'
import { clinicRating } from '../../data/selectors'
import { useData } from '../../data/snapshot'
import { BookingModal } from './BookingModal'

export function SearchPage() {
  const user = useUser()
  const db = useData()
  const initial: ClinicFilters = {
    query: '',
    city: user.city ?? '',
    insurance: user.insurance ?? ALL_INSURANCES,
    specialty: ALL_SPECIALTIES,
  }
  const [draft, setDraft] = useState(initial)
  const [applied, setApplied] = useState(initial)
  const [bookingClinicId, setBookingClinicId] = useState<string | null>(null)

  const avg = (id: string) => clinicRating(db, id)
  const list = filterClinics(db.clinics, applied, avg)
  const set = (key: keyof ClinicFilters) => (value: string) =>
    setDraft((d) => ({ ...d, [key]: value }))

  return (
    <>
      <PageHeading
        role="patient"
        title="Encontre seu atendimento"
        subtitle="Clínicas e profissionais que combinam com o que você precisa."
      />
      <div className="card">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            setApplied(draft)
          }}
        >
          <div className="filters">
            <Field label="Nome da clínica" htmlFor="sq">
              <input
                id="sq"
                placeholder="Buscar clínica..."
                value={draft.query}
                onChange={(e) => set('query')(e.target.value)}
              />
            </Field>
            <Field label="Cidade" htmlFor="sc">
              <input
                id="sc"
                placeholder="Todas as cidades"
                value={draft.city}
                onChange={(e) => set('city')(e.target.value)}
              />
            </Field>
            <Field label="Convênio / modalidade" htmlFor="si">
              <select
                id="si"
                value={draft.insurance}
                onChange={(e) => set('insurance')(e.target.value)}
              >
                {[ALL_INSURANCES, ...INSURANCES].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Field>
            <Field label="Especialidade" htmlFor="ss">
              <select
                id="ss"
                value={draft.specialty}
                onChange={(e) => set('specialty')(e.target.value)}
              >
                {[ALL_SPECIALTIES, ...SPECIALTIES].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="row">
            <span className="muted">{list.length} clínica(s) encontrada(s)</span>
            <button className="btn secondary small">Aplicar filtros</button>
          </div>
        </form>

        {list.length ? (
          list.map((c) => {
            const rating = avg(c.id)
            return (
              <div className="clinic" key={c.id}>
                <div className="clinic-icon" aria-hidden="true">
                  ✚
                </div>
                <div>
                  <div className="row" style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
                    <h3>{c.name}</h3>
                    {rating ? (
                      <span className="stars" aria-label={`Nota média ${rating.toFixed(1)}`}>
                        ★ {rating.toFixed(1)}
                      </span>
                    ) : (
                      <span className="muted">Sem avaliações</span>
                    )}
                  </div>
                  <div className="clinic-meta">
                    📍 {c.address} · {c.city}
                  </div>
                  <div className="clinic-meta">Especialidades: {c.specialties.join(', ')}</div>
                  <div className="clinic-meta">Aceita: {c.insurance.join(' · ')}</div>
                </div>
                <div className="actions">
                  <button
                    type="button"
                    className="btn small"
                    onClick={() => setBookingClinicId(c.id)}
                  >
                    Ver horários
                  </button>
                </div>
              </div>
            )
          })
        ) : (
          <Empty title="Nenhuma clínica encontrada">Tente remover ou alterar os filtros.</Empty>
        )}
      </div>

      {bookingClinicId && (
        <BookingModal clinicId={bookingClinicId} onClose={() => setBookingClinicId(null)} />
      )}
    </>
  )
}
