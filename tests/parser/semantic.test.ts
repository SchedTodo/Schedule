import { Temporal } from '@js-temporal/polyfill'
import { describe, expect, it } from 'vitest'

import { parseSchedule } from '../../src/parser/parse-schedule'
import type { EvaluationContext } from '../../src/parser/evaluator'

const context: EvaluationContext = {
  now: Temporal.Instant.from('2026-07-11T02:00:00Z'),
  defaultTimeZone: 'Asia/Shanghai',
  weekStartsOn: 1,
  resolveTimeZoneAbbreviation: () => ({ kind: 'unknown' })
}

function expectDiagnostic(source: string, code: string) {
  const result = parseSchedule(source, context)
  expect(result.ok).toBe(false)
  if (result.ok) return
  expect(result.diagnostics[0]?.code).toBe(code)
}

describe('schedule semantic validation', () => {
  it('infers todo from a single time and event from a time range', () => {
    const todo = parseSchedule('2026/7/13 10:00;', context)
    const event = parseSchedule('2026/7/13 10:00-11:00;', context)

    expect(todo.ok && todo.value.statements[0]?.kind).toBe('todo')
    expect(event.ok && event.value.statements[0]?.kind).toBe('event')
  })

  it('rejects a non-positive interval and duplicate frequency options while preserving legacy count zero', () => {
    expectDiagnostic('2026/7/13-14 10:00 daily,i0;', 'INVALID_RECURRENCE')
    expect(parseSchedule('2026/7/13-14 10:00 daily,c0;', context).ok).toBe(true)
    expectDiagnostic('2026/7/13-14 10:00 daily,i2,i3;', 'INVALID_RECURRENCE')
  })

  it('rejects invalid by values', () => {
    expectDiagnostic('2026/7/13-14 10:00 by[day[8]];', 'INVALID_RECURRENCE')
    expectDiagnostic('2026/7/13-14 10:00 by[month[0]];', 'INVALID_RECURRENCE')
  })

  it('rejects an unknown IANA time zone', () => {
    expectDiagnostic('2026/7/13 10:00 Unknown/Nowhere;', 'INVALID_TIME_ZONE')
  })
})
