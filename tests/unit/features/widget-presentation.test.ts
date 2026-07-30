import { describe, expect, it } from 'vitest'

import { Temporal } from '../../../src/domain/shared/temporal'
import { currentLogicalDayRange } from '../../../src/features/schedule/occurrence-time'
import { widgetFollowScrollTop } from '../../../src/features/schedule/widget-follow'

describe('desktop widget presentation', () => {
  it('queries the complete logical day containing now', () => {
    expect(currentLogicalDayRange(
      'UTC',
      6,
      0,
      Temporal.Instant.from('2026-07-13T02:00:00Z')
    )).toEqual({
      start: '2026-07-12T06:00:00Z',
      end: '2026-07-13T06:00:00Z',
      limit: 5000
    })
  })

  it('uses the current logical day after its configured boundary', () => {
    expect(currentLogicalDayRange(
      'Asia/Shanghai',
      6,
      0,
      Temporal.Instant.from('2026-07-13T04:00:00Z')
    )).toEqual({
      start: '2026-07-12T22:00:00Z',
      end: '2026-07-13T22:00:00Z',
      limit: 5000
    })
  })

  it('keeps current time at thirty percent and clamps at timeline edges', () => {
    expect(widgetFollowScrollTop(500, 400, 1400)).toBe(380)
    expect(widgetFollowScrollTop(50, 400, 1400)).toBe(0)
    expect(widgetFollowScrollTop(1350, 400, 1400)).toBe(1000)
  })
})
