import { Temporal } from '@js-temporal/polyfill'
import { describe, expect, it } from 'vitest'

import type { ScheduleOccurrenceDto } from '../../../src/contracts/occurrence.contract'
import {
  formatOccurrenceDateTime,
  occurrenceWeekday,
  sortDetailOccurrences
} from '../../../src/features/schedule/schedule-detail-presentation'
import { TEST_LOCALE, TEST_NOW, TEST_TIME_ZONE } from '../../support/time'

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
    expect(formatOccurrenceDateTime(value.start!, value.startMark, TEST_TIME_ZONE))
      .toBe('7/14/2026 13:00')
    expect(formatOccurrenceDateTime(value.start!, '10', TEST_TIME_ZONE))
      .toBe('7/14/2026 13:?')
    expect(occurrenceWeekday(value, TEST_TIME_ZONE, TEST_LOCALE)).toBe('星期二')
  })

  it('places today and future first, then past occurrences in ascending order', () => {
    const values = [12, 16, 14, 13, 15].map((day) => occurrence(String(day), day))
    const sorted = sortDetailOccurrences(
      values,
      TEST_TIME_ZONE,
      Temporal.Instant.from(TEST_NOW)
    )

    expect(sorted.map(({ start }) => start?.slice(8, 10))).toEqual(['13', '14', '15', '16', '12'])
  })
})
