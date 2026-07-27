import { describe, expect, it } from 'vitest'

import { Temporal } from '@js-temporal/polyfill'

import {
  calendarRange,
  formatMarkedWallClock,
  formatRelativeTime,
  occurrenceWallTime,
  serializeOccurrenceExclusion
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

  it('formats future and past event differences with compact non-zero units', () => {
    const now = '2026-07-13T04:00:00Z'

    expect(formatRelativeTime('2026-07-15T07:04:00Z', now, 'event'))
      .toBe('in 2d 3h 4m')
    expect(formatRelativeTime('2026-07-12T23:00:00Z', now, 'event'))
      .toBe('5h ago')
    expect(formatRelativeTime('2026-07-11T01:56:00Z', now, 'todo'))
      .toBe('overdue 2d 2h 4m')
  })

  it('uses semantic labels at and within one minute of the target', () => {
    const now = '2026-07-13T04:00:00Z'

    expect(formatRelativeTime(now, now, 'event')).toBe('now')
    expect(formatRelativeTime('2026-07-13T04:00:30Z', now, 'event')).toBe('starting soon')
    expect(formatRelativeTime('2026-07-13T03:59:30Z', now, 'event')).toBe('just started')
    expect(formatRelativeTime('2026-07-13T04:00:30Z', now, 'todo')).toBe('due soon')
    expect(formatRelativeTime('2026-07-13T03:59:30Z', now, 'todo')).toBe('just overdue')
  })

  it('serializes concrete event and Todo exclusions in legacy UTC form', () => {
    const event = {
      id: '10000000-0000-4000-8000-000000000001',
      scheduleId: '10000000-0000-4000-8000-000000000002',
      kind: 'event' as const,
      title: 'Review',
      excluded: false,
      start: '2026-07-14T13:00:00Z',
      end: '2026-07-14T14:00:00Z',
      startMark: '11' as const,
      endMark: '11' as const,
      comment: '',
      done: false
    }

    expect(serializeOccurrenceExclusion(event)).toBe('2026/7/14 13:00-14:00 UTC')
    expect(serializeOccurrenceExclusion({ ...event, startMark: '10', endMark: '01' }))
      .toBe('2026/7/14 13:?-?:00 UTC')
    expect(serializeOccurrenceExclusion({
      ...event,
      kind: 'todo',
      start: null
    })).toBe('2026/7/14 14:00 UTC')
  })
})
