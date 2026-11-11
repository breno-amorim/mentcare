import type { Role, StoredUser } from '../domain/types'
import { AppError } from './errors'
import { getDb } from './store'

/**
 * Autorização: o serviço relê o usuário do armazenamento e confere o papel.
 * Nunca confia no objeto de usuário vindo da interface. Com o Supabase, esta
 * checagem passa a ser feita pelo banco (RLS); aqui ela espelha o mesmo contrato.
 */
export function requireRole<R extends Role>(
  actorId: string | undefined,
  role: R,
): StoredUser & { role: R } {
  const user = getDb().users.find((u) => u.id === actorId)
  if (!user || user.role !== role) throw new AppError('Você não tem permissão para esta ação.')
  return user as StoredUser & { role: R }
}

export const newId = (): string => crypto.randomUUID().replace(/-/g, '').slice(0, 12)
