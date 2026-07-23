import { describe, expect, it } from 'vitest'

import type { ScheduleOccurrenceDto } from '../../../src/contracts/occurrence.contract'
import {
  alarmKey,
  dueAlarms,
  isAlarmDue,
  scheduledAlarms
} from '../../../src/application/alarm-scheduler'
import { defaultSettings } from '../../../src/contracts/settings.contract'
import { TEST_NOW } from '../../support/time'

const pollingNow = new Date(Date.parse(TEST_NOW) - 15_000).toISOString()
const alarmTarget = new Date(Date.parse(TEST_NOW) + 5 * 60_000).toISOString()

const event: ScheduleOccurrenceDto = {
  id: '10000000-0000-4000-8000-000000000001', scheduleId: '20000000-0000-4000-8000-000000000001',
  kind: 'event', title: 'Review', excluded: false,
  start: alarmTarget, end: '2026-07-13T05:00:00.000Z',
  startMark: '11', endMark: '11', comment: '', done: false
}

describe('alarm scheduling', () => {
  it('returns alarms falling within the next polling window', () => {
    expect(dueAlarms([event], {
      ...defaultSettings, eventAlarmBeforeMinutes: 5
    }, pollingNow, 30).map(({ occurrence }) => occurrence.id)).toEqual([event.id])
  })

  it('honors disabled alarms and Todo deadlines', () => {
    const todo = { ...event, id: '10000000-0000-4000-8000-000000000002', kind: 'todo' as const, start: null, end: alarmTarget }
    expect(dueAlarms([event, todo], {
      ...defaultSettings, eventAlarmEnabled: false, todoAlarmBeforeMinutes: 5
    }, pollingNow, 30).map(({ occurrence }) => occurrence.id)).toEqual([todo.id])
  })

  it('uses a left-open and right-closed polling interval', () => {
    const [alarm] = scheduledAlarms([event], {
      ...defaultSettings,
      eventAlarmBeforeMinutes: 5
    })
    expect(alarm).toBeDefined()
    const oneSecondBefore = new Date(Date.parse(alarm!.alarmAt) - 1_000).toISOString()
    const thirtySecondsAfter = new Date(Date.parse(alarm!.alarmAt) + 30_000).toISOString()
    expect(isAlarmDue(alarm!, alarm!.alarmAt, thirtySecondsAfter)).toBe(false)
    expect(isAlarmDue(alarm!, oneSecondBefore, alarm!.alarmAt)).toBe(true)
  })

  it('filters completed, excluded, and disabled candidates before scheduling', () => {
    expect(scheduledAlarms([
      { ...event, done: true },
      {
        ...event,
        id: '10000000-0000-4000-8000-000000000002',
        excluded: true
      }
    ], defaultSettings)).toEqual([])
    expect(scheduledAlarms([event], {
      ...defaultSettings,
      eventAlarmEnabled: false
    })).toEqual([])
  })

  it('uses a stable occurrence and alarm-time key', () => {
    const [alarm] = scheduledAlarms([event], defaultSettings)
    expect(alarmKey(alarm!)).toBe(`${event.id}:${alarm!.alarmAt}`)
  })
})
