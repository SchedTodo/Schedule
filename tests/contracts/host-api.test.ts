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
    const detail = { ...schedule, deleted: false }
    const findScheduleById = vi.fn(async () => ({ ok: true as const, value: detail }))
    const listSchedules = vi.fn(async () => ({ ok: true as const, value: [schedule] }))
    const listOccurrences = vi.fn(async () => ({ ok: true as const, value: [] }))
    const updateSchedule = vi.fn(async () => ({ ok: true as const, value: schedule }))
    const setScheduleStarred = vi.fn(async () => ({ ok: true as const, value: schedule }))
    const setScheduleDeleted = vi.fn(async () => ({ ok: true as const, value: undefined }))
    const searchSchedules = vi.fn(async () => ({ ok: true as const, value: { items: [], total: 0 } }))
    const listScheduleOccurrences = vi.fn(async () => ({ ok: true as const, value: [] }))
    const updateOccurrenceComment = vi.fn()
    const excludeOccurrences = vi.fn()
    const listTodos = vi.fn(async () => ({ ok: true as const, value: [] }))
    const setOccurrenceDone = vi.fn()
    const getSettings = vi.fn()
    const updateSettings = vi.fn()
    const createRecord = vi.fn()
    const listRecords = vi.fn()
    const deleteRecord = vi.fn()
    const gateway = createHostGateway({
      createSchedule,
      findScheduleById,
      listSchedules,
      updateSchedule,
      setScheduleStarred,
      setScheduleDeleted,
      searchSchedules,
      listOccurrences,
      listScheduleOccurrences,
      updateOccurrenceComment,
      excludeOccurrences,
      listTodos,
      setOccurrenceDone,
      getSettings,
      updateSettings,
      createRecord,
      listRecords,
      deleteRecord
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
      value: detail
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
