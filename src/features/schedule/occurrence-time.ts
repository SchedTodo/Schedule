import { Temporal } from '../../domain/shared/temporal'

export interface OccurrenceWallTime {
  readonly date: string
  readonly hour: number
  readonly minute: number
}

export function occurrenceWallTime(instant: string, timeZone: string): OccurrenceWallTime {
  const value = Temporal.Instant.from(instant).toZonedDateTimeISO(timeZone)
  return {
    date: value.toPlainDate().toString(),
    hour: value.hour,
    minute: value.minute
  }
}

export function todayInTimeZone(
  timeZone: string,
  now: Temporal.Instant = Temporal.Now.instant()
): string {
  return now.toZonedDateTimeISO(timeZone).toPlainDate().toString()
}

export function formatInstant(instant: string, timeZone: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'short',
    timeStyle: 'medium',
    timeZone
  }).format(new Date(instant))
}

export function formatWallClock(value: OccurrenceWallTime): string {
  return `${String(value.hour).padStart(2, '0')}:${String(value.minute).padStart(2, '0')}`
}
