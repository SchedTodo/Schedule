import { Temporal } from '@js-temporal/polyfill'
import { describe, expect, it } from 'vitest'

import type { ScheduleOccurrenceDto } from '../../../src/contracts/occurrence.contract'
import {
  formatOccurrenceDateTime,
  occurrenceWeekday,
  sortDetailOccurrences
} from '../../../src/features/schedule/schedule-detail-presentation'

function occurrence(id: string, day: number): ScheduleOccurrenceDto {
  return {
    id: `20000000-0000-4000-8000-${id.padStart(12, '0')}`,
    scheduleId: '10000000-0000-4000-8000-000000000001',
    kind: 'event',
    title: 'Review',
    excluded: false,
    start: `2026-07-${String(day).padStart(2, '0')}T05:00:00Z`,
    end: `2026-07-${String(day).padStart(2, '0')}T06:00:00Z`,
    startMark: '11',
    endMark: '11',
    comment: '',
    done: false
  }
}

describe('schedule detail presentation', () => {
  it('formats marked instants to minutes and derives the configured-zone weekday', () => {
    const value = occurrence('14', 14)
    expect(formatOccurrenceDateTime(value.start!, value.startMark, 'Asia/Shanghai'))
      .toBe('2026/7/14 13:00')
    expect(formatOccurrenceDateTime(value.start!, '10', 'Asia/Shanghai'))
      .toBe('2026/7/14 13:?')
    expect(occurrenceWeekday(value, 'Asia/Shanghai', 'zh-CN')).toBe('星期二')
  })

  it('places today and future first, then past occurrences in ascending order', () => {
    const values = [13, 17, 15, 14, 16].map((day) => occurrence(String(day), day))
    const sorted = sortDetailOccurrences(
      values,
      'Asia/Shanghai',
      Temporal.Instant.from('2026-07-14T04:00:00Z')
    )

    expect(sorted.map(({ start }) => start?.slice(8, 10))).toEqual(['14', '15', '16', '17', '13'])
  })
})
