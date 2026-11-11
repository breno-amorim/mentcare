import { useUser } from '../../app/AuthContext'
import { Empty, PageHeading } from '../../components/ui'
import { listAppointments } from '../../services/appointments'
import { useDb } from '../../services/store'
import { AppointmentCard } from '../shared/AppointmentCard'

export function AppointmentsPage() {
  const user = useUser()
  useDb() // reavalia a lista quando o armazenamento muda
  const list = listAppointments(user).sort((a, b) =>
    (b.date + b.time).localeCompare(a.date + a.time),
  )

  return (
    <>
      <PageHeading
        role="patient"
        title="Minhas consultas"
        subtitle="Acompanhe seus agendamentos e o histórico de atendimentos."
      />
      <div className="card">
        <h2>Histórico de consultas</h2>
        {list.length ? (
          list.map((a) => <AppointmentCard key={a.id} appt={a} />)
        ) : (
          <Empty>Você ainda não possui consultas.</Empty>
        )}
      </div>
    </>
  )
}
