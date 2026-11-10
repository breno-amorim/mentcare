import { Link } from 'react-router-dom'
import { useUser } from '../../app/AuthContext'
import { PageHeading, Stat } from '../../components/ui'
import { averageRating } from '../../domain/booking'
import { listAppointments } from '../../services/appointments'
import { listProfessionals, ratingsOf } from '../../services/clinics'
import { useDb } from '../../services/store'

export function ManagerHome() {
  const user = useUser()
  useDb()
  const avg = user.clinicId ? averageRating(ratingsOf(user.clinicId)) : 0

  return (
    <>
      <PageHeading
        role="manager"
        title="Painel da clínica"
        subtitle="Gerencie profissionais, dados do estabelecimento e atendimentos."
      />
      <div className="grid stats">
        <Stat label="Profissionais" value={listProfessionals(user).length} icon="♙" />
        <Stat label="Consultas" value={listAppointments(user).length} icon="▣" />
        <Stat label="Avaliação média" value={avg.toFixed(1)} icon="★" />
      </div>
      <div className="card">
        <h2>Acesso rápido</h2>
        <div className="actions">
          <Link className="btn" to="/clinica">
            Editar clínica
          </Link>
          <Link className="btn secondary" to="/profissionais">
            Gerenciar profissionais
          </Link>
        </div>
      </div>
    </>
  )
}
