import { describe, expect, it } from 'vitest'

import { parseFirstScheduleDate } from '../../../src/features/schedule/recurrence-presentation'

describe('parseFirstScheduleDate', () => {
  it('parses the first ISO or slash date and time', () => {
    expect(parseFirstScheduleDate('2026-07-12 10:30 weekly;')).toEqual({
      dateKey: '2026-07-12',
      timeLabel: '10:30'
    })
    expect(parseFirstScheduleDate('at 2026/7/3 8:05')).toEqual({
      dateKey: '2026-07-03',
      timeLabel: '08:05'
    })
  })

  it('does not invent a date for abstract recurrence text', () => {
    expect(parseFirstScheduleDate('weekly on monday')).toBeNull()
    expect(parseFirstScheduleDate('')).toBeNull()
  })
})
