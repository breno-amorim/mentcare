import { parseLocalDateTime } from './dates'

export const MIN_HOURS_TO_CHANGE = 24

/** Horas entre `now` e o início da consulta (negativo se já passou). */
export function hoursUntil(date: string, time: string, now: Date): number {
  return (parseLocalDateTime(date, time).getTime() - now.getTime()) / 36e5
}

/** Cancelar/remarcar exige pelo menos 24 horas de antecedência. */
export function canChangeAppointment(date: string, time: string, now: Date): boolean {
  return hoursUntil(date, time, now) >= MIN_HOURS_TO_CHANGE
}

/** Um horário só pode ser oferecido se ainda não começou. */
export function isSlotInFuture(date: string, time: string, now: Date): boolean {
  return parseLocalDateTime(date, time).getTime() > now.getTime()
}
