import { describe, expect, it } from 'vitest'

import {
  logicalDateForInstant,
  scheduleColor
} from '../../../src/features/schedule/week-presentation'

describe('week presentation', () => {
  it('assigns wall times before the logical day start to the previous date', () => {
    expect(logicalDateForInstant('2026-07-17T16:00:00Z', 'Asia/Shanghai', 6, 0))
      .toBe('2026-07-17')
    expect(logicalDateForInstant('2026-07-17T22:00:00Z', 'Asia/Shanghai', 6, 0))
      .toBe('2026-07-18')
  })

  it('selects one stable legacy palette color per schedule', () => {
    const scheduleId = '10000000-0000-4000-8000-000000000001'
    expect(scheduleColor(scheduleId)).toBe(scheduleColor(scheduleId))
    expect(scheduleColor(scheduleId)).toMatch(/^#[0-9A-Fa-f]{6}$/)
  })
})
