import { Temporal } from '@js-temporal/polyfill'
import { describe, expect, it } from 'vitest'

import { parseSchedule } from '../../src/parser/parse-schedule'
import type { EvaluationContext } from '../../src/parser/evaluator'

const context: EvaluationContext = {
  now: Temporal.Instant.from('2026-07-11T02:00:00Z'),
  defaultTimeZone: 'Asia/Shanghai',
  weekStartsOn: 1,
  resolveTimeZoneAbbreviation: (value) =>
    value === 'CST'
      ? { kind: 'resolved', timeZone: 'America/Chicago' }
      : { kind: 'unknown' }
}

function statement(source: string) {
  const result = parseSchedule(source, context)
  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error(result.diagnostics[0]?.message)
  return result.value.statements[0]!
}

describe('schedule grammar golden cases', () => {
  it('resolves today and tomorrow from the injected clock', () => {
    expect(statement('tdy 10:00;').startDate).toBe('2026-07-11')
    expect(statement('tmr 10:00;').startDate).toBe('2026-07-12')
  })

  it('moves an omitted year to the next future month/day', () => {
    expect(statement('7/10 10:00;').startDate).toBe('2027-07-10')
  })

  it('inherits omitted end-date year and month', () => {
    const value = statement('2026/7/10-20 10:00;')
    expect(value.startDate).toBe('2026-07-10')
    expect(value.endDate).toBe('2026-07-20')
  })

  it('resolves a supported time-zone abbreviation', () => {
    expect(statement('2026/7/10 10:00 CST;').timeZone).toBe('America/Chicago')
  })

  it('parses start/end aliases and dot-separated time', () => {
    expect(statement('2026/7/10 start-end;')).toMatchObject({
      startTime: { hour: 0, minute: 0 },
      endTime: { hour: 23, minute: 59 }
    })
    expect(statement('2026/7/10 2.30-3.45;')).toMatchObject({
      startTime: { hour: 2, minute: 30 },
      endTime: { hour: 3, minute: 45 }
    })
  })

  it('preserves unknown time components', () => {
    expect(statement('2026/7/10 ?:?-3:;')).toMatchObject({
      startTime: { hour: null, minute: null },
      endTime: { hour: 3, minute: null }
    })
  })

  it('parses multiple semicolon-separated statements', () => {
    const result = parseSchedule('2026/7/10 10:00; 2026/7/11 11:00;', context)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.statements).toHaveLength(2)
  })
})
