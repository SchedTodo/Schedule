import { Temporal } from '@js-temporal/polyfill'
import { describe, expect, it } from 'vitest'

import { parseSchedule } from '../../src/parser/parse-schedule'
import type { EvaluationContext } from '../../src/parser/evaluator'

const context: EvaluationContext = {
  now: Temporal.Instant.from('2026-07-11T02:00:00Z'),
  defaultTimeZone: 'Asia/Shanghai',
  weekStartsOn: 1,
  resolveTimeZoneAbbreviation: (value) => ({
    kind: 'resolved',
    timeZone: value === 'CST' ? 'America/Chicago' : value
  })
}

describe('parseSchedule', () => {
  it('parses a complete recurring schedule statement', () => {
    const result = parseSchedule(
      '2026/7/13-8/13 10:00-11:00 America/Chicago weekly,i2,c3 by[day[1,3],month[7,8]];',
      context
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.statements).toHaveLength(1)
    expect(result.value.statements[0]).toMatchObject({
      startDate: '2026-07-13',
      endDate: '2026-08-13',
      startTime: { hour: 10, minute: 0 },
      endTime: { hour: 11, minute: 0 },
      timeZone: 'America/Chicago',
      frequency: {
        unit: 'weekly',
        interval: 2,
        count: 3
      },
      by: {
        day: [1, 3],
        month: [7, 8]
      }
    })
  })

  it('uses the context time zone when the statement omits one', () => {
    const result = parseSchedule('2026/7/13 10:00;', context)

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.statements[0]?.timeZone).toBe('Asia/Shanghai')
  })

  it('returns a positioned diagnostic for invalid syntax', () => {
    const result = parseSchedule('2026/7/13 10:00 nonsense,i2;', context)

    expect(result.ok).toBe(false)
    if (result.ok) return

    expect(result.diagnostics[0]).toMatchObject({
      code: 'UNEXPECTED_TOKEN',
      line: 1
    })
    expect(result.diagnostics[0]?.column).toBeGreaterThan(0)
    expect(result.diagnostics[0]?.start).toBeGreaterThan(0)
  })
})
