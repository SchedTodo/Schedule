import { Temporal } from '@js-temporal/polyfill'
import { describe, expect, it } from 'vitest'

import { expandScheduleSpec } from '../../src/domain/schedule/occurrence'
import type { EvaluationContext } from '../../src/parser/evaluator'
import { normalizeSchedule } from '../../src/parser/parse-schedule'

const context: EvaluationContext = {
  now: Temporal.Instant.from('2026-07-12T16:30:00Z'),
  defaultTimeZone: 'Asia/Shanghai',
  weekStartsOn: 1,
  resolveTimeZoneAbbreviation: (value) => value === 'CST'
    ? { kind: 'resolved', timeZone: 'America/Chicago' }
    : { kind: 'unknown' }
}

describe('normalizeSchedule', () => {
  it('embeds the configured time zone while expanding UTC instants', () => {
    const result = normalizeSchedule('tdy 10:00-11:00;', context)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.code).toBe('2026/7/13 10:00-11:00 Asia/Shanghai;')
    expect(expandScheduleSpec(result.value.spec)[0]).toMatchObject({
      start: '2026-07-13T02:00:00Z',
      end: '2026-07-13T03:00:00Z'
    })
  })

  it('keeps explicit zones and resolves abbreviations to full identifiers', () => {
    const explicit = normalizeSchedule('2026/7/13 10:00 America/Chicago;', context)
    const abbreviated = normalizeSchedule('2026/7/13 10:00 CST;', context)

    expect(explicit.ok && explicit.value.code).toBe('2026/7/13 10:00 America/Chicago;')
    expect(abbreviated.ok && abbreviated.value.code).toBe('2026/7/13 10:00 America/Chicago;')
  })

  it('round trips normalized UTC rules without abbreviation resolution', () => {
    const utcContext: EvaluationContext = {
      ...context,
      defaultTimeZone: 'UTC',
      resolveTimeZoneAbbreviation: () => ({ kind: 'unknown' })
    }
    const first = normalizeSchedule('2026/7/13 10:00;', utcContext)
    expect(first.ok && first.value.code).toBe('2026/7/13 10:00 UTC;')
    if (!first.ok) return

    const second = normalizeSchedule(first.value.code, utcContext)
    expect(second.ok && second.value.code).toBe(first.value.code)
  })

  it('round trips valid IANA identifiers containing digits and plus signs', () => {
    const fixedZoneContext: EvaluationContext = {
      ...context,
      defaultTimeZone: 'Etc/GMT+8'
    }
    const first = normalizeSchedule('2026/7/13 10:00;', fixedZoneContext)
    expect(first.ok && first.value.code).toBe('2026/7/13 10:00 Etc/GMT+8;')
    if (!first.ok) return

    const second = normalizeSchedule(first.value.code, fixedZoneContext)
    expect(second.ok && second.value.code).toBe(first.value.code)
  })

  it('preserves explicit daily without inserting implicit daily', () => {
    const implicit = normalizeSchedule('2026/7/13-17 13:00-14:00;', context)
    const explicit = normalizeSchedule('2026/7/13-17 13:00-14:00 daily;', context)

    expect(implicit.ok && implicit.value.code)
      .toBe('2026/7/13-2026/7/17 13:00-14:00 Asia/Shanghai;')
    expect(explicit.ok && explicit.value.code)
      .toBe('2026/7/13-2026/7/17 13:00-14:00 Asia/Shanghai daily;')
  })

  it('preserves explicit daily options', () => {
    const result = normalizeSchedule(
      '2026/7/13-17 13:00-14:00 daily,i2,c2;',
      context
    )

    expect(result.ok && result.value.code)
      .toBe('2026/7/13-2026/7/17 13:00-14:00 Asia/Shanghai daily,i2,c2;')
  })
})
