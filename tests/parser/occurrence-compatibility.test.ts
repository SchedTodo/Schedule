import { Temporal } from '@js-temporal/polyfill'
import { describe, expect, it } from 'vitest'

import { expandScheduleOccurrences } from '../../src/parser/parse-schedule'
import type { EvaluationContext } from '../../src/parser/evaluator'

const context: EvaluationContext = {
  now: Temporal.Instant.from('2026-07-11T02:00:00Z'),
  defaultTimeZone: 'Asia/Shanghai',
  weekStartsOn: 1,
  resolveTimeZoneAbbreviation: () => ({ kind: 'unknown' })
}

function expand(recurrenceCode: string, exclusionCode = '') {
  const result = expandScheduleOccurrences(recurrenceCode, exclusionCode, context)
  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error(result.diagnostics[0]?.message)
  return result.value
}

describe('legacy-compatible occurrence expansion', () => {
  it('converts a concrete local event range to UTC', () => {
    expect(expand('2026/7/13 10:00-11:00;')).toEqual([{
      excluded: false,
      start: '2026-07-13T02:00:00Z',
      end: '2026-07-13T03:00:00Z',
      startMark: '11',
      endMark: '11',
      comment: '',
      done: false
    }])
  })

  it('stores a Todo deadline with no start', () => {
    expect(expand('2026/7/13 10:00;')[0]).toMatchObject({
      start: null,
      end: '2026-07-13T02:00:00Z'
    })
  })

  it('moves an overnight event end to the next day', () => {
    expect(expand('2026/7/13 23:00-1:00;')[0]).toMatchObject({
      start: '2026-07-13T15:00:00Z',
      end: '2026-07-13T17:00:00Z'
    })
  })

  it('expands an inclusive daily date range', () => {
    expect(expand('2026/7/13-15 10:00 daily;').map(({ end }) => end)).toEqual([
      '2026-07-13T02:00:00Z',
      '2026-07-14T02:00:00Z',
      '2026-07-15T02:00:00Z'
    ])
  })

  it('expands every selected weekday in a weekly recurrence', () => {
    expect(expand('2026/7/13-19 10:00 weekly by[day[1,3]];').map(({ end }) => end)).toEqual([
      '2026-07-13T02:00:00Z',
      '2026-07-15T02:00:00Z'
    ])
  })

  it('applies setpos after collecting each monthly weekday candidate set', () => {
    const values = expand(
      '2026/7/1-8/31 17:00-18:00 monthly by[day[1,2,3,4,5],setpos[-1]];'
    )

    expect(values.map(({ start }) => start)).toEqual([
      '2026-07-31T09:00:00Z',
      '2026-08-31T09:00:00Z'
    ])
  })

  it('supports positive setpos values without duplicating candidates', () => {
    const values = expand(
      '2026/7/1-8/31 17:00-18:00 monthly by[day[1,2,3,4,5],setpos[1,1]];'
    )

    expect(values.map(({ start }) => start)).toEqual([
      '2026-07-01T09:00:00Z',
      '2026-08-03T09:00:00Z'
    ])
  })

  it('marks recurrence/exclusion intersections as excluded', () => {
    const values = expand('2026/7/13-15 10:00 daily;', '2026/7/14 10:00;')
    expect(values.map(({ end, excluded }) => [end, excluded])).toEqual([
      ['2026-07-13T02:00:00Z', false],
      ['2026-07-15T02:00:00Z', false],
      ['2026-07-14T02:00:00Z', true]
    ])
  })

  it('preserves unknown minute marks using zero as the stored value', () => {
    expect(expand('2026/7/13 10:?-11:?;')[0]).toMatchObject({
      start: '2026-07-13T02:00:00Z',
      end: '2026-07-13T03:00:00Z',
      startMark: '10',
      endMark: '10'
    })
  })
})
