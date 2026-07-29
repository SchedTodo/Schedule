import { CharStreams, Token } from 'antlr4'

import ScheduleLexer from './generated/ScheduleLexer'

export interface ScheduleToken {
  readonly type: number
  readonly text: string
  readonly from: number
  readonly to: number
}

/** 使用生成 lexer 返回不暴露 ANTLR Token 的稳定词法结果。 */
export function tokenizeSchedule(source: string): ScheduleToken[] {
  const lexer = new ScheduleLexer(CharStreams.fromString(source))
  lexer.removeErrorListeners()
  return lexer.getAllTokens().map((token) => ({
    type: token.type,
    text: token.text ?? '',
    from: token.start,
    to: token.stop + 1
  }))
}

/** 返回生成 grammar 中某个 token 的固定 literal；正则 token 返回 undefined。 */
export function scheduleLiteral(tokenType: number): string | undefined {
  const literal = ScheduleLexer.literalNames[tokenType]
  return literal === null || literal === undefined
    ? undefined
    : literal.slice(1, -1)
}

/** 枚举 grammar 直接声明的固定 literal token。 */
export function scheduleLiteralTokenTypes(): number[] {
  return ScheduleLexer.literalNames.flatMap((literal, tokenType) =>
    literal === null || literal === undefined ? [] : [tokenType]
  )
}

/**
 * 缩写不区分大小写；仅当大小写规范形式都完整词法化为 ZONE_ALIAS 时才安全。
 * 因此新增 grammar 关键字会自动成为保留名称，无需维护第二份关键字表。
 */
export function isAvailableTimeZoneAbbreviation(value: string): boolean {
  return [...new Set([value.toLowerCase(), value.toUpperCase()])].every((variant) => {
    const tokens = tokenizeSchedule(variant)
    return tokens.length === 1 &&
      tokens[0]?.type === ScheduleLexer.ZONE_ALIAS &&
      tokens[0].text.length === variant.length
  })
}

export { ScheduleLexer, Token }
