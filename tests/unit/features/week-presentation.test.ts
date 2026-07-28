import { describe, expect, it } from 'vitest'

import type { CalendarOccurrenceDto } from '../../../src/contracts/occurrence.contract'
import {
  logicalDateForInstant,
  scheduleColor,
  weekCurrentTimePosition,
  weekSegmentsForOccurrence
} from '../../../src/features/schedule/week-presentation'

const occurrence: CalendarOccurrenceDto = {
  id: '20000000-0000-4000-8000-000000000001',
  scheduleId: '10000000-0000-4000-8000-000000000001',
  kind: 'event',
  title: 'Overnight review',
  excluded: false,
  start: '2026-07-13T20:00:00Z',
  end: '2026-07-14T08:00:00Z',
  startMark: '11',
  endMark: '11',
  comment: '',
  scheduleComment: '',
  done: false
}

describe('week presentation', () => {
  it('assigns wall times before the logical day start to the previous date', () => {
    expect(logicalDateForInstant('2026-07-17T16:00:00Z', 'Asia/Shanghai', 6, 0))
      .toBe('2026-07-17')
    expect(logicalDateForInstant('2026-07-17T22:00:00Z', 'Asia/Shanghai', 6, 0))
      .toBe('2026-07-18')
  })

  it('positions the current time within a UTC logical day', () => {
    expect(weekCurrentTimePosition('2026-07-13T12:00:00Z', 'UTC', 0, 0))
      .toEqual({ logicalDate: '2026-07-13', startMinutes: 720 })
  })

  it('positions an early wall time within the previous logical day', () => {
    expect(weekCurrentTimePosition('2026-07-13T02:00:00Z', 'UTC', 6, 0))
      .toEqual({ logicalDate: '2026-07-12', startMinutes: 1200 })
  })

  it('uses the selected time zone for the current logical day', () => {
    expect(weekCurrentTimePosition('2026-07-13T16:00:00Z', 'Asia/Shanghai', 6, 0))
      .toEqual({ logicalDate: '2026-07-13', startMinutes: 1080 })
  })

  it('selects one stable legacy palette color per schedule', () => {
    const scheduleId = '10000000-0000-4000-8000-000000000001'
    expect(scheduleColor(scheduleId)).toBe(scheduleColor(scheduleId))
    expect(scheduleColor(scheduleId)).toMatch(/^#[0-9A-Fa-f]{6}$/)
  })

  it('splits an occurrence at each configured logical-day boundary', () => {
    expect(weekSegmentsForOccurrence(occurrence, 'UTC', 6, 0)).toEqual([
      {
        item: occurrence,
        key: `${occurrence.id}:2026-07-13`,
        logicalDate: '2026-07-13',
        startMinutes: 840,
        durationMinutes: 600
      },
      {
        item: occurrence,
        key: `${occurrence.id}:2026-07-14`,
        logicalDate: '2026-07-14',
        startMinutes: 0,
        durationMinutes: 120
      }
    ])
  })

  it('creates one segment for every logical day spanned by a long occurrence', () => {
    const longOccurrence = {
      ...occurrence,
      end: '2026-07-16T08:00:00Z'
    }

    expect(weekSegmentsForOccurrence(longOccurrence, 'UTC', 6, 0)
      .map(({ logicalDate }) => logicalDate))
      .toEqual(['2026-07-13', '2026-07-14', '2026-07-15', '2026-07-16'])
  })

  it('does not create an empty segment when the occurrence ends on a boundary', () => {
    const boundaryEnding = {
      ...occurrence,
      end: '2026-07-14T06:00:00Z'
    }

    expect(weekSegmentsForOccurrence(boundaryEnding, 'UTC', 6, 0))
      .toHaveLength(1)
  })

  it('keeps a zero-duration occurrence on its starting logical day', () => {
    const zeroDuration = {
      ...occurrence,
      end: occurrence.start!
    }
    const [segment] = weekSegmentsForOccurrence(zeroDuration, 'UTC', 6, 0)

    expect(segment).toMatchObject({
      logicalDate: '2026-07-13',
      startMinutes: 840,
      durationMinutes: 0
    })
  })
})
