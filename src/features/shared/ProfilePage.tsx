import { useUser } from '../../app/AuthContext'
import { PageHeading } from '../../components/ui'
import { ROLE_LABEL } from '../../domain/types'

/** Exibe só os 3 últimos dígitos do CPF (minimização de dados). */
const maskCpf = (cpf?: string) => (cpf ? `•••.•••.${cpf.slice(6, 9)}-••` : '—')

export function ProfilePage() {
  const user = useUser()
  return (
    <>
      <PageHeading role={user.role} title="Meu perfil" subtitle="Confira seus dados de cadastro." />
      <div className="card">
        <p>
          <b>Nome:</b> {user.name}
        </p>
        <p>
          <b>E-mail:</b> {user.email}
        </p>
        <p>
          <b>Perfil:</b> {ROLE_LABEL[user.role]}
        </p>
        {user.role === 'patient' && (
          <>
            <p>
              <b>CPF:</b> {maskCpf(user.cpf)}
            </p>
            <p>
              <b>Convênio:</b> {user.insurance ?? 'Não informado'}
            </p>
            <p>
              <b>Cidade:</b> {user.city ?? '—'}
            </p>
          </>
        )}
      </div>
    </>
  )
}
