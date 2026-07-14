import type {
  KnownTimeMark,
  OccurrenceRangeQuery,
  ScheduleOccurrenceDto
} from '../../contracts/occurrence.contract'
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

export function calendarRange(
  timeZone: string,
  now: Temporal.Instant = Temporal.Now.instant()
): OccurrenceRangeQuery {
  const firstDay = now.toZonedDateTimeISO(timeZone).toPlainDate().with({ day: 1 })
  const start = firstDay.subtract({ days: 7 }).toZonedDateTime({
    timeZone,
    plainTime: Temporal.PlainTime.from('00:00')
  })
  const end = firstDay.add({ months: 1, days: 7 }).toZonedDateTime({
    timeZone,
    plainTime: Temporal.PlainTime.from('00:00')
  })
  return {
    start: start.toInstant().toString(),
    end: end.toInstant().toString(),
    limit: 5000
  }
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

export function formatMarkedWallClock(
  instant: string,
  mark: KnownTimeMark,
  timeZone: string
): string {
  const value = occurrenceWallTime(instant, timeZone)
  const [hour, minute] = formatWallClock(value).split(':')
  return `${mark[0] === '1' ? hour : '?'}:${mark[1] === '1' ? minute : '?'}`
}

export function formatOccurrenceRange(
  item: ScheduleOccurrenceDto,
  timeZone: string
): string {
  if (item.start === null) return formatMarkedWallClock(item.end, item.endMark, timeZone)
  return `${formatMarkedWallClock(item.start, item.startMark, timeZone)}–${formatMarkedWallClock(item.end, item.endMark, timeZone)}`
}

function formatUtcDateTime(instant: string, mark: KnownTimeMark): string {
  const value = Temporal.Instant.from(instant).toZonedDateTimeISO('UTC')
  const hour = mark[0] === '1' ? String(value.hour) : '?'
  const minute = mark[1] === '1' ? String(value.minute).padStart(2, '0') : '?'
  return `${value.year}/${value.month}/${value.day} ${hour}:${minute}`
}

export function serializeOccurrenceExclusion(item: ScheduleOccurrenceDto): string {
  const end = formatUtcDateTime(item.end, item.endMark)
  if (item.start === null) return `${end} UTC`
  const start = formatUtcDateTime(item.start, item.startMark)
  const [date, startTime] = start.split(' ')
  const endTime = end.split(' ')[1]
  return `${date} ${startTime}-${endTime} UTC`
}
