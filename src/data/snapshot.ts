import { useSyncExternalStore } from 'react'
import type { Snapshot } from '../domain/types'

export const EMPTY_SNAPSHOT: Snapshot = {
  users: [],
  clinics: [],
  availability: [],
  appointments: [],
  records: [],
  ratings: [],
  ratingSummary: {},
}

let current: Snapshot = EMPTY_SNAPSHOT
const listeners = new Set<() => void>()

export function setSnapshot(next: Snapshot): void {
  current = next
  listeners.forEach((l) => l())
}

export const clearSnapshot = (): void => setSnapshot(EMPTY_SNAPSHOT)

/** Dados do usuário logado, já filtrados pelo backend (RLS no Supabase). */
export const useData = (): Snapshot =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => current,
  )
