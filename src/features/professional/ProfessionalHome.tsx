import { Link } from 'react-router-dom'
import { useUser } from '../../app/AuthContext'
import { Empty, PageHeading, Stat } from '../../components/ui'
import { listAppointments } from '../../services/appointments'
import { useDb } from '../../services/store'
import { AppointmentCard } from '../shared/AppointmentCard'

export function ProfessionalHome() {
  const user = useUser()
  useDb()
  const mine = listAppointments(user)
  const upcoming = mine
    .filter((a) => a.status === 'scheduled')
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))

  return (
    <>
      <PageHeading
        role="professional"
        title={`Olá, ${user.name.split(' ')[0]}`}
        subtitle="Acompanhe sua agenda e os registros dos pacientes."
      />
      <div className="grid stats">
        <Stat label="Consultas agendadas" value={upcoming.length} icon="▣" />
        <Stat
          label="Realizadas"
          value={mine.filter((a) => a.status === 'completed').length}
          icon="✓"
        />
        <Stat label="Pacientes" value={new Set(mine.map((a) => a.patientId)).size} icon="♙" />
      </div>
      <div className="card">
        <h2>Próximos atendimentos</h2>
        {upcoming.length ? (
          upcoming.slice(0, 4).map((a) => <AppointmentCard key={a.id} appt={a} />)
        ) : (
          <Empty>Nenhuma consulta próxima.</Empty>
        )}
        <Link className="btn secondary" to="/agenda">
          Abrir agenda
        </Link>
      </div>
    </>
  )
}
