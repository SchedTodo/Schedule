import { describe, expect, it } from 'vitest'

import type { ScheduleOccurrenceDto } from '../../../src/contracts/occurrence.contract'
import { dueAlarms } from '../../../src/application/alarm-scheduler'
import { defaultSettings } from '../../../src/contracts/settings.contract'

const event: ScheduleOccurrenceDto = {
  id: '10000000-0000-4000-8000-000000000001', scheduleId: '20000000-0000-4000-8000-000000000001',
  kind: 'event', title: 'Review', excluded: false,
  start: '2026-07-12T10:05:00Z', end: '2026-07-12T11:00:00Z',
  startMark: '11', endMark: '11', comment: '', done: false
}

describe('alarm scheduling', () => {
  it('returns alarms falling within the next polling window', () => {
    expect(dueAlarms([event], {
      ...defaultSettings, eventAlarmBeforeMinutes: 5
    }, '2026-07-12T09:59:45Z', 30).map(({ occurrence }) => occurrence.id)).toEqual([event.id])
  })

  it('honors disabled alarms and Todo deadlines', () => {
    const todo = { ...event, id: '10000000-0000-4000-8000-000000000002', kind: 'todo' as const, start: null, end: '2026-07-12T10:05:00Z' }
    expect(dueAlarms([event, todo], {
      ...defaultSettings, eventAlarmEnabled: false, todoAlarmBeforeMinutes: 5
    }, '2026-07-12T09:59:45Z', 30).map(({ occurrence }) => occurrence.id)).toEqual([todo.id])
  })
})
