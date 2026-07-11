import { CharStreams, CommonTokenStream } from 'antlr4'

import ScheduleLexer from './generated/ScheduleLexer'
import ScheduleParser from './generated/ScheduleParser'
import { buildScheduleAst } from './ast-builder'
import type { Diagnostic } from './diagnostics'
import { SyntaxDiagnosticListener } from './diagnostics'
import type { EvaluationContext, ScheduleSpec } from './evaluator'
import { evaluateSchedule } from './evaluator'

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
