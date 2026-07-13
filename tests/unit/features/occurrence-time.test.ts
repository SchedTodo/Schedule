import { describe, expect, it } from 'vitest'

import { Temporal } from '@js-temporal/polyfill'

import {
  calendarRange,
  formatMarkedWallClock,
  occurrenceWallTime
} from '../../../src/features/schedule/occurrence-time'

describe('occurrenceWallTime', () => {
  it('converts one UTC instant into the selected wall-clock time', () => {
    expect(occurrenceWallTime('2026-07-13T23:30:00Z', 'UTC')).toEqual({
      date: '2026-07-13', hour: 23, minute: 30
    })
    expect(occurrenceWallTime('2026-07-13T23:30:00Z', 'Asia/Shanghai')).toEqual({
      date: '2026-07-14', hour: 7, minute: 30
    })
  })

  it('builds UTC query bounds from the selected calendar month', () => {
    expect(calendarRange(
      'Asia/Shanghai',
      Temporal.Instant.from('2026-07-31T16:30:00Z')
    )).toEqual({
      start: '2026-07-24T16:00:00Z',
      end: '2026-09-07T16:00:00Z',
      limit: 5000
    })
  })

  it('preserves unknown minute marks in wall-clock labels', () => {
    expect(formatMarkedWallClock('2026-07-15T02:00:00Z', '10', 'Asia/Shanghai')).toBe('10:?')
  })
})
