import { Temporal } from '../domain/shared/temporal'
import type { Diagnostic } from './diagnostics'
import { semanticDiagnostic } from './diagnostics'
import type { ScheduleDocumentAst, ScheduleStatementAst } from './ast'

export type TimeZoneResolution =
  | { readonly kind: 'resolved'; readonly timeZone: string }
  | { readonly kind: 'ambiguous'; readonly candidates: readonly string[] }
  | { readonly kind: 'unknown' }

export interface EvaluationContext {
  readonly now: Temporal.Instant
  readonly defaultTimeZone: string
  readonly weekStartsOn: 1 | 2 | 3 | 4 | 5 | 6 | 7
  resolveTimeZoneAbbreviation(value: string): TimeZoneResolution
}

export interface EvaluatedTime {
  readonly hour: number | null
  readonly minute: number | null
}

export interface EvaluatedStatement {
  readonly kind: 'event' | 'todo'
  readonly startDate: string
  readonly endDate?: string
  readonly startTime: EvaluatedTime | null
  readonly endTime: EvaluatedTime
  readonly timeZone: string
  readonly frequency: {
    readonly unit: 'daily' | 'weekly' | 'monthly' | 'yearly'
    readonly interval: number
    readonly count?: number
    readonly explicit: boolean
  }
  readonly by: Readonly<Record<string, readonly number[]>>
}

export interface ScheduleSpec {
  readonly statements: readonly EvaluatedStatement[]
}

export type EvaluationResult =
  | { readonly ok: true; readonly value: ScheduleSpec }
  | { readonly ok: false; readonly diagnostics: readonly Diagnostic[] }

function currentDate(context: EvaluationContext): Temporal.PlainDate {
  return context.now.toZonedDateTimeISO(context.defaultTimeZone).toPlainDate()
}

function evaluateDate(
  source: string,
  context: EvaluationContext,
  base?: Temporal.PlainDate
): Temporal.PlainDate {
  if (source === 'tdy') return currentDate(context)
  if (source === 'tmr') return currentDate(context).add({ days: 1 })

  const parts = source.split('/').map(Number)
  if (parts.length === 3) {
    return Temporal.PlainDate.from(
      { year: parts[0]!, month: parts[1]!, day: parts[2]! },
      { overflow: 'reject' }
    )
  }
  if (parts.length === 2) {
    const month = parts[0]!
    const day = parts[1]!
    const reference = base ?? currentDate(context)
    let date = Temporal.PlainDate.from(
      { year: reference.year, month, day },
      { overflow: 'reject' }
    )
    if (base === undefined && Temporal.PlainDate.compare(date, reference) < 0) {
      date = date.add({ years: 1 })
    }
    return date
  }
  if (parts.length === 1 && base !== undefined) {
    return Temporal.PlainDate.from(
      { year: base.year, month: base.month, day: parts[0]! },
      { overflow: 'reject' }
    )
  }
  throw new Error(`Invalid date: ${source}`)
}

function evaluateTime(source: string): EvaluatedTime {
  if (source === 's' || source === 'start') return { hour: 0, minute: 0 }
  if (source === 'e' || source === 'end') return { hour: 23, minute: 59 }
  if (source === ':' || source === '.') return { hour: null, minute: null }
  if (source.startsWith('?')) return { hour: null, minute: null }

  const hasSeparator = /[:.]/u.test(source)
  const [hourText, minuteText] = source.split(/[:.]/u)
  const hour = Number(hourText)
  const minute =
    !hasSeparator ? 0 : minuteText === undefined || minuteText === '' || minuteText === '?' ? null : Number(minuteText)
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) throw new Error(`Invalid hour: ${source}`)
  if (minute !== null && (!Number.isInteger(minute) || minute < 0 || minute > 59)) {
    throw new Error(`Invalid minute: ${source}`)
  }
  return { hour, minute }
}

function resolveTimeZone(value: string | undefined, context: EvaluationContext): string {
  if (value === undefined) return context.defaultTimeZone
  if (value === 'UTC') return value
  if (value.includes('/')) {
    Temporal.ZonedDateTime.from({
      timeZone: value,
      year: 2000,
      month: 1,
      day: 1,
      hour: 0
    })
    return value
  }

  const resolution = context.resolveTimeZoneAbbreviation(value)
  if (resolution.kind === 'resolved') return resolution.timeZone
  throw new Error(`Invalid time zone: ${value}`)
}

const byRanges: Readonly<Record<string, readonly [number, number, boolean]>> = {
  month: [1, 12, false],
  weekno: [1, 53, true],
  yearday: [1, 366, true],
  monthday: [1, 31, true],
  day: [1, 7, false],
  setpos: [1, 366, true]
}

function validateRecurrence(statement: ScheduleStatementAst): void {
  const frequency = statement.frequency
  if (frequency?.hasDuplicateOptions === true) {
    throw new Error('Invalid recurrence: duplicate frequency option')
  }
  if (frequency?.interval !== undefined && frequency.interval <= 0) {
    throw new Error('Invalid recurrence: interval must be positive')
  }
  if (frequency?.count !== undefined && frequency.count < 0) {
    throw new Error('Invalid recurrence: count must not be negative')
  }

  for (const [name, values] of Object.entries(statement.by)) {
    const range = byRanges[name]
    if (range === undefined) throw new Error(`Invalid recurrence: unknown by type ${name}`)
    const [minimum, maximum, allowNegative] = range
    for (const value of values) {
      const magnitude = Math.abs(value)
      if (value === 0 || magnitude < minimum || magnitude > maximum || (!allowNegative && value < 0)) {
        throw new Error(`Invalid recurrence: ${name} value ${value}`)
      }
    }
  }
}

function evaluateStatement(
  statement: ScheduleStatementAst,
  context: EvaluationContext
): EvaluatedStatement {
  validateRecurrence(statement)
  const startDate = evaluateDate(statement.dates[0], context)
  const endDate =
    statement.dates[1] === undefined
      ? undefined
      : evaluateDate(statement.dates[1], context, startDate)
  const firstTime = evaluateTime(statement.times[0])
  const secondTime =
    statement.times[1] === undefined ? undefined : evaluateTime(statement.times[1])
  if (
    secondTime !== undefined &&
    firstTime.hour === null && firstTime.minute === null &&
    secondTime.hour === null && secondTime.minute === null
  ) {
    throw new Error('Invalid time: both range endpoints are unknown')
  }

  return {
    kind: secondTime === undefined ? 'todo' : 'event',
    startDate: startDate.toString(),
    ...(endDate === undefined ? {} : { endDate: endDate.toString() }),
    startTime: secondTime === undefined ? null : firstTime,
    endTime: secondTime ?? firstTime,
    timeZone: resolveTimeZone(statement.timeZone, context),
    frequency: {
      unit: statement.frequency?.unit ?? 'daily',
      interval: statement.frequency?.interval ?? 1,
      ...(statement.frequency?.count === undefined ? {} : { count: statement.frequency.count }),
      explicit: statement.frequency !== undefined
    },
    by: statement.by
  }
}

export function evaluateSchedule(
  ast: ScheduleDocumentAst,
  context: EvaluationContext
): EvaluationResult {
  try {
    return {
      ok: true,
      value: {
        statements: ast.statements.map((statement) => evaluateStatement(statement, context))
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const lowerMessage = message.toLowerCase()
    const code = lowerMessage.includes('time zone')
      ? 'INVALID_TIME_ZONE'
      : lowerMessage.includes('recurrence')
        ? 'INVALID_RECURRENCE'
        : lowerMessage.includes('hour') || lowerMessage.includes('minute')
        ? 'INVALID_TIME'
        : 'INVALID_DATE'
    return { ok: false, diagnostics: [semanticDiagnostic(code, message)] }
  }
}
