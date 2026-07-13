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

export type ParseResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly diagnostics: readonly Diagnostic[] }

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

export function expandScheduleOccurrences(
  recurrenceCode: string,
  exclusionCode: string,
  context: EvaluationContext
): ParseResult<readonly ScheduleOccurrenceDraft[]> {
  const recurrence = parseSchedule(recurrenceCode, context)
  if (!recurrence.ok) return recurrence
  const recurrenceKinds = new Set(recurrence.value.statements.map(({ kind }) => kind))
  if (recurrenceKinds.size !== 1) {
    return { ok: false, diagnostics: [semanticDiagnostic('INVALID_RECURRENCE', 'Recurrence statements must have one schedule kind')] }
  }
  const recurrenceOccurrences = expandScheduleSpec(recurrence.value)
  if (exclusionCode.trim() === '') return { ok: true, value: recurrenceOccurrences }

  const exclusion = parseSchedule(exclusionCode, context)
  if (!exclusion.ok) return exclusion
  const exclusionKinds = new Set(exclusion.value.statements.map(({ kind }) => kind))
  if (exclusionKinds.size !== 1 || exclusionKinds.values().next().value !== recurrenceKinds.values().next().value) {
    return { ok: false, diagnostics: [semanticDiagnostic('INVALID_RECURRENCE', 'Exclusion kind must match recurrence kind')] }
  }
  const exclusionKeys = new Set(expandScheduleSpec(exclusion.value).map(occurrenceKey))
  const included = recurrenceOccurrences.filter((value) => !exclusionKeys.has(occurrenceKey(value)))
  const excluded = recurrenceOccurrences
    .filter((value) => exclusionKeys.has(occurrenceKey(value)))
    .map((value) => ({ ...value, excluded: true }))
  return { ok: true, value: [...included, ...excluded] }
}
