import { CharStreams, CommonTokenStream } from 'antlr4'

import ScheduleLexer from './generated/ScheduleLexer'
import ScheduleParser from './generated/ScheduleParser'
import { buildScheduleAst } from './ast-builder'
import type { Diagnostic } from './diagnostics'
import { semanticDiagnostic, SyntaxDiagnosticListener } from './diagnostics'
import type { EvaluationContext, ScheduleSpec } from './evaluator'
import { evaluateSchedule } from './evaluator'
import type { ScheduleOccurrenceDraft } from '../contracts/occurrence.contract'
import { expandScheduleSpec, occurrenceKey } from '../domain/schedule/occurrence'
import { serializeScheduleSpec } from './serialize-schedule'

export type ParseResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly diagnostics: readonly Diagnostic[] }

/** 执行词法分析、语法分析、AST 构建和语义求值的完整解析流水线。 */
export function parseSchedule(
  source: string,
  context: EvaluationContext
): ParseResult<ScheduleSpec> {
  const input = CharStreams.fromString(source)
  const lexer = new ScheduleLexer(input)
  const tokens = new CommonTokenStream(lexer)
  const parser = new ScheduleParser(tokens)
  const lexerListener = new SyntaxDiagnosticListener<number>(source)
  const parserListener = new SyntaxDiagnosticListener<import('antlr4').Token>(source)

  lexer.removeErrorListeners()
  parser.removeErrorListeners()
  lexer.addErrorListener(lexerListener)
  parser.addErrorListener(parserListener)

  const tree = parser.document()
  const diagnostics = [...lexerListener.diagnostics, ...parserListener.diagnostics]
  if (diagnostics.length > 0) {
    return { ok: false, diagnostics }
  }

  return evaluateSchedule(buildScheduleAst(tree), context)
}

/** 解析日程代码并序列化为稳定的规范格式。 */
export function normalizeSchedule(
  source: string,
  context: EvaluationContext
): ParseResult<{ readonly code: string; readonly spec: ScheduleSpec }> {
  const result = parseSchedule(source, context)
  return result.ok
    ? { ok: true, value: { code: serializeScheduleSpec(result.value), spec: result.value } }
    : result
}

export interface NormalizedScheduleOccurrences {
  readonly recurrenceCode: string
  readonly exclusionCode: string
  readonly occurrences: readonly ScheduleOccurrenceDraft[]
  readonly kind: 'event' | 'todo'
}

/**
 * 规范化重复与排除规则，展开 occurrence，并标记两组规则的交集。
 *
 * 同一日程内的所有语句必须具有相同类型，排除规则类型也必须与重复规则一致。
 */
export function normalizeScheduleOccurrences(
  recurrenceCode: string,
  exclusionCode: string,
  context: EvaluationContext
): ParseResult<NormalizedScheduleOccurrences> {
  const recurrence = normalizeSchedule(recurrenceCode, context)
  if (!recurrence.ok) return recurrence
  const recurrenceKinds = new Set(recurrence.value.spec.statements.map(({ kind }) => kind))
  if (recurrenceKinds.size !== 1) {
    return { ok: false, diagnostics: [semanticDiagnostic('INVALID_RECURRENCE', 'Recurrence statements must have one schedule kind')] }
  }
  const kind = recurrenceKinds.values().next().value!
  const recurrenceOccurrences = expandScheduleSpec(recurrence.value.spec)
  if (exclusionCode.trim() === '') {
    return {
      ok: true,
      value: {
        recurrenceCode: recurrence.value.code,
        exclusionCode: '',
        occurrences: recurrenceOccurrences,
        kind
      }
    }
  }

  const exclusion = normalizeSchedule(exclusionCode, context)
  if (!exclusion.ok) return exclusion
  const exclusionKinds = new Set(exclusion.value.spec.statements.map(({ kind: value }) => value))
  if (exclusionKinds.size !== 1 || exclusionKinds.values().next().value !== kind) {
    return { ok: false, diagnostics: [semanticDiagnostic('INVALID_RECURRENCE', 'Exclusion kind must match recurrence kind')] }
  }
  const exclusionKeys = new Set(expandScheduleSpec(exclusion.value.spec).map(occurrenceKey))
  const included = recurrenceOccurrences.filter((value) => !exclusionKeys.has(occurrenceKey(value)))
  const excluded = recurrenceOccurrences
    .filter((value) => exclusionKeys.has(occurrenceKey(value)))
    .map((value) => ({ ...value, excluded: true }))
  return {
    ok: true,
    value: {
      recurrenceCode: recurrence.value.code,
      exclusionCode: exclusion.value.code,
      occurrences: [...included, ...excluded],
      kind
    }
  }
}

/** 规范化规则并仅返回最终展开的 occurrence 草稿。 */
export function expandScheduleOccurrences(
  recurrenceCode: string,
  exclusionCode: string,
  context: EvaluationContext
): ParseResult<readonly ScheduleOccurrenceDraft[]> {
  const result = normalizeScheduleOccurrences(recurrenceCode, exclusionCode, context)
  return result.ok ? { ok: true, value: result.value.occurrences } : result
}
