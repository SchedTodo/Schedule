import type { Completion, CompletionContext, CompletionResult } from '@codemirror/autocomplete'
import { snippetCompletion } from '@codemirror/autocomplete'
import type { Diagnostic as CodeMirrorDiagnostic } from '@codemirror/lint'
import { CharStreams, CommonTokenStream, ErrorListener, type RecognitionException, type Recognizer, type Token } from 'antlr4'

import type { SettingsDto } from '../../../contracts/settings.contract'
import { Temporal } from '../../../domain/shared/temporal'
import type { Diagnostic } from '../../../parser/diagnostics'
import ScheduleLexer from '../../../parser/generated/ScheduleLexer'
import ScheduleParser from '../../../parser/generated/ScheduleParser'
import { parseSchedule } from '../../../parser/parse-schedule'
import {
  scheduleLiteral,
  scheduleLiteralTokenTypes,
  tokenizeSchedule
} from '../../../parser/schedule-language'
import { resolveConfiguredTimeZoneAbbreviation } from '../../../parser/time-zone-abbreviations'

export type ScheduleEditorSettings = Pick<
  SettingsDto,
  'timeZone' | 'weekStart' | 'timeZoneAbbreviations'
>

interface LocalizedSemantic {
  readonly summary: readonly [zh: string, en: string]
  readonly description: readonly [zh: string, en: string]
  readonly example: string
  readonly preview: string
}

const completionSemantics: Readonly<Record<string, LocalizedSemantic>> = {
  tdy: {
    summary: ['今天', 'Today'],
    description: ['使用设置时区中的今天。', 'Use today in the configured time zone.'],
    example: 'tdy 10:00',
    preview: 'tdy'
  },
  tmr: {
    summary: ['明天', 'Tomorrow'],
    description: ['使用设置时区中的明天。', 'Use tomorrow in the configured time zone.'],
    example: 'tmr 10:00',
    preview: 'tmr'
  },
  now: {
    summary: ['当前时间', 'Current time'],
    description: ['使用保存时的当前墙上时间。', 'Use the current wall-clock time when saved.'],
    example: 'tdy now',
    preview: 'now'
  },
  start: {
    summary: ['当天开始', 'Start of day'],
    description: ['使用当天的开始时间。', 'Use the start of the day.'],
    example: 'tdy start',
    preview: 'start'
  },
  s: {
    summary: ['start 的缩写', 'Short for start'],
    description: ['与 start 相同，表示当天开始。', 'Equivalent to start, the start of the day.'],
    example: 'tdy s',
    preview: 's'
  },
  end: {
    summary: ['当天结束', 'End of day'],
    description: ['使用当天的结束时间。', 'Use the end of the day.'],
    example: 'tdy end',
    preview: 'end'
  },
  e: {
    summary: ['end 的缩写', 'Short for end'],
    description: ['与 end 相同，表示当天结束。', 'Equivalent to end, the end of the day.'],
    example: 'tdy e',
    preview: 'e'
  },
  daily: {
    summary: ['每天重复', 'Repeat daily'],
    description: ['按天重复当前日程。', 'Repeat the schedule every day.'],
    example: 'tdy 10:00 daily',
    preview: 'daily'
  },
  weekly: {
    summary: ['每周重复', 'Repeat weekly'],
    description: ['每周重复当前日程。', 'Repeat the schedule every week.'],
    example: 'tdy 10:00 weekly',
    preview: 'weekly'
  },
  monthly: {
    summary: ['每月重复', 'Repeat monthly'],
    description: ['按月重复当前日程。', 'Repeat the schedule every month.'],
    example: 'tdy 10:00 monthly',
    preview: 'monthly'
  },
  yearly: {
    summary: ['每年重复', 'Repeat yearly'],
    description: ['按年重复当前日程。', 'Repeat the schedule every year.'],
    example: 'tdy 10:00 yearly',
    preview: 'yearly'
  },
  by: {
    summary: ['筛选重复日期', 'Filter recurrence dates'],
    description: ['按字段筛选重复规则产生的日期。', 'Filter recurrence dates by a field.'],
    example: 'tdy 10:00 daily by[day[1]]',
    preview: 'by[day[1]]'
  },
  month: {
    summary: ['按月份筛选', 'Filter by month'],
    description: ['只保留指定月份。', 'Keep only the specified months.'],
    example: 'tdy 10:00 daily by[month[1]]',
    preview: 'month[1]'
  },
  weekno: {
    summary: ['按周序号筛选', 'Filter by week number'],
    description: ['只保留指定的年度周序号。', 'Keep only the specified week numbers.'],
    example: 'tdy 10:00 yearly by[weekno[1]]',
    preview: 'weekno[1]'
  },
  yearday: {
    summary: ['按年内日筛选', 'Filter by year day'],
    description: ['只保留指定的年内日序号。', 'Keep only the specified days of the year.'],
    example: 'tdy 10:00 yearly by[yearday[1]]',
    preview: 'yearday[1]'
  },
  monthday: {
    summary: ['按月内日筛选', 'Filter by month day'],
    description: ['只保留指定的月内日序号。', 'Keep only the specified days of the month.'],
    example: 'tdy 10:00 monthly by[monthday[1]]',
    preview: 'monthday[1]'
  },
  day: {
    summary: ['按星期筛选', 'Filter by weekday'],
    description: ['只保留指定星期。1 至 7 表示周一至周日。', 'Keep only the specified weekdays. 1 through 7 mean Monday through Sunday.'],
    example: 'tdy 10:00 weekly by[day[1]]',
    preview: 'day[1]'
  },
  setpos: {
    summary: ['按结果位置筛选', 'Filter by result position'],
    description: ['从其他筛选结果中选择指定位置。', 'Select positions from the other filtered results.'],
    example: 'tdy 10:00 monthly by[day[1],setpos[1]]',
    preview: 'setpos[1]'
  },
  UTC: {
    summary: ['UTC 时区', 'UTC time zone'],
    description: ['按协调世界时解释日程时间。', 'Interpret the schedule time as Coordinated Universal Time.'],
    example: 'tdy 10:00 UTC',
    preview: 'UTC'
  },
  '?': {
    summary: ['未知时间', 'Unknown time'],
    description: ['表示未知的小时或分钟。', 'Represent an unknown hour or minute.'],
    example: 'tdy ?',
    preview: '?'
  },
  '/': {
    summary: ['日期分隔符', 'Date separator'],
    description: ['分隔日期中的年、月、日。', 'Separate year, month, and day in a date.'],
    example: '7/12 10:00',
    preview: '/'
  },
  '-': {
    summary: ['范围分隔符', 'Range separator'],
    description: ['连接日期范围或时间范围的起点与终点。', 'Connect the start and end of a date or time range.'],
    example: 'tdy 10:00-11:00',
    preview: '-'
  },
  ':': {
    summary: ['时间分隔符', 'Time separator'],
    description: ['分隔小时和分钟；单独使用表示未知时间。', 'Separate hours and minutes; alone it represents an unknown time.'],
    example: 'tdy 10:30',
    preview: ':'
  },
  '.': {
    summary: ['时间分隔符', 'Time separator'],
    description: ['使用点号分隔小时和分钟。', 'Use a dot to separate hours and minutes.'],
    example: 'tdy 10.30',
    preview: '.'
  },
  ',': {
    summary: ['选项分隔符', 'Option separator'],
    description: ['分隔重复频率的附加选项。', 'Separate recurrence frequency options.'],
    example: 'tdy 10:00 daily,i2,c5',
    preview: ','
  },
  ';': {
    summary: ['语句分隔符', 'Statement separator'],
    description: ['分隔多条日程语句。', 'Separate multiple schedule statements.'],
    example: 'tdy 10:00;tmr 10:00',
    preview: ';'
  },
  '[': {
    summary: ['筛选开始', 'Filter start'],
    description: ['开始筛选字段或筛选列表。', 'Start a filter field or filter list.'],
    example: 'tdy 10:00 daily by[day[1]]',
    preview: '['
  },
  ']': {
    summary: ['筛选结束', 'Filter end'],
    description: ['结束筛选字段或筛选列表。', 'End a filter field or filter list.'],
    example: 'tdy 10:00 daily by[day[1]]',
    preview: ']'
  },
  durationHours: {
    summary: ['小时数', 'Hours'],
    description: ['输入以小时为单位的持续时间。', 'Enter a duration measured in hours.'],
    example: 'tdy 1h',
    preview: '1h'
  },
  durationMinutes: {
    summary: ['分钟数', 'Minutes'],
    description: ['输入以分钟为单位的持续时间。', 'Enter a duration measured in minutes.'],
    example: 'tdy 30m',
    preview: '1m'
  },
  interval: {
    summary: ['重复间隔', 'Recurrence interval'],
    description: ['设置每隔多少个频率周期重复。', 'Set how many frequency periods to skip between repeats.'],
    example: 'tdy 10:00 daily,i2',
    preview: 'i2'
  },
  count: {
    summary: ['重复次数', 'Recurrence count'],
    description: ['限制重复规则产生的次数。', 'Limit how many occurrences the recurrence produces.'],
    example: 'tdy 10:00 daily,c5',
    preview: 'c5'
  },
  timeZone: {
    summary: ['时区', 'Time zone'],
    description: ['按所选时区解释日程时间。', 'Interpret the schedule time in the selected time zone.'],
    example: 'tdy 10:00 UTC',
    preview: 'UTC'
  }
}

function localized(
  value: readonly [zh: string, en: string],
  language: string
): string {
  return language.toLowerCase().startsWith('zh') ? value[0] : value[1]
}

export function scheduleSemanticDescription(
  label: string,
  language: string
): string | undefined {
  const semantic = completionSemantics[label]
  return semantic === undefined ? undefined : localized(semantic.description, language)
}

export function scheduleSemanticStandardExamples(): readonly string[] {
  return [...new Set(Object.values(completionSemantics).map(({ example }) => example))]
}

interface ParseObservation {
  readonly expected: ReadonlySet<number>
  readonly firstErrorOffset?: number
}

class CompletionErrorListener extends ErrorListener<Token> {
  readonly expected = new Set<number>()
  firstErrorOffset: number | undefined

  override syntaxError(
    recognizer: Recognizer<Token>,
    offendingSymbol: Token,
    line: number,
    column: number,
    message: string,
    error: RecognitionException | undefined
  ): void {
    void line
    void column
    void message
    void error
    const parser = recognizer as ScheduleParser
    this.firstErrorOffset ??= offendingSymbol.start
    for (const interval of parser.getExpectedTokens().intervals ?? []) {
      for (let tokenType = interval.start; tokenType < interval.stop; tokenType += 1) {
        this.expected.add(tokenType)
      }
    }
  }
}

function observeParse(source: string): ParseObservation {
  const lexer = new ScheduleLexer(CharStreams.fromString(source))
  lexer.removeErrorListeners()
  const parser = new ScheduleParser(new CommonTokenStream(lexer))
  const listener = new CompletionErrorListener()
  parser.removeErrorListeners()
  parser.addErrorListener(listener)
  parser.document()
  return {
    expected: listener.expected,
    ...(listener.firstErrorOffset === undefined ? {} : { firstErrorOffset: listener.firstErrorOffset })
  }
}

const probeByTokenType = new Map<number, string>([
  [ScheduleLexer.IANA_ZONE, 'Etc/Example'],
  [ScheduleLexer.INTERVAL_OPTION, 'i1'],
  [ScheduleLexer.COUNT_OPTION, 'c1'],
  [ScheduleLexer.DURATION, '1h'],
  [ScheduleLexer.ZONE_ALIAS, 'Alias'],
  [ScheduleLexer.INTEGER, '1']
])

const completionTokenTypes = [
  ...scheduleLiteralTokenTypes(),
  ...probeByTokenType.keys()
].filter((tokenType) => tokenType !== ScheduleLexer.EOF)

function probeFor(tokenType: number): string | undefined {
  return scheduleLiteral(tokenType) ?? probeByTokenType.get(tokenType)
}

/**
 * 先使用 parser 的 expected-token 集，再用候选探针补齐可选分支。
 * 探针是否被消费完全由生成 parser 判断，因此不维护第二套语法状态机。
 */
export function expectedScheduleTokenTypes(prefix: string): ReadonlySet<number> {
  const directObservation = observeParse(prefix)
  if (
    directObservation.firstErrorOffset !== undefined &&
    directObservation.firstErrorOffset < prefix.length
  ) {
    return new Set()
  }
  const direct = directObservation.expected
  const result = new Set(direct)

  for (const tokenType of completionTokenTypes) {
    const probe = probeFor(tokenType)
    if (probe === undefined) continue
    const observation = observeParse(`${prefix}${probe}`)
    if (
      observation.firstErrorOffset === undefined ||
      observation.firstErrorOffset >= prefix.length + probe.length
    ) {
      result.add(tokenType)
    }
  }
  return result
}

function completionRange(source: string, cursor: number): { from: number; prefix: string } {
  const before = source.slice(0, cursor)
  const match = /(?:[A-Za-z_][A-Za-z0-9_+/-]*|[0-9]+[A-Za-z]?)$/u.exec(before)
  const prefix = match?.[0] ?? ''
  return { from: cursor - prefix.length, prefix }
}

function runtimeTimeZones(): readonly string[] {
  return typeof Intl.supportedValuesOf === 'function'
    ? Intl.supportedValuesOf('timeZone')
    : []
}

function timeZoneCompletions(
  prefix: string,
  explicit: boolean,
  settings: ScheduleEditorSettings,
  presentation: CompletionPresentationContext
): Completion[] {
  const aliases = Object.keys(settings.timeZoneAbbreviations)
  const preferred = new Set(['UTC', settings.timeZone, ...aliases])
  const includeAll = prefix !== '' || explicit
  const values = new Set(includeAll ? [...preferred, ...runtimeTimeZones()] : preferred)
  const normalizedPrefix = prefix.toLowerCase()

  return [...values]
    .filter((value) => value.toLowerCase().startsWith(normalizedPrefix))
    .sort((left, right) => {
      const leftExact = left.toLowerCase() === normalizedPrefix
      const rightExact = right.toLowerCase() === normalizedPrefix
      if (leftExact !== rightExact) return leftExact ? -1 : 1
      const leftAlias = aliases.includes(left)
      const rightAlias = aliases.includes(right)
      if (leftAlias !== rightAlias) return leftAlias ? -1 : 1
      const leftPreferred = left === 'UTC' || left === settings.timeZone
      const rightPreferred = right === 'UTC' || right === settings.timeZone
      if (leftPreferred !== rightPreferred) return leftPreferred ? -1 : 1
      return left.localeCompare(right)
    })
    .map((label) => {
      const mapping = aliases.includes(label)
        ? settings.timeZoneAbbreviations[label]
        : 'IANA time zone'
      return withSemantic({
        label,
        type: aliases.includes(label) ? 'variable' : 'constant',
      }, 'timeZone', label, presentation, mapping, `tdy 10:00 ${label}`)
    })
}

interface CompletionPresentationContext {
  readonly source: string
  readonly from: number
  readonly to: number
  readonly settings: ScheduleEditorSettings
  readonly language: string
}

function parsesAsSchedule(source: string, settings: ScheduleEditorSettings): boolean {
  return parseSchedule(source, {
    now: Temporal.Instant.fromEpochMilliseconds(Date.now()),
    defaultTimeZone: settings.timeZone,
    weekStartsOn: settings.weekStart,
    resolveTimeZoneAbbreviation: (value) =>
      resolveConfiguredTimeZoneAbbreviation(value, settings.timeZoneAbbreviations)
  }).ok
}

function dynamicPreview(
  insertion: string,
  context: CompletionPresentationContext
): string | undefined {
  const statementStart = context.source.lastIndexOf(';', Math.max(0, context.from - 1)) + 1
  const followingSemicolon = context.source.indexOf(';', context.to)
  const statementEnd = followingSemicolon < 0 ? context.source.length : followingSemicolon
  const preview = `${
    context.source.slice(statementStart, context.from)
  }${insertion}${
    context.source.slice(context.to, statementEnd)
  }`.trim()
  return parsesAsSchedule(preview, context.settings) ? preview : undefined
}

function withSemantic(
  completion: Completion,
  semanticKey: string,
  insertion: string,
  context: CompletionPresentationContext,
  extraDetail?: string,
  fallbackExample?: string
): Completion {
  const semantic = completionSemantics[semanticKey]
  if (semantic === undefined) return completion
  const summary = localized(semantic.summary, context.language)
  const description = localized(semantic.description, context.language)
  const preview = dynamicPreview(insertion, context)
  const isChinese = context.language.toLowerCase().startsWith('zh')
  const exampleLabel = preview !== undefined
    ? (isChinese ? '补全预览' : 'Completion preview')
    : (isChinese ? '标准示例' : 'Standard example')
  const example = preview ?? fallbackExample ?? semantic.example
  return {
    ...completion,
    detail: extraDetail === undefined ? summary : `${summary} · ${extraDetail}`,
    info: `${description}\n\n${exampleLabel}: ${example}`
  }
}

function literalCompletion(
  tokenType: number,
  presentation: CompletionPresentationContext
): Completion | undefined {
  const label = scheduleLiteral(tokenType)
  if (label === undefined) return undefined
  const bracketedTypes = new Set([
    ScheduleLexer.BY,
    ScheduleLexer.MONTH,
    ScheduleLexer.WEEKNO,
    ScheduleLexer.YEARDAY,
    ScheduleLexer.MONTHDAY,
    ScheduleLexer.DAY,
    ScheduleLexer.SETPOS
  ])
  const keywordTypes = new Set([
    ScheduleLexer.TODAY,
    ScheduleLexer.TOMORROW,
    ScheduleLexer.NOW,
    ScheduleLexer.START_OF_DAY,
    ScheduleLexer.START_OF_DAY_SHORT,
    ScheduleLexer.END_OF_DAY,
    ScheduleLexer.END_OF_DAY_SHORT,
    ScheduleLexer.DAILY,
    ScheduleLexer.WEEKLY,
    ScheduleLexer.MONTHLY,
    ScheduleLexer.YEARLY,
    ScheduleLexer.BY,
    ScheduleLexer.MONTH,
    ScheduleLexer.WEEKNO,
    ScheduleLexer.YEARDAY,
    ScheduleLexer.MONTHDAY,
    ScheduleLexer.DAY,
    ScheduleLexer.SETPOS
  ])
  const completion = {
    label,
    type: keywordTypes.has(tokenType) ? 'keyword' : 'text'
  }
  const result = bracketedTypes.has(tokenType)
    ? snippetCompletion(`${label}[\${1}]`, completion)
    : completion
  const semantic = completionSemantics[label]
  return semantic === undefined
    ? result
    : withSemantic(result, label, semantic.preview, presentation)
}

function providerCompletions(
  tokenType: number,
  prefix: string,
  explicit: boolean,
  settings: ScheduleEditorSettings,
  presentation: CompletionPresentationContext
): Completion[] {
  if (tokenType === ScheduleLexer.IANA_ZONE || tokenType === ScheduleLexer.ZONE_ALIAS) {
    return timeZoneCompletions(prefix, explicit, settings, presentation)
  }
  if (tokenType === ScheduleLexer.INTERVAL_OPTION) {
    return [withSemantic(
      snippetCompletion('i${1}', { label: 'i…', type: 'property' }),
      'interval',
      'i2',
      presentation
    )]
  }
  if (tokenType === ScheduleLexer.COUNT_OPTION) {
    return [withSemantic(
      snippetCompletion('c${1}', { label: 'c…', type: 'property' }),
      'count',
      'c5',
      presentation
    )]
  }
  if (tokenType === ScheduleLexer.DURATION) {
    return [
      withSemantic(
        snippetCompletion('${1}h', { label: '…h', type: 'unit' }),
        'durationHours',
        '1h',
        presentation
      ),
      withSemantic(
        snippetCompletion('${1}m', { label: '…m', type: 'unit' }),
        'durationMinutes',
        '1m',
        presentation
      )
    ]
  }
  return []
}

export function scheduleCompletionSource(
  settings: ScheduleEditorSettings,
  language = 'en-US'
) {
  return (context: CompletionContext): CompletionResult | null => {
    const source = context.state.doc.toString()
    const { from, prefix } = completionRange(source, context.pos)
    if (!context.explicit && prefix === '' && context.pos > 0 && !/\s|[,[;]$/u.test(source[context.pos - 1] ?? '')) {
      return null
    }
    const expected = expectedScheduleTokenTypes(source.slice(0, from))
    const presentation = {
      source,
      from,
      to: context.pos,
      settings,
      language
    }
    const options: Completion[] = []
    for (const tokenType of expected) {
      const literal = literalCompletion(tokenType, presentation)
      if (literal !== undefined && literal.label.toLowerCase().startsWith(prefix.toLowerCase())) {
        options.push(literal)
      }
      options.push(...providerCompletions(
        tokenType,
        prefix,
        context.explicit,
        settings,
        presentation
      ))
    }
    const unique = [...new Map(options.map((option) => [option.label, option])).values()]
    return unique.length === 0 ? null : { from, options: unique, filter: false }
  }
}

function locateDiagnostic(source: string, diagnostic: Diagnostic): Diagnostic {
  if (diagnostic.start !== 0 || diagnostic.end !== 1) return diagnostic
  const fragment = /:\s*(.+)$/u.exec(diagnostic.message)?.[1]
  if (fragment === undefined) return diagnostic
  const start = source.indexOf(fragment)
  if (start < 0) return diagnostic
  return { ...diagnostic, start, end: start + fragment.length }
}

function conciseDiagnosticMessage(message: string): string {
  return /(?:mismatched input|missing .+) '<EOF>'/u.test(message)
    ? 'Incomplete schedule expression'
    : message
}

export function scheduleDiagnostics(
  source: string,
  settings: ScheduleEditorSettings,
  allowEmpty = false
): CodeMirrorDiagnostic[] {
  if (allowEmpty && source.trim() === '') return []
  const result = parseSchedule(source, {
    now: Temporal.Instant.fromEpochMilliseconds(Date.now()),
    defaultTimeZone: settings.timeZone,
    weekStartsOn: settings.weekStart,
    resolveTimeZoneAbbreviation: (value) =>
      resolveConfiguredTimeZoneAbbreviation(value, settings.timeZoneAbbreviations)
  })
  if (result.ok) return []
  return result.diagnostics.map((raw) => {
    const diagnostic = locateDiagnostic(source, raw)
    return {
      from: Math.min(diagnostic.start, source.length),
      to: Math.min(Math.max(diagnostic.end, diagnostic.start + 1), Math.max(source.length, 1)),
      severity: diagnostic.severity,
      message: conciseDiagnosticMessage(diagnostic.message)
    }
  })
}

export type ScheduleHighlightKind =
  | 'keyword'
  | 'date'
  | 'time'
  | 'time-zone'
  | 'number'
  | 'operator'

export function scheduleHighlightKind(tokenType: number): ScheduleHighlightKind {
  if ([
    ScheduleLexer.TODAY, ScheduleLexer.TOMORROW
  ].includes(tokenType)) return 'date'
  if ([
    ScheduleLexer.NOW, ScheduleLexer.START_OF_DAY, ScheduleLexer.START_OF_DAY_SHORT,
    ScheduleLexer.END_OF_DAY, ScheduleLexer.END_OF_DAY_SHORT, ScheduleLexer.DURATION
  ].includes(tokenType)) return 'time'
  if ([ScheduleLexer.UTC, ScheduleLexer.IANA_ZONE, ScheduleLexer.ZONE_ALIAS].includes(tokenType)) {
    return 'time-zone'
  }
  if ([
    ScheduleLexer.DAILY, ScheduleLexer.WEEKLY, ScheduleLexer.MONTHLY,
    ScheduleLexer.YEARLY, ScheduleLexer.BY, ScheduleLexer.MONTH,
    ScheduleLexer.WEEKNO, ScheduleLexer.YEARDAY, ScheduleLexer.MONTHDAY,
    ScheduleLexer.DAY, ScheduleLexer.SETPOS
  ].includes(tokenType)) return 'keyword'
  if ([
    ScheduleLexer.INTEGER, ScheduleLexer.INTERVAL_OPTION, ScheduleLexer.COUNT_OPTION
  ].includes(tokenType)) return 'number'
  return 'operator'
}

export function highlightedScheduleTokens(source: string) {
  return tokenizeSchedule(source).map((token) => ({
    ...token,
    kind: scheduleHighlightKind(token.type)
  }))
}
