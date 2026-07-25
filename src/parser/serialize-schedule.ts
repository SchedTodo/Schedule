import type { EvaluatedStatement, EvaluatedTime, ScheduleSpec } from './evaluator'

function formatDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number)
  return `${year}/${month}/${day}`
}

function formatTime(value: EvaluatedTime): string {
  if (value.hour === null) return '?'
  return `${value.hour}:${value.minute === null ? '?' : String(value.minute).padStart(2, '0')}`
}

/** 序列化频率，并省略解析器隐式补入的默认 daily。 */
function formatFrequency(value: EvaluatedStatement['frequency']): string {
  if (
    !value.explicit &&
    value.unit === 'daily' &&
    value.interval === 1 &&
    value.count === undefined
  ) {
    return ''
  }
  const options = [
    value.interval === 1 ? '' : `i${value.interval}`,
    value.count === undefined ? '' : `c${value.count}`
  ].filter(Boolean)
  return [value.unit, ...options].join(',')
}

/** 按 AST 中的 BY 类型和值序列化 BY 子句。 */
function formatBy(value: EvaluatedStatement['by']): string {
  const entries = Object.entries(value)
  if (entries.length === 0) return ''
  return `by[${entries.map(([name, values]) => `${name}[${values.join(',')}]`).join(',')}]`
}

/** 将单条已求值语句序列化为规范的日程代码。 */
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

/** 将全部语句序列化，并确保每条规范代码以分号结束。 */
export function serializeScheduleSpec(spec: ScheduleSpec): string {
  return `${spec.statements.map(serializeStatement).join(';')};`
}
