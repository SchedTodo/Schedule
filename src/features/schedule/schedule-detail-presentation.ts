import type { KnownTimeMark, ScheduleOccurrenceDto } from '../../contracts/occurrence.contract'
import { Temporal } from '../../domain/shared/temporal'

function effectiveInstant(value: ScheduleOccurrenceDto): string {
  return value.start ?? value.end
}

/** 按指定时区和精度标记格式化 occurrence 日期时间。 */
export function formatOccurrenceDateTime(
  instant: string,
  mark: KnownTimeMark,
  timeZone: string,
  locale = 'en-US'
): string {
  const value = Temporal.Instant.from(instant).toZonedDateTimeISO(timeZone)
  const hour = mark[0] === '1' ? String(value.hour).padStart(2, '0') : '?'
  const minute = mark[1] === '1' ? String(value.minute).padStart(2, '0') : '?'
  const date = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    timeZone
  }).format(new Date(instant))
  return `${date} ${hour}:${minute}`
}

/** 按 occurrence 的有效时间返回指定时区中的本地化星期名称。 */
export function occurrenceWeekday(
  value: ScheduleOccurrenceDto,
  timeZone: string,
  locale?: string
): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone })
    .format(new Date(effectiveInstant(value)))
}

/** 判断 occurrence 的本地日期是否早于指定时区中的今天。 */
export function isPastOccurrence(
  value: ScheduleOccurrenceDto,
  timeZone: string,
  now: Temporal.Instant = Temporal.Now.instant()
): boolean {
  const date = Temporal.Instant.from(effectiveInstant(value))
    .toZonedDateTimeISO(timeZone)
    .toPlainDate()
  const today = now.toZonedDateTimeISO(timeZone).toPlainDate()
  return Temporal.PlainDate.compare(date, today) < 0
}

/** 将未过期 occurrence 排在前面，并在各组内按有效时间升序排列。 */
export function sortDetailOccurrences(
  values: readonly ScheduleOccurrenceDto[],
  timeZone: string,
  now: Temporal.Instant = Temporal.Now.instant()
): ScheduleOccurrenceDto[] {
  return [...values].sort((left, right) => {
    const group = Number(isPastOccurrence(left, timeZone, now)) -
      Number(isPastOccurrence(right, timeZone, now))
    if (group !== 0) return group
    return Temporal.Instant.compare(
      Temporal.Instant.from(effectiveInstant(left)),
      Temporal.Instant.from(effectiveInstant(right))
    )
  })
}
