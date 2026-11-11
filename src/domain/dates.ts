const pad = (n: number) => String(n).padStart(2, '0')

/** Data local (YYYY-MM-DD). Evita o erro de `toISOString()`, que usa UTC. */
export function toLocalDateString(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Constrói um Date local a partir de data (YYYY-MM-DD) e hora (HH:mm). */
export function parseLocalDateTime(date: string, time: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  return new Date(y!, m! - 1, d!, hh, mm)
}

/** Data local (YYYY-MM-DD) deslocada `days` dias a partir de `from`. */
export function addDays(from: Date, days: number): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + days)
  return toLocalDateString(d)
}

/** Exibe uma data YYYY-MM-DD no formato brasileiro. */
export function formatDate(date: string): string {
  return date ? new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR') : '—'
}
