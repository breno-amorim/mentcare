import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Role, User } from '../domain/types'
import * as auth from '../services/auth'
import { useDb } from '../services/store'

interface AuthValue {
  user: User | null
  signIn: (email: string, password: string, role: Role) => Promise<void>
  signUp: (input: auth.RegisterInput) => Promise<void>
  signOut: () => void
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(auth.getSessionUserId)
  const db = useDb()
  const user = useMemo(() => db.users.find((u) => u.id === userId) ?? null, [db.users, userId])

  const signIn = useCallback(async (email: string, password: string, role: Role) => {
    setUserId((await auth.login(email, password, role)).id)
  }, [])
  const signUp = useCallback(async (input: auth.RegisterInput) => {
    setUserId((await auth.registerPatient(input)).id)
  }, [])
  const signOut = useCallback(() => {
    auth.logout()
    setUserId(null)
  }, [])

  const value = useMemo(() => ({ user, signIn, signUp, signOut }), [user, signIn, signUp, signOut])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}

/** Usuário logado; só use dentro de rotas protegidas. */
export function useUser(): User {
  const { user } = useAuth()
  if (!user) throw new Error('Rota protegida acessada sem usuário')
  return user
}
