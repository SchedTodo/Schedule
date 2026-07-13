import { Temporal } from '@js-temporal/polyfill'

import type { ScheduleOccurrenceDraft } from '../../src/contracts/occurrence.contract'
import type { EvaluationContext, EvaluatedStatement } from '../../src/parser/evaluator'
import { expandScheduleOccurrences, parseSchedule } from '../../src/parser/parse-schedule'

const NOW = Temporal.Instant.from('2026-07-11T02:00:00Z')
const DEFAULT_TIME_ZONE = 'Asia/Shanghai'

const context: EvaluationContext = {
  now: NOW,
  defaultTimeZone: DEFAULT_TIME_ZONE,
  weekStartsOn: 1,
  resolveTimeZoneAbbreviation: (value) =>
    value === 'CST'
      ? { kind: 'resolved', timeZone: '-06:00' }
      : { kind: 'unknown' }
}

function parseOne(source: string): EvaluatedStatement {
  const result = parseSchedule(source.endsWith(';') ? source : `${source};`, context)
  if (!result.ok) throw new Error(result.diagnostics[0]?.message)
  if (result.value.statements.length !== 1) throw new Error('Expected one statement')
  return result.value.statements[0]!
}

function dateParts(value: string) {
  const date = Temporal.PlainDate.from(value)
  return { year: date.year, month: date.month, day: date.day }
}

function legacyDate(value: string): string {
  const date = Temporal.PlainDate.from(value)
  return `${date.year}/${date.month}/${date.day}`
}

function mark(time: { hour: number | null; minute: number | null }): '00' | '10' | '11' {
  if (time.hour === null) return '00'
  return time.minute === null ? '10' : '11'
}

export function parseDateRange(source: string) {
  const value = parseOne(`${source} 0:00`)
  return {
    dtstart: dateParts(value.startDate),
    ...(value.endDate === undefined ? {} : { until: dateParts(value.endDate) }),
    value: value.endDate === undefined
      ? legacyDate(value.startDate)
      : `${legacyDate(value.startDate)}-${legacyDate(value.endDate)}`
  }
}

export function parseTimeRange(source: string) {
  const value = parseOne(`2026/7/11 ${source}`)
  if (value.startTime === null) {
    return { start: null, end: value.endTime, startMark: '11', endMark: mark(value.endTime) }
  }
  return {
    start: { hour: value.startTime.hour ?? 0, minute: value.startTime.minute ?? 0 },
    end: { hour: value.endTime.hour ?? 0, minute: value.endTime.minute ?? 0 },
    startMark: mark(value.startTime),
    endMark: mark(value.endTime)
  }
}

export const RRule = {
  DAILY: 3,
  WEEKLY: 2,
  MONTHLY: 1,
  YEARLY: 0,
  MO: 0,
  TU: 1,
  WE: 2,
  TH: 3,
  FR: 4,
  SA: 5,
  SU: 6
} as const

export function parseFreq(source: string) {
  const value = parseOne(`2026/7/11-12 0:00 ${source}`).frequency
  const freq = { daily: RRule.DAILY, weekly: RRule.WEEKLY, monthly: RRule.MONTHLY, yearly: RRule.YEARLY }[value.unit]
  return {
    freq,
    ...(!source.split(',').some((option) => option.startsWith('i')) ? {} : { interval: value.interval }),
    ...(value.count === undefined ? {} : { count: value.count })
  }
}

export function parseBy(source: string) {
  const by = parseOne(`2026/7/11-12 0:00 ${source}`).by
  return {
    ...(by.day === undefined ? {} : { byweekday: by.day.map((day) => day - 1) }),
    ...(by.month === undefined ? {} : { bymonth: [...by.month] })
  }
}

function toLegacyOccurrence(value: ScheduleOccurrenceDraft) {
  return value
}

export function parseTimeCodes(recurrenceCode: string, exclusionCode: string) {
  const result = expandScheduleOccurrences(recurrenceCode, exclusionCode, context)
  if (!result.ok) throw new Error(result.diagnostics[0]?.message)
  const values = result.value.map(toLegacyOccurrence)
  return {
    rTimes: values.filter((value) => !value.excluded),
    exTimes: values.filter((value) => value.excluded)
  }
}

export async function loadSettings(): Promise<void> {}

export function getSettingByPath(path: string): string {
  if (path !== 'rrule.timeZone') throw new Error(`Unknown setting: ${path}`)
  return DEFAULT_TIME_ZONE
}

export function getTimeZoneAbbrMap(): Map<string, Set<string>> {
  return new Map([['CST', new Set(['America/Chicago'])]])
}

export function string2IntArray(source: string): number[] {
  return source.split(',').map(Number)
}

function formatZoned(value: Temporal.ZonedDateTime, pattern: string): string {
  const replacements: Record<string, string> = {
    yyyy: String(value.year).padStart(4, '0'),
    MM: String(value.month).padStart(2, '0'),
    M: String(value.month),
    dd: String(value.day).padStart(2, '0'),
    d: String(value.day),
    HH: String(value.hour).padStart(2, '0'),
    mm: String(value.minute).padStart(2, '0')
  }
  return pattern.replace(/yyyy|MM|dd|HH|mm|M|d/gu, (token) => replacements[token]!)
}

class LegacyDateTime {
  constructor(private readonly value: Temporal.ZonedDateTime) {}
  get year() { return this.value.year }
  get month() { return this.value.month }
  get day() { return this.value.day }
  plus(duration: { day?: number }) { return new LegacyDateTime(this.value.add({ days: duration.day ?? 0 })) }
  setZone(timeZone: string, options?: { keepLocalTime?: boolean }) {
    if (options?.keepLocalTime === true) {
      return new LegacyDateTime(this.value.toPlainDateTime().toZonedDateTime(timeZone))
    }
    return new LegacyDateTime(this.value.toInstant().toZonedDateTimeISO(timeZone))
  }
  toFormat(pattern: string) { return formatZoned(this.value, pattern) }
  toISO() {
    const offset = this.value.offset
    return `${this.value.toPlainDateTime().toString({ smallestUnit: 'millisecond' })}${offset}`
  }
  toJSDate() { return new Date(this.value.epochMilliseconds) }
}

export const DateTime = {
  now: () => new LegacyDateTime(NOW.toZonedDateTimeISO(DEFAULT_TIME_ZONE)),
  fromISO: (source: string) => {
    const instant = Temporal.Instant.from(source)
    return new LegacyDateTime(instant.toZonedDateTimeISO('UTC'))
  },
  fromJSDate: (date: Date) => new LegacyDateTime(Temporal.Instant.fromEpochMilliseconds(date.getTime()).toZonedDateTimeISO('UTC'))
}
