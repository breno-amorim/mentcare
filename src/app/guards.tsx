import type { ReactNode } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import type { Role } from '../domain/types'
import { useAuth } from './AuthContext'

/** Exige usuário logado. A decisão real de autorização é sempre refeita nos serviços/banco. */
export function RequireAuth() {
  const { user } = useAuth()
  return user ? <Outlet /> : <Navigate to="/entrar" replace />
}

export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { user } = useAuth()
  return user?.role === role ? <>{children}</> : <Navigate to="/" replace />
}
