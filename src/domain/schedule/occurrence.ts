import type { ScheduleOccurrenceDraft } from '../../contracts/occurrence.contract'
import type { EvaluatedStatement, EvaluatedTime, ScheduleSpec } from '../../parser/evaluator'
import { Temporal } from '../shared/temporal'

function mark(time: EvaluatedTime | null): '00' | '01' | '10' | '11' {
  if (time === null) return '11'
  return `${time.hour === null ? 0 : 1}${time.minute === null ? 0 : 1}` as
    | '00'
    | '01'
    | '10'
    | '11'
}

function plainTime(time: EvaluatedTime): Temporal.PlainTime {
  return Temporal.PlainTime.from({
    hour: time.hour ?? 0,
    minute: time.minute ?? 0
  })
}

function isoInstant(
  date: Temporal.PlainDate,
  time: EvaluatedTime,
  timeZone: string
): string {
  return date.toZonedDateTime({ timeZone, plainTime: plainTime(time) }).toInstant().toString()
}

function matchesBy(date: Temporal.PlainDate, by: EvaluatedStatement['by']): boolean {
  if (by.month && !by.month.includes(date.month)) return false
  if (by.monthday && !by.monthday.some((value) =>
    value > 0 ? date.day === value : date.day === date.daysInMonth + value + 1
  )) return false
  if (by.day && !by.day.includes(date.dayOfWeek)) return false
  if (by.yearday && !by.yearday.some((value) =>
    value > 0 ? date.dayOfYear === value : date.dayOfYear === date.daysInYear + value + 1
  )) return false
  if (by.weekno && !by.weekno.includes(date.weekOfYear ?? 0)) return false
  return true
}

function matchesFrequency(
  date: Temporal.PlainDate,
  start: Temporal.PlainDate,
  statement: EvaluatedStatement
): boolean {
  const interval = statement.frequency.interval
  const dayOffset = start.until(date, { largestUnit: 'days' }).days
  const monthOffset = (date.year - start.year) * 12 + date.month - start.month
  switch (statement.frequency.unit) {
    case 'daily':
      return dayOffset % interval === 0
    case 'weekly':
      return Math.floor(dayOffset / 7) % interval === 0 &&
        (statement.by.day !== undefined || date.dayOfWeek === start.dayOfWeek)
    case 'monthly':
      return monthOffset % interval === 0 &&
        (statement.by.monthday !== undefined || statement.by.day !== undefined || date.day === start.day)
    case 'yearly':
      return (date.year - start.year) % interval === 0 &&
        (statement.by.month !== undefined || date.month === start.month) &&
        (statement.by.yearday !== undefined || statement.by.monthday !== undefined || statement.by.day !== undefined || date.day === start.day)
  }
}

function dates(statement: EvaluatedStatement): readonly Temporal.PlainDate[] {
  const start = Temporal.PlainDate.from(statement.startDate)
  if (statement.endDate === undefined) return [start]

  const end = Temporal.PlainDate.from(statement.endDate)
  const values: Temporal.PlainDate[] = []
  let current = start
  while (Temporal.PlainDate.compare(current, end) <= 0) {
    if (matchesFrequency(current, start, statement) && matchesBy(current, statement.by)) {
      values.push(current)
    }
    if (statement.frequency.count !== undefined && values.length >= statement.frequency.count) break
    current = current.add({ days: 1 })
  }
  return values
}

function expandStatement(statement: EvaluatedStatement): readonly ScheduleOccurrenceDraft[] {
  return dates(statement).map((date) => {
    const endDate =
      statement.startTime !== null &&
      (statement.startTime.hour ?? 0) > (statement.endTime.hour ?? 0)
        ? date.add({ days: 1 })
        : date
    return {
      excluded: false,
      start:
        statement.startTime === null
          ? null
          : isoInstant(date, statement.startTime, statement.timeZone),
      end: isoInstant(endDate, statement.endTime, statement.timeZone),
      startMark: mark(statement.startTime),
      endMark: mark(statement.endTime),
      comment: '',
      done: false
    }
  })
}

export function expandScheduleSpec(spec: ScheduleSpec): readonly ScheduleOccurrenceDraft[] {
  return spec.statements.flatMap(expandStatement)
}

export function occurrenceKey(occurrence: ScheduleOccurrenceDraft): string {
  return JSON.stringify([
    occurrence.start,
    occurrence.end,
    occurrence.startMark,
    occurrence.endMark
  ])
}
