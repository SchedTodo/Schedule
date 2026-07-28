import { describe, expect, it, vi } from 'vitest'

import type { NotificationInput } from '../../../src/contracts/notification.contract'
import type { CreateConcentrationRecordInput } from '../../../src/contracts/record.contract'
import type { FocusCycleDurations } from '../../../src/features/concentrate/focus-cycle'
import { FocusSession } from '../../../src/features/concentrate/focus-session'

const firstScheduleId = '0198f0de-8f7f-7000-8000-000000000001'
const secondScheduleId = '0198f0de-8f7f-7000-8000-000000000002'
const initialMs = Date.parse('2026-07-16T00:00:00.000Z')

function harness(durations: FocusCycleDurations = {
  focusMs: 120_000,
  smallBreakMs: 30_000,
  bigBreakMs: 60_000
}) {
  let now = initialMs
  const notify = vi.fn<(input: NotificationInput) => Promise<void>>(async () => undefined)
  const saveRecord = vi.fn<(input: CreateConcentrationRecordInput) => Promise<void>>(
    async () => undefined
  )
  const session = new FocusSession(durations, {
    locale: 'en-US',
    now: () => now,
    notify,
    saveRecord
  })
  return {
    session,
    notify,
    saveRecord,
    advance(milliseconds: number) { now += milliseconds }
  }
}

describe('FocusSession', () => {
  it('notifies for every automatically started stage', () => {
    const { session, notify, advance } = harness({
      focusMs: 1_000,
      smallBreakMs: 500,
      bigBreakMs: 750
    })
    session.start()
    advance(1_000)
    session.tick()
    advance(500)
    session.tick()

    expect(notify).toHaveBeenNthCalledWith(1, { title: 'Take a break', body: 'Small Break' })
    expect(notify).toHaveBeenNthCalledWith(2, { title: 'Time to focus', body: 'Focus 2 of 4' })
  })

  it('saves a qualifying Focus interval to the outgoing Todo on selection change', async () => {
    const { session, saveRecord, advance } = harness()
    await session.selectTodo({ scheduleId: firstScheduleId })
    session.start()
    advance(60_001)
    session.tick()
    await session.selectTodo({ scheduleId: secondScheduleId })

    expect(saveRecord).toHaveBeenCalledWith({
      scheduleId: firstScheduleId,
      start: '2026-07-16T00:00:00.000Z',
      end: '2026-07-16T00:01:00.001Z'
    })
  })

  it.each([59_999, 60_000])('discards a %i ms Focus interval', async (milliseconds) => {
    const { session, saveRecord, advance } = harness()
    await session.selectTodo({ scheduleId: firstScheduleId })
    session.start()
    advance(milliseconds)
    session.tick()
    await session.dispose()

    expect(saveRecord).not.toHaveBeenCalled()
  })

  it('does not merge paused time into a record', async () => {
    const { session, saveRecord, advance } = harness()
    await session.selectTodo({ scheduleId: firstScheduleId })
    session.start()
    advance(60_001)
    session.pause()
    advance(30_000)
    session.start()
    advance(39_999)
    session.tick()
    await session.dispose()

    expect(saveRecord).toHaveBeenCalledOnce()
    expect(saveRecord.mock.calls[0]![0]).toMatchObject({
      start: '2026-07-16T00:00:00.000Z',
      end: '2026-07-16T00:01:00.001Z'
    })
  })

  it('closes Focus at the transition boundary and never records Break time', async () => {
    const { session, saveRecord, advance } = harness({
      focusMs: 60_001,
      smallBreakMs: 60_000,
      bigBreakMs: 60_000
    })
    await session.selectTodo({ scheduleId: firstScheduleId })
    session.start()
    advance(90_001)
    session.tick()
    await session.dispose()

    expect(saveRecord).toHaveBeenCalledOnce()
    expect(saveRecord).toHaveBeenCalledWith({
      scheduleId: firstScheduleId,
      start: '2026-07-16T00:00:00.000Z',
      end: '2026-07-16T00:01:00.001Z'
    })
  })
})
