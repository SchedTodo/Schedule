import { describe, expect, it } from 'vitest'

import { notificationForAlarm } from '../../../src/application/alarm-notification'
import type { ScheduleOccurrenceDto } from '../../../src/contracts/occurrence.contract'

const event: ScheduleOccurrenceDto = {
  id: '10000000-0000-4000-8000-000000000001',
  scheduleId: '20000000-0000-4000-8000-000000000001',
  kind: 'event',
  title: '评审',
  excluded: false,
  start: '2026-07-23T01:00:00Z',
  end: '2026-07-23T02:00:00Z',
  startMark: '11',
  endMark: '11',
  comment: '',
  done: false
}

const todo: ScheduleOccurrenceDto = {
  ...event,
  id: '10000000-0000-4000-8000-000000000002',
  kind: 'todo',
  title: '待办',
  start: null
}

describe('alarm notification presentation', () => {
  it('formats a same-day Event in the selected time zone', () => {
    expect(notificationForAlarm({
      occurrence: {
        ...event,
        comment: '带材料'
      },
      alarmAt: '2026-07-23T00:55:00Z'
    }, 'Asia/Shanghai')).toEqual({
      title: 'Event: 评审',
      body: '带材料\n2026-07-23 09:00–10:00'
    })
  })

  it('shows both dates for a cross-day Event and preserves unknown marks', () => {
    expect(notificationForAlarm({
      occurrence: {
        ...event,
        start: '2026-07-23T15:30:00Z',
        end: '2026-07-23T17:00:00Z',
        startMark: '10',
        endMark: '01'
      },
      alarmAt: '2026-07-23T15:25:00Z'
    }, 'Asia/Shanghai').body).toBe(
      '2026-07-23 23:?–2026-07-24 ?:00'
    )
  })

  it.each([
    ['11', '09:30'],
    ['10', '09:?'],
    ['01', '?:30'],
    ['00', '?:?']
  ] as const)('preserves Todo mark %s as %s', (endMark, expected) => {
    expect(notificationForAlarm({
      occurrence: {
        ...todo,
        end: '2026-07-23T01:30:00Z',
        endMark
      },
      alarmAt: '2026-07-23T01:25:00Z'
    }, 'Asia/Shanghai')).toEqual({
      title: 'Todo: 待办',
      body: `2026-07-23 ${expected}`
    })
  })
})
