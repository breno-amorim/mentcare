import type { ReactNode } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import type { Role } from '../domain/types'
import { useAuth } from './AuthContext'

/** Exige usuário logado. A decisão real de autorização é sempre refeita no servidor (RLS). */
export function RequireAuth() {
  const { user, loading } = useAuth()
  if (loading) return <p className="empty">Carregando…</p>
  return user ? <Outlet /> : <Navigate to="/entrar" replace />
}

export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { user } = useAuth()
  return user?.role === role ? <>{children}</> : <Navigate to="/" replace />
}
