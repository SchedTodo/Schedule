import { Temporal } from '../../domain/shared/temporal'

export type TodoTone = 'expired' | 'done' | 'today' | 'tomorrow' | 'future'

export function todoTone(
  end: string,
  done: boolean,
  timeZone: string,
  now: Temporal.Instant = Temporal.Now.instant()
): TodoTone {
  const deadline = Temporal.Instant.from(end)
  if (Temporal.Instant.compare(deadline, now) < 0) return 'expired'
  if (done) return 'done'
  const today = now.toZonedDateTimeISO(timeZone).toPlainDate()
  const deadlineDate = deadline.toZonedDateTimeISO(timeZone).toPlainDate()
  const days = today.until(deadlineDate, { largestUnit: 'days' }).days
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  return 'future'
}

export function formatTodoDeadline(end: string, timeZone: string): string {
  const value = Temporal.Instant.from(end).toZonedDateTimeISO(timeZone)
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${pad(value.month)}-${pad(value.day)} ${pad(value.hour)}:${pad(value.minute)}`
}
