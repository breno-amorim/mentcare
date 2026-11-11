import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { endSession, getBackend, refreshData } from '../data/backend'
import { useData } from '../data/snapshot'
import type { RegisterInput, User } from '../domain/types'

interface AuthValue {
  user: User | null
  /** true enquanto a sessão anterior (se houver) está sendo restaurada. */
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  /** 'confirm' = falta confirmar o e-mail antes de entrar. */
  signUp: (input: RegisterInput) => Promise<'ok' | 'confirm'>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessionUser, setSessionUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const data = useData()

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const restored = await getBackend().restoreSession()
        if (restored) await refreshData()
        if (alive) setSessionUser(restored)
      } catch {
        if (alive) setSessionUser(null)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  // Sempre usa a versão mais recente do usuário (ex.: gestor que acabou de criar a clínica).
  const user = useMemo(
    () => (sessionUser ? (data.users.find((u) => u.id === sessionUser.id) ?? sessionUser) : null),
    [sessionUser, data.users],
  )

  const signIn = useCallback(async (email: string, password: string) => {
    const u = await getBackend().signIn(email, password)
    await refreshData()
    setSessionUser(u)
  }, [])

  const signUp = useCallback(async (input: RegisterInput) => {
    const u = await getBackend().signUp(input)
    if (!u) return 'confirm' as const
    await refreshData()
    setSessionUser(u)
    return 'ok' as const
  }, [])

  const signOut = useCallback(async () => {
    await endSession()
    setSessionUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, loading, signIn, signUp, signOut }),
    [user, loading, signIn, signUp, signOut],
  )
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
