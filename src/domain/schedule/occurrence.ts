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

function selectPositions(
  values: readonly Temporal.PlainDate[],
  positions: readonly number[] | undefined
): readonly Temporal.PlainDate[] {
  if (positions === undefined) return values
  const selected = new Map<string, Temporal.PlainDate>()
  for (const position of positions) {
    const index = position > 0 ? position - 1 : values.length + position
    const value = values[index]
    if (value !== undefined) selected.set(value.toString(), value)
  }
  return [...selected.values()].sort(Temporal.PlainDate.compare)
}

function monthlyDates(
  statement: EvaluatedStatement,
  start: Temporal.PlainDate,
  end: Temporal.PlainDate
): readonly Temporal.PlainDate[] {
  const values: Temporal.PlainDate[] = []
  let month = start.with({ day: 1 })
  const lastMonth = end.with({ day: 1 })

  while (Temporal.PlainDate.compare(month, lastMonth) <= 0) {
    const monthOffset = (month.year - start.year) * 12 + month.month - start.month
    if (monthOffset % statement.frequency.interval === 0) {
      const candidates: Temporal.PlainDate[] = []
      for (let day = 1; day <= month.daysInMonth; day += 1) {
        const candidate = month.with({ day })
        if (matchesBy(candidate, statement.by)) candidates.push(candidate)
      }
      for (const candidate of selectPositions(candidates, statement.by.setpos)) {
        if (
          Temporal.PlainDate.compare(candidate, start) >= 0 &&
          Temporal.PlainDate.compare(candidate, end) <= 0
        ) {
          values.push(candidate)
          if (
            statement.frequency.count !== undefined &&
            values.length >= statement.frequency.count
          ) {
            return values
          }
        }
      }
    }
    month = month.add({ months: 1 })
  }
  return values
}

function dates(statement: EvaluatedStatement): readonly Temporal.PlainDate[] {
  const start = Temporal.PlainDate.from(statement.startDate)
  if (statement.endDate === undefined) return [start]

  const end = Temporal.PlainDate.from(statement.endDate)
  if (statement.frequency.unit === 'monthly' && statement.by.setpos !== undefined) {
    return monthlyDates(statement, start, end)
  }
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
