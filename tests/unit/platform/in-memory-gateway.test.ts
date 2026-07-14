import { describe, expect, it } from 'vitest'

import type { ScheduleDto } from '../../../src/contracts/schedule.contract'
import { FixedClock } from '../../../src/domain/shared/clock'
import { createInMemoryGateway } from '../../../src/platform/browser/in-memory-gateway'

const first: ScheduleDto = {
  id: '0198f0de-8f7f-7000-8000-000000000001',
  kind: 'event',
  title: '周会',
  recurrenceCode: '2026-07-12 10:00',
  exclusionCode: '',
  comment: '产品同步',
  starred: false,
  createdAt: '2026-07-11T07:00:00Z',
  updatedAt: '2026-07-11T07:00:00Z'
}

const second: ScheduleDto = {
  ...first,
  id: '0198f0de-8f7f-7000-8000-000000000002',
  kind: 'todo',
  title: '提交周报',
  recurrenceCode: '',
  comment: ''
}

describe('createInMemoryGateway', () => {
  it('normalizes create defaults with injected time and id', async () => {
    const gateway = createInMemoryGateway([], {
      clock: new FixedClock('2026-07-11T08:00:00Z'),
      idGenerator: { next: () => '0198f0de-8f7f-7000-8000-000000000003' }
    })

    const result = await gateway.schedules.create({
      title: ' 周会 ',
      recurrenceCode: '2026/7/12 10:00',
      exclusionCode: '',
      comment: ''
    })

    expect(result).toEqual({
      ok: true,
      value: {
        id: '0198f0de-8f7f-7000-8000-000000000003',
        kind: 'todo',
        title: '周会',
        recurrenceCode: '2026/7/12 10:00 UTC;',
        exclusionCode: '',
        comment: '',
        starred: false,
        createdAt: '2026-07-11T08:00:00Z',
        updatedAt: '2026-07-11T08:00:00Z'
      }
    })
  })

  it('generates and queries concrete occurrences in a UTC range', async () => {
    let sequence = 0
    const gateway = createInMemoryGateway([], {
      clock: new FixedClock('2026-07-11T08:00:00Z'),
      idGenerator: { next: () => `10000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}` }
    })
    await gateway.schedules.create({
      title: '周会',
      recurrenceCode: '2026/7/12-13 10:00-11:00 daily;',
      exclusionCode: '',
      comment: '整个日程备注'
    })

    const result = await gateway.occurrences.listRange({
      start: '2026-07-12T00:00:00Z',
      end: '2026-07-14T00:00:00Z',
      limit: 5000
    })

    expect(result.ok && result.value.map(({ start }) => start)).toEqual([
      '2026-07-12T10:00:00Z',
      '2026-07-13T10:00:00Z'
    ])
    expect(result.ok && result.value[0]?.scheduleComment).toBe('整个日程备注')
    const scheduleId = result.ok ? result.value[0]?.scheduleId : undefined
    expect(scheduleId).toBeDefined()
    const details = await gateway.occurrences.listVisibleBySchedule(scheduleId!)
    expect(details.ok && details.value[0]?.comment).toBe('')
    const schedules = await gateway.schedules.list({ offset: 0, limit: 10 })
    expect(schedules.ok && schedules.value[0]?.recurrenceCode).toBe(
      '2026/7/12-2026/7/13 10:00-11:00 UTC;'
    )
  })

  it('filters deterministically before applying pagination', async () => {
    const gateway = createInMemoryGateway([first, second])

    await expect(
      gateway.schedules.list({ kind: 'todo', search: '周报', offset: 0, limit: 1 })
    ).resolves.toEqual({ ok: true, value: [second] })
    await expect(
      gateway.schedules.list({ search: '周', offset: 1, limit: 1 })
    ).resolves.toEqual({ ok: true, value: [second] })
  })

  it('looks up schedules and returns immutable list snapshots', async () => {
    const gateway = createInMemoryGateway([first])

    await expect(gateway.schedules.findById(first.id)).resolves.toEqual({
      ok: true,
      value: { ...first, deleted: false }
    })
    await expect(
      gateway.schedules.findById('0198f0de-8f7f-7000-8000-000000000099')
    ).resolves.toEqual({ ok: true, value: null })

    const listed = await gateway.schedules.list({ offset: 0, limit: 50 })
    const listedAgain = await gateway.schedules.list({ offset: 0, limit: 50 })
    expect(listed.ok && Object.isFrozen(listed.value)).toBe(true)
    expect(listed.ok && listedAgain.ok && listed.value).not.toBe(
      listedAgain.ok && listedAgain.value
    )
  })
})
