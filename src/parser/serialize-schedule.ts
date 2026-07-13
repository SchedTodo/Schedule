import type { EvaluatedStatement, EvaluatedTime, ScheduleSpec } from './evaluator'

function formatDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number)
  return `${year}/${month}/${day}`
}

function formatTime(value: EvaluatedTime): string {
  if (value.hour === null) return '?'
  return `${value.hour}:${value.minute === null ? '?' : String(value.minute).padStart(2, '0')}`
}

function formatFrequency(value: EvaluatedStatement['frequency']): string {
  if (value.unit === 'daily' && value.interval === 1 && value.count === undefined) return ''
  const options = [
    value.interval === 1 ? '' : `i${value.interval}`,
    value.count === undefined ? '' : `c${value.count}`
  ].filter(Boolean)
  return [value.unit, ...options].join(',')
}

function formatBy(value: EvaluatedStatement['by']): string {
  const entries = Object.entries(value)
  if (entries.length === 0) return ''
  return `by[${entries.map(([name, values]) => `${name}[${values.join(',')}]`).join(',')}]`
}

function serializeStatement(value: EvaluatedStatement): string {
  const dates = value.endDate === undefined
    ? formatDate(value.startDate)
    : `${formatDate(value.startDate)}-${formatDate(value.endDate)}`
  const times = value.startTime === null
    ? formatTime(value.endTime)
    : `${formatTime(value.startTime)}-${formatTime(value.endTime)}`
  return [dates, times, value.timeZone, formatFrequency(value.frequency), formatBy(value.by)]
    .filter(Boolean)
    .join(' ')
}

export function serializeScheduleSpec(spec: ScheduleSpec): string {
  return `${spec.statements.map(serializeStatement).join(';')};`
}
