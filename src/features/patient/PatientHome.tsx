import { Link } from 'react-router-dom'
import { useUser } from '../../app/AuthContext'
import { Empty, PageHeading, Stat } from '../../components/ui'
import { addDays } from '../../domain/dates'
import { appointmentsFor } from '../../data/selectors'
import { useData } from '../../data/snapshot'
import { useNow } from '../../app/useNow'
import { AppointmentCard } from '../shared/AppointmentCard'

export function PatientHome() {
  const user = useUser()
  const db = useData()
  const now = useNow()
  const mine = appointmentsFor(db, user)
  const upcoming = mine
    .filter((a) => a.status === 'scheduled')
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
  const done = mine.filter((a) => a.status === 'completed').length
  const tomorrow = addDays(now, 1)
  const reminders = upcoming.filter((a) => a.date === tomorrow)
  const recordCount = db.records.filter((r) => r.patientId === user.id).length

  return (
    <>
      <PageHeading
        role="patient"
        title={`Olá, ${user.name.split(' ')[0]} 👋`}
        subtitle="Seu cuidado merece espaço na rotina. Vamos dar o próximo passo?"
        action={
          <Link className="btn" to="/buscar">
            + Agendar consulta
          </Link>
        }
      />
      <div className="grid stats">
        <Stat label="Próximas consultas" value={upcoming.length} icon="▣" />
        <Stat label="Consultas realizadas" value={done} icon="✓" />
        <Stat label="Registros no prontuário" value={recordCount} icon="▤" />
      </div>
      {reminders.length > 0 && (
        <div className="notice">
          🔔 <b>Lembrete demonstrativo:</b> você tem {reminders.length} consulta(s) amanhã. O envio
          real de e-mail ficará para a próxima versão.
        </div>
      )}
      <div className="grid two">
        <div className="card">
          <h2>Próximas consultas</h2>
          {upcoming.length ? (
            upcoming.slice(0, 3).map((a) => <AppointmentCard key={a.id} appt={a} />)
          ) : (
            <Empty title="Nenhuma consulta agendada">
              Encontre uma clínica e escolha seu horário.
            </Empty>
          )}
        </div>
        <div className="card">
          <h2>Encontre atendimento</h2>
          <p className="muted">
            Busque profissionais de psicologia e psiquiatria por cidade e convênio.
          </p>
          <div className="notice">
            Seu convênio cadastrado: <b>{user.insurance ?? 'Não informado'}</b>
          </div>
          <Link className="btn" to="/buscar">
            Buscar clínicas
          </Link>
        </div>
      </div>
    </>
  )
}
