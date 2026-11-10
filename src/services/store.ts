import { useSyncExternalStore } from 'react'
import type { Db } from '../domain/types'
import { isSlotInFuture } from '../domain/appointment-policy'
import { DB_VERSION, DEMO_PROFESSIONAL_IDS, buildSeed, demoAvailability } from './seed'

const STORAGE_KEY = 'mentcare_db'

function readStorage(): Db | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Db>
    return parsed.version === DB_VERSION ? (parsed as Db) : null
  } catch {
    return null
  }
}

function writeStorage(db: Db): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
  } catch {
    // Armazenamento indisponível (modo privado/cheio): o app segue só em memória.
  }
}

/** Repõe horários de demonstração quando os profissionais do seed ficaram sem horários futuros. */
export function refreshDemoAvailability(db: Db, now: Date): Db {
  const hasFuture = (id: string) =>
    db.availability.some((s) => s.professionalId === id && isSlotInFuture(s.date, s.time, now))
  const missing = DEMO_PROFESSIONAL_IDS.filter((id) => !hasFuture(id))
  if (!missing.length) return db
  const fresh = demoAvailability(now)
    .filter((s) => missing.includes(s.professionalId))
    .map((s) => ({ ...s, id: `${s.id}-${Date.now().toString(36)}` }))
  return { ...db, availability: [...db.availability, ...fresh] }
}

let state: Db = refreshDemoAvailability(readStorage() ?? buildSeed(new Date()), new Date())
writeStorage(state)

const listeners = new Set<() => void>()

export const getDb = (): Db => state

/** Atualiza o estado de forma imutável: `mutate` recebe uma cópia profunda. */
export function updateDb(mutate: (draft: Db) => void): void {
  const next = structuredClone(state)
  mutate(next)
  state = next
  writeStorage(state)
  listeners.forEach((l) => l())
}

export function resetDb(now = new Date()): void {
  state = buildSeed(now)
  writeStorage(state)
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const useDb = (): Db => useSyncExternalStore(subscribe, getDb)
