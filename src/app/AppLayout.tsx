import { NavLink, Outlet } from 'react-router-dom'
import { ROLE_LABEL, type Role } from '../domain/types'
import { getBackend } from '../data/backend'
import { useAuth, useUser } from './AuthContext'

const MENUS: Record<Role, { to: string; icon: string; label: string }[]> = {
  patient: [
    { to: '/', icon: '⌂', label: 'Visão geral' },
    { to: '/buscar', icon: '⌕', label: 'Buscar clínicas' },
    { to: '/consultas', icon: '▣', label: 'Minhas consultas' },
    { to: '/prontuario', icon: '▤', label: 'Meu prontuário' },
  ],
  professional: [
    { to: '/', icon: '⌂', label: 'Visão geral' },
    { to: '/agenda', icon: '▦', label: 'Minha agenda' },
    { to: '/prontuarios', icon: '▤', label: 'Prontuários' },
  ],
  manager: [
    { to: '/', icon: '⌂', label: 'Visão geral' },
    { to: '/clinica', icon: '✚', label: 'Minha clínica' },
    { to: '/profissionais', icon: '♙', label: 'Profissionais' },
  ],
}

const navClass = ({ isActive }: { isActive: boolean }) => `nav${isActive ? ' active' : ''}`

export function AppLayout() {
  const user = useUser()
  const { signOut } = useAuth()

  const backend = getBackend()
  const onReset = async () => {
    if (confirm('Apagar os dados deste protótipo e restaurar a demonstração?')) {
      await backend.reset?.()
      await signOut()
    }
  }

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <div className="logo" aria-hidden="true">
            ✳
          </div>
          MentCare
        </div>
        <div className="topright">
          <span className="muted">{user.name}</span>
          <span className="pill">{ROLE_LABEL[user.role]}</span>
          <button type="button" className="btn ghost small" onClick={() => void signOut()}>
            Sair
          </button>
        </div>
      </header>
      <main className="shell">
        <div className="layout">
          <nav className="sidebar" aria-label="Menu principal">
            <div className="side-label">Menu principal</div>
            {MENUS[user.role].map((m) => (
              <NavLink key={m.to} to={m.to} end className={navClass}>
                <span aria-hidden="true">{m.icon}</span>
                {m.label}
              </NavLink>
            ))}
            <div className="side-label" style={{ marginTop: 15 }}>
              {backend.isDemo ? 'Conta de demonstração' : 'Conta'}
            </div>
            <NavLink to="/perfil" className={navClass}>
              <span aria-hidden="true">◎</span>Meu perfil
            </NavLink>
            {backend.reset && (
              <button type="button" className="nav" onClick={() => void onReset()}>
                <span aria-hidden="true">↻</span>Reiniciar dados
              </button>
            )}
          </nav>
          <section className="content">
            <Outlet />
            <div className="footer">
              MentCare · Protótipo acadêmico · Dados demonstrativos armazenados neste navegador
            </div>
          </section>
        </div>
      </main>
    </>
  )
}
