import { describe, expect, it, vi } from 'vitest'

import type { ScheduleDto } from '../../src/contracts/schedule.contract'
import { HostScheduleApiSchema } from '../../src/platform/host/host-api'
import { createHostGateway } from '../../src/platform/host/host-gateway'

const schedule: ScheduleDto = {
  id: '0198f0de-8f7f-7000-8000-000000000001',
  kind: 'event',
  title: '周会',
  recurrenceCode: '2026-07-12 10:00',
  exclusionCode: '',
  comment: '',
  starred: false,
  createdAt: '2026-07-11T08:00:00Z',
  updatedAt: '2026-07-11T08:00:00Z'
}

describe('HostScheduleApiSchema', () => {
  it.each([
    undefined,
    {},
    { invoke: vi.fn() },
    { createSchedule: vi.fn(), findScheduleById: vi.fn() },
    {
      createSchedule: vi.fn(),
      findScheduleById: vi.fn(),
      listSchedules: vi.fn(),
      listOccurrences: vi.fn(),
      invoke: vi.fn()
    }
  ])('rejects absent, incomplete, raw, or additional host APIs', (host) => {
    expect(HostScheduleApiSchema.safeParse(host).success).toBe(false)
  })
})

describe('createHostGateway', () => {
  it('delegates only the named platform methods', async () => {
    const createSchedule = vi.fn(async () => ({ ok: true as const, value: schedule }))
    const findScheduleById = vi.fn(async () => ({ ok: true as const, value: schedule }))
    const listSchedules = vi.fn(async () => ({ ok: true as const, value: [schedule] }))
    const listOccurrences = vi.fn(async () => ({ ok: true as const, value: [] }))
    const gateway = createHostGateway({
      createSchedule,
      findScheduleById,
      listSchedules,
      listOccurrences
    })
    const input = {
      title: '周会',
      recurrenceCode: '2026-07-12 10:00',
      exclusionCode: '',
      comment: ''
    }
    const query = { offset: 0, limit: 50 }

    await expect(gateway.schedules.create(input)).resolves.toEqual({
      ok: true,
      value: schedule
    })
    await expect(gateway.schedules.findById(schedule.id)).resolves.toEqual({
      ok: true,
      value: schedule
    })
    await expect(gateway.schedules.list(query)).resolves.toEqual({
      ok: true,
      value: [schedule]
    })
    expect(createSchedule).toHaveBeenCalledWith(input)
    expect(findScheduleById).toHaveBeenCalledWith(schedule.id)
    expect(listSchedules).toHaveBeenCalledWith(query)
  })
})
