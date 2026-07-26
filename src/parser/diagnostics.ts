import { ErrorListener, type RecognitionException, type Recognizer, type Token } from 'antlr4'

export type DiagnosticCode =
  | 'UNEXPECTED_TOKEN'
  | 'INVALID_DATE'
  | 'INVALID_TIME'
  | 'INVALID_TIME_ZONE'
  | 'INVALID_RECURRENCE'

export interface Diagnostic {
  readonly code: DiagnosticCode
  readonly message: string
  readonly start: number
  readonly end: number
  readonly line: number
  readonly column: number
  readonly severity: 'error' | 'warning'
}

/** 将 ANTLR 的一基行号和零基列号转换为源码绝对偏移。 */
function offsetAt(source: string, line: number, column: number): number {
  const lines = source.split(/\r?\n/u)
  let offset = 0

  for (let index = 0; index < line - 1; index += 1) {
    offset += (lines[index]?.length ?? 0) + 1
  }

  return offset + column
}

/**
 * 收集 ANTLR 词法与语法错误，并转换为统一的源码诊断。
 *
 * 监听器优先使用 token 自带的范围；没有可用 token 时，根据行列位置计算
 * 绝对偏移，使调用方无需暴露或理解 ANTLR 的错误对象。
 */
export class SyntaxDiagnosticListener<TSymbol extends Token | number> extends ErrorListener<TSymbol> {
  /** 按 ANTLR 回调顺序收集的解析诊断。 */
  readonly diagnostics: Diagnostic[] = []

  constructor(private readonly source: string) {
    super()
  }

  /** 将词法器或解析器错误转换为统一且带源码范围的诊断。 */
  override syntaxError(
    recognizer: Recognizer<TSymbol>,
    offendingSymbol: TSymbol,
    line: number,
    column: number,
    message: string,
    error: RecognitionException | undefined
  ): void {
    void recognizer
    void error
    const fallbackStart = offsetAt(this.source, line, column)
    const unknownSymbol: unknown = offendingSymbol
    const token: Token | undefined =
      typeof unknownSymbol === 'object' && unknownSymbol !== null
        ? (unknownSymbol as Token)
        : undefined
    const start = token !== undefined && token.start >= 0 ? token.start : fallbackStart
    const end = token !== undefined && token.stop >= start ? token.stop + 1 : start + 1

    this.diagnostics.push({
      code: 'UNEXPECTED_TOKEN',
      message,
      start,
      end,
      line,
      column,
      severity: 'error'
    })
  }
}

/** 创建无法精确定位到语法 token 的文档级语义诊断。 */
export function semanticDiagnostic(
  code: Exclude<DiagnosticCode, 'UNEXPECTED_TOKEN'>,
  message: string
): Diagnostic {
  return {
    code,
    message,
    start: 0,
    end: 1,
    line: 1,
    column: 0,
    severity: 'error'
  }
}
