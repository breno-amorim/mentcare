import { Link } from 'react-router-dom'
import { useUser } from '../../app/AuthContext'
import { PageHeading, Stat } from '../../components/ui'
import { appointmentsFor, clinicRating, professionalsOf } from '../../data/selectors'
import { useData } from '../../data/snapshot'

export function ManagerHome() {
  const user = useUser()
  const data = useData()
  const avg = user.clinicId ? clinicRating(data, user.clinicId) : 0

  return (
    <>
      <PageHeading
        role="manager"
        title="Painel da clínica"
        subtitle="Gerencie profissionais, dados do estabelecimento e atendimentos."
      />
      <div className="grid stats">
        <Stat label="Profissionais" value={professionalsOf(data, user.clinicId).length} icon="♙" />
        <Stat label="Consultas" value={appointmentsFor(data, user).length} icon="▣" />
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
