import type {
  ByClauseContext,
  DateRangeContext,
  FrequencyContext,
  StatementContext,
  TimeRangeContext,
  TimeZoneContext
} from './generated/ScheduleParser'
import type {
  FrequencyUnit,
  ScheduleDocumentAst,
  ScheduleStatementAst
} from './ast'
import type { DocumentContext } from './generated/ScheduleParser'

function buildDates(context: DateRangeContext): readonly [string, string?] {
  const values = context.dateValue_list().map((value) => value.getText())
  const first = values[0]
  if (first === undefined) throw new Error('DATE_RANGE_EMPTY')
  return values[1] === undefined ? [first] : [first, values[1]]
}

function buildTimes(context: TimeRangeContext): readonly [string, string?] {
  const values = context.timeValue_list().map((value) => value.getText())
  const first = values[0]
  if (first === undefined) throw new Error('TIME_RANGE_EMPTY')
  return values[1] === undefined ? [first] : [first, values[1]]
}

function buildFrequency(context: FrequencyContext): NonNullable<ScheduleStatementAst['frequency']> {
  let interval: number | undefined
  let count: number | undefined
  let intervalCount = 0
  let countCount = 0

  for (const option of context.frequencyOption_list()) {
    const value = Number(option.INTEGER().getText())
    if (option.INTERVAL() != null) {
      interval = value
      intervalCount += 1
    }
    if (option.COUNT() != null) {
      count = value
      countCount += 1
    }
  }

  return {
    unit: context.FREQUENCY().getText() as FrequencyUnit,
    ...(interval === undefined ? {} : { interval }),
    ...(count === undefined ? {} : { count }),
    hasDuplicateOptions: intervalCount > 1 || countCount > 1
  }
}

function buildBy(context: ByClauseContext | null): Readonly<Record<string, readonly number[]>> {
  if (context === null) return {}

  return Object.fromEntries(
    context.byItem_list().map((item) => [
      item.BY_TYPE().getText(),
      item.signedInteger_list().map((value) => Number(value.getText()))
    ])
  )
}

function buildStatement(context: StatementContext): ScheduleStatementAst {
  const timeZoneContext = context.timeZone() as TimeZoneContext | null
  const frequencyContext = context.frequency() as FrequencyContext | null
  const byContext = context.byClause() as ByClauseContext | null

  return {
    dates: buildDates(context.dateRange()),
    times: buildTimes(context.timeRange()),
    ...(timeZoneContext === null ? {} : { timeZone: timeZoneContext.getText() }),
    ...(frequencyContext === null ? {} : { frequency: buildFrequency(frequencyContext) }),
    by: buildBy(byContext)
  }
}

export function buildScheduleAst(context: DocumentContext): ScheduleDocumentAst {
  return {
    statements: context.statement_list().map(buildStatement)
  }
}
