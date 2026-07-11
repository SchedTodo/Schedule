import { Temporal } from '@js-temporal/polyfill'
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import { parseSchedule } from '../../src/parser/parse-schedule'
import type { EvaluationContext } from '../../src/parser/evaluator'

const context: EvaluationContext = {
  now: Temporal.Instant.from('2026-07-11T02:00:00Z'),
  defaultTimeZone: 'Asia/Shanghai',
  weekStartsOn: 1,
  resolveTimeZoneAbbreviation: () => ({ kind: 'unknown' })
}

describe('schedule parser properties', () => {
  it('parses valid calendar and clock components', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2000, max: 2100 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 28 }),
        fc.integer({ min: 0, max: 23 }),
        fc.integer({ min: 0, max: 59 }),
        (year, month, day, hour, minute) => {
          const result = parseSchedule(`${year}/${month}/${day} ${hour}:${minute};`, context)
          expect(result.ok).toBe(true)
        }
      )
    )
  })

  it('never accepts an invalid month or hour', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 13, max: 99 }),
        fc.integer({ min: 24, max: 99 }),
        (month, hour) => {
          expect(parseSchedule(`2026/${month}/1 10:00;`, context).ok).toBe(false)
          expect(parseSchedule(`2026/7/1 ${hour}:00;`, context).ok).toBe(false)
        }
      )
    )
  })
})
