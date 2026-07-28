import type {
  KnownTimeMark,
  OccurrenceRangeQuery,
  ScheduleOccurrenceDto
} from '../../contracts/occurrence.contract'
import { Temporal } from '../../domain/shared/temporal'
import { resolveSupportedLocale } from '../../i18n/locale'
import { translateMessage } from '../../i18n/translate'

export interface OccurrenceWallTime {
  readonly date: string
  readonly hour: number
  readonly minute: number
}

export type TimeDisplayMode = 'clock' | 'relative'
export type RelativeTimeKind = 'event' | 'todo'

/** 将目标时刻相对当前时刻格式化为紧凑英文文案。 */
export function formatRelativeTime(
  target: string,
  now: string,
  kind: RelativeTimeKind,
  locale: string = 'en-US'
): string {
  const supportedLocale = resolveSupportedLocale(locale)
  const difference = Date.parse(target) - Date.parse(now)
  if (difference === 0) return translateMessage(supportedLocale, 'relative.now')

  const future = difference > 0
  const absolute = Math.abs(difference)
  if (absolute < 60_000) {
    if (kind === 'todo') {
      return translateMessage(supportedLocale, future ? 'relative.dueSoon' : 'relative.justOverdue')
    }
    return translateMessage(supportedLocale, future ? 'relative.startingSoon' : 'relative.justStarted')
  }

  let minutes = Math.floor(absolute / 60_000)
  const days = Math.floor(minutes / 1440)
  minutes -= days * 1440
  const hours = Math.floor(minutes / 60)
  minutes -= hours * 60
  const duration = [
    days === 0 ? '' : translateMessage(supportedLocale, 'relative.day', { count: days }),
    hours === 0 ? '' : translateMessage(supportedLocale, 'relative.hour', { count: hours }),
    minutes === 0 ? '' : translateMessage(supportedLocale, 'relative.minute', { count: minutes })
  ].filter(Boolean).join(' ')

  if (future) return translateMessage(supportedLocale, 'relative.future', { duration })
  return translateMessage(
    supportedLocale,
    kind === 'todo' ? 'relative.overdue' : 'relative.ago',
    { duration }
  )
}

/** 将 UTC instant 转换为指定时区中的日期和墙上时钟。 */
export function occurrenceWallTime(instant: string, timeZone: string): OccurrenceWallTime {
  const value = Temporal.Instant.from(instant).toZonedDateTimeISO(timeZone)
  return {
    date: value.toPlainDate().toString(),
    hour: value.hour,
    minute: value.minute
  }
}

/** 返回指定时区中的今天，允许注入当前 instant 以便稳定测试。 */
export function todayInTimeZone(
  timeZone: string,
  now: Temporal.Instant = Temporal.Now.instant()
): string {
  return now.toZonedDateTimeISO(timeZone).toPlainDate().toString()
}

/** 构造覆盖当前月前后各一周的 occurrence 查询范围。 */
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

export function formatInstant(
  instant: string,
  timeZone: string,
  locale: string = 'en-US'
): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'short',
    timeStyle: 'medium',
    timeZone
  }).format(new Date(instant))
}

export function formatWallClock(value: OccurrenceWallTime): string {
  return `${String(value.hour).padStart(2, '0')}:${String(value.minute).padStart(2, '0')}`
}

/** 按时间精度标记格式化墙上时钟，未知的时或分显示为问号。 */
export function formatMarkedWallClock(
  instant: string,
  mark: KnownTimeMark,
  timeZone: string
): string {
  const value = occurrenceWallTime(instant, timeZone)
  const [hour, minute] = formatWallClock(value).split(':')
  return `${mark[0] === '1' ? hour : '?'}:${mark[1] === '1' ? minute : '?'}`
}

/** 格式化 occurrence 的起止墙上时间；Todo 仅显示截止时间。 */
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

/** 将 occurrence 序列化为 UTC 排除规则，保留未知时间分量。 */
export function serializeOccurrenceExclusion(item: ScheduleOccurrenceDto): string {
  const end = formatUtcDateTime(item.end, item.endMark)
  if (item.start === null) return `${end} UTC`
  const start = formatUtcDateTime(item.start, item.startMark)
  const [date, startTime] = start.split(' ')
  const endTime = end.split(' ')[1]
  return `${date} ${startTime}-${endTime} UTC`
}
