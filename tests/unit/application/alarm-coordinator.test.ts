import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

import { AlarmCoordinator } from '../../../src/application/alarm-coordinator'
import type { NotificationInput } from '../../../src/contracts/notification.contract'
import type { AppErrorDto, AppResult } from '../../../src/contracts/result'
import type {
  AlarmCandidateQuery,
  ScheduleOccurrenceDto
} from '../../../src/contracts/occurrence.contract'
import { defaultSettings, type SettingsDto } from '../../../src/contracts/settings.contract'
import type { Clock } from '../../../src/domain/shared/clock'
import { Temporal } from '../../../src/domain/shared/temporal'

const FIRST_ID = '10000000-0000-4000-8000-000000000001'
const SECOND_ID = '10000000-0000-4000-8000-000000000002'
const THIRD_ID = '10000000-0000-4000-8000-000000000003'

class MutableClock implements Clock {
  private value = Temporal.Instant.from('2026-07-23T02:00:00Z')

  set(value: string): void {
    this.value = Temporal.Instant.from(value)
  }

  now(): Temporal.Instant {
    return this.value
  }
}

function todoAt(end: string, id = FIRST_ID): ScheduleOccurrenceDto {
  return {
    id,
    scheduleId: id,
    kind: 'todo',
    title: `Todo ${id}`,
    excluded: false,
    start: null,
    end,
    startMark: '11',
    endMark: '11',
    comment: '',
    done: false
  }
}

function eventFromTo(start: string, end: string): ScheduleOccurrenceDto {
  return {
    ...todoAt(end),
    kind: 'event',
    title: 'Event',
    start
  }
}

describe('AlarmCoordinator', () => {
  let clock: MutableClock
  let candidates: { value: readonly ScheduleOccurrenceDto[] }
  let settings: { value: SettingsDto }
  let candidateFailure: AppErrorDto | undefined
  let notify: Mock<(input: NotificationInput) => Promise<void>>
  let listCandidates: Mock<(
    query: AlarmCandidateQuery
  ) => Promise<AppResult<readonly ScheduleOccurrenceDto[]>>>
  let coordinator: AlarmCoordinator

  beforeEach(() => {
    clock = new MutableClock()
    candidates = { value: [] }
    settings = {
      value: {
        ...defaultSettings,
        todoAlarmBeforeMinutes: 0,
        eventAlarmBeforeMinutes: 0
      }
    }
    candidateFailure = undefined
    notify = vi.fn(async () => undefined)
    listCandidates = vi.fn(async () => candidateFailure === undefined
      ? { ok: true as const, value: candidates.value }
      : { ok: false as const, error: candidateFailure })
    coordinator = new AlarmCoordinator({
      clock,
      getSettings: async () => ({ ok: true, value: settings.value }),
      listCandidates,
      notify
    })
  })

  async function initializeAt(value: string): Promise<void> {
    clock.set(value)
    await coordinator.recalculate('initialize')
  }

  it('baselines startup without backfilling and covers every later instant once', async () => {
    clock.set('2026-07-23T02:00:00Z')
    candidates.value = [todoAt('2026-07-23T01:55:00Z')]
    await coordinator.recalculate('initialize')
    expect(notify).not.toHaveBeenCalled()

    candidates.value = [
      todoAt('2026-07-23T01:55:00Z'),
      todoAt('2026-07-23T02:00:30Z', SECOND_ID),
      todoAt('2026-07-23T02:01:20Z', THIRD_ID)
    ]
    clock.set('2026-07-23T02:01:20Z')
    await coordinator.recalculate('poll')
    await coordinator.recalculate('poll')

    expect(notify).toHaveBeenCalledTimes(2)
  })

  it('queries through the configured lead time and next polling window', async () => {
    settings.value = {
      ...settings.value,
      todoAlarmBeforeMinutes: 10,
      eventAlarmBeforeMinutes: 30
    }
    await initializeAt('2026-07-23T02:00:00Z')

    expect(listCandidates).toHaveBeenCalledWith({
      checkedAt: '2026-07-23T02:00:00Z',
      through: '2026-07-23T02:30:30Z'
    })
  })

  it('backfills every missed Todo after resume', async () => {
    await initializeAt('2026-07-23T02:00:00Z')
    candidates.value = [
      todoAt('2026-07-23T02:01:00Z'),
      todoAt('2026-07-23T08:00:00Z', SECOND_ID)
    ]
    clock.set('2026-07-23T09:00:00Z')

    await coordinator.recalculate('resume')

    expect(notify).toHaveBeenCalledTimes(2)
  })

  it.each([
    ['2026-07-23T03:59:59Z', 1],
    ['2026-07-23T04:00:00Z', 0],
    ['2026-07-23T04:00:01Z', 0]
  ])('delivers a missed Event only before its end at %s', async (checkedAt, count) => {
    await initializeAt('2026-07-23T02:00:00Z')
    candidates.value = [eventFromTo(
      '2026-07-23T03:00:00Z',
      '2026-07-23T04:00:00Z'
    )]
    clock.set(checkedAt)

    await coordinator.recalculate('resume')

    expect(notify).toHaveBeenCalledTimes(count)
  })

  it('immediately delivers a newly introduced already-due alarm after a mutation', async () => {
    await initializeAt('2026-07-23T02:00:00Z')
    candidates.value = [todoAt('2026-07-23T01:00:00Z')]

    await coordinator.recalculate('mutation')
    await coordinator.recalculate('mutation')

    expect(notify).toHaveBeenCalledOnce()
  })

  it('does not deliver disabled, completed, or excluded candidates', async () => {
    settings.value = { ...settings.value, todoAlarmEnabled: false }
    candidates.value = [
      todoAt('2026-07-23T02:01:00Z'),
      { ...todoAt('2026-07-23T02:01:00Z', SECOND_ID), done: true },
      { ...todoAt('2026-07-23T02:01:00Z', THIRD_ID), excluded: true }
    ]
    await initializeAt('2026-07-23T02:00:00Z')
    clock.set('2026-07-23T02:02:00Z')

    await coordinator.recalculate('poll')

    expect(notify).not.toHaveBeenCalled()
  })

  it('retries only failed notifications without advancing the successful boundary', async () => {
    await initializeAt('2026-07-23T02:00:00Z')
    candidates.value = [
      { ...todoAt('2026-07-23T02:01:00Z'), title: 'stable' },
      { ...todoAt('2026-07-23T02:01:00Z', SECOND_ID), title: 'retry' }
    ]
    let retryAttempts = 0
    notify.mockImplementation(async (input: NotificationInput) => {
      if (input.title !== 'Todo: retry') return
      retryAttempts += 1
      if (retryAttempts === 1) throw new Error('notification unavailable')
    })
    clock.set('2026-07-23T02:02:00Z')

    const firstResult = await coordinator.recalculate('poll')
    clock.set('2026-07-23T02:03:00Z')
    const secondResult = await coordinator.recalculate('poll')

    expect(firstResult.ok).toBe(false)
    expect(secondResult.ok).toBe(true)
    expect(notify.mock.calls.filter(([input]) =>
      (input as NotificationInput).title === 'Todo: stable')).toHaveLength(1)
    expect(notify.mock.calls.filter(([input]) =>
      (input as NotificationInput).title === 'Todo: retry')).toHaveLength(2)
  })

  it('does not advance the check boundary when candidate loading fails', async () => {
    await initializeAt('2026-07-23T02:00:00Z')
    candidates.value = [todoAt('2026-07-23T02:00:30Z')]
    candidateFailure = {
      code: 'PERSISTENCE_FAILED',
      message: 'candidate read failed'
    }
    clock.set('2026-07-23T02:01:00Z')
    expect((await coordinator.recalculate('poll')).ok).toBe(false)

    candidateFailure = undefined
    clock.set('2026-07-23T02:02:00Z')
    expect((await coordinator.recalculate('poll')).ok).toBe(true)
    expect(notify).toHaveBeenCalledOnce()
  })
})
