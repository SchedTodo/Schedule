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
  const first = values[0] ?? (context.timeDuration() === null ? undefined : 'now')
  if (first === undefined) throw new Error('TIME_RANGE_EMPTY')
  return values[1] === undefined ? [first] : [first, values[1]]
}

function buildDuration(
  context: TimeRangeContext
): ScheduleStatementAst['duration'] {
  const duration = context.timeDuration()
  if (duration === null) return undefined
  const source = duration.getText()
  return {
    value: Number(source.slice(0, -1)),
    unit: source.endsWith('h') ? 'hours' : 'minutes'
  }
}

/** 从语法树提取频率及其选项，并保留重复选项供语义校验报告。 */
function buildFrequency(context: FrequencyContext): NonNullable<ScheduleStatementAst['frequency']> {
  let interval: number | undefined
  let count: number | undefined
  let intervalCount = 0
  let countCount = 0

  for (const option of context.frequencyOption_list()) {
    const source = option.getText()
    const value = Number(source.slice(1))
    if (source.startsWith('i')) {
      interval = value
      intervalCount += 1
    }
    if (source.startsWith('c')) {
      count = value
      countCount += 1
    }
  }

  return {
    unit: context.frequencyUnit().getText() as FrequencyUnit,
    ...(interval === undefined ? {} : { interval }),
    ...(count === undefined ? {} : { count }),
    hasDuplicateOptions: intervalCount > 1 || countCount > 1
  }
}

/** 将各 BY 子句转换为按类型索引的数值数组。 */
function buildBy(context: ByClauseContext | null): Readonly<Record<string, readonly number[]>> {
  if (context === null) return {}

  return Object.fromEntries(
    context.byItem_list().map((item) => [
      item.byType().getText(),
      item.signedInteger_list().map((value) => Number(value.getText()))
    ])
  )
}

/** 将单条 ANTLR 语句节点转换为不依赖解析器上下文的 AST。 */
function buildStatement(context: StatementContext): ScheduleStatementAst {
  const timeRangeContext = context.timeRange()
  const timeZoneContext = context.timeZone() as TimeZoneContext | null
  const frequencyContext = context.frequency() as FrequencyContext | null
  const byContext = context.byClause() as ByClauseContext | null
  const duration = buildDuration(timeRangeContext)

  const statement: ScheduleStatementAst = {
    dates: buildDates(context.dateRange()),
    times: buildTimes(timeRangeContext),
    ...(timeZoneContext === null ? {} : { timeZone: timeZoneContext.getText() }),
    ...(frequencyContext === null ? {} : { frequency: buildFrequency(frequencyContext) }),
    by: buildBy(byContext)
  }
  return duration === undefined ? statement : { ...statement, duration }
}

/** 将完整文档语法树转换为平台无关的日程 AST。 */
export function buildScheduleAst(context: DocumentContext): ScheduleDocumentAst {
  return {
    statements: context.statement_list().map(buildStatement)
  }
}
