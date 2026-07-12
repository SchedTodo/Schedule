import { describe, expect, it, vi } from 'vitest'

import { ScheduleService } from '../../../src/application/schedule-service'
import { FixedClock } from '../../../src/domain/shared/clock'
import type { ScheduleRepository } from '../../../src/platform/ports'

function repositoryWith(overrides: Partial<ScheduleRepository> = {}): ScheduleRepository {
  return {
    save: vi.fn(async (schedule) => ({ ok: true as const, value: schedule })),
    saveWithOccurrences: vi.fn(async (schedule) => ({ ok: true as const, value: schedule })),
    findById: vi.fn(async () => ({ ok: true as const, value: null })),
    list: vi.fn(async () => ({ ok: true as const, value: [] })),
    deleteById: vi.fn(async () => ({ ok: true as const, value: undefined })),
    ...overrides
  }
}

describe('ScheduleService', () => {
  it('creates and saves a deterministic schedule DTO', async () => {
    const repository = repositoryWith()
    const service = new ScheduleService(repository, {
      clock: new FixedClock('2026-07-11T08:00:00Z'),
      idGenerator: { next: () => '0198f0de-8f7f-7000-8000-000000000001' }
    })

    const result = await service.create({
      title: ' 周会 ',
      recurrenceCode: '2026-07-12 10:00',
      exclusionCode: '',
      comment: ''
    })

    expect(result).toEqual({
      ok: true,
      value: {
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
    })
    expect(repository.save).toHaveBeenCalledWith(result.ok && result.value)
  })

  it('expands recurrence and persists schedule occurrences atomically', async () => {
    let sequence = 0
    const repository = repositoryWith()
    const service = new ScheduleService(repository, {
      clock: new FixedClock('2026-07-11T08:00:00Z'),
      idGenerator: { next: () => `10000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}` },
      defaultTimeZone: 'Asia/Shanghai',
      weekStartsOn: 1,
      resolveTimeZoneAbbreviation: () => ({ kind: 'unknown' })
    })

    const result = await service.create({
      title: '周会',
      recurrenceCode: '2026/7/13 10:00-11:00;',
      exclusionCode: '',
      comment: ''
    })

    expect(result.ok).toBe(true)
    expect(repository.saveWithOccurrences).toHaveBeenCalledWith(
      expect.objectContaining({ title: '周会' }),
      [expect.objectContaining({
        scheduleId: '10000000-0000-4000-8000-000000000001',
        start: '2026-07-13T02:00:00Z',
        end: '2026-07-13T03:00:00Z'
      })]
    )
  })

  it('returns repository failures and delegates reads', async () => {
    const error = { code: 'PERSISTENCE_FAILED' as const, message: '保存失败' }
    const repository = repositoryWith({
      save: vi.fn(async () => ({ ok: false as const, error })),
      findById: vi.fn(async () => ({ ok: true as const, value: null })),
      list: vi.fn(async () => ({ ok: true as const, value: [] }))
    })
    const service = new ScheduleService(repository, {
      clock: new FixedClock('2026-07-11T08:00:00Z'),
      idGenerator: { next: () => '0198f0de-8f7f-7000-8000-000000000001' }
    })

    await expect(
      service.create({ title: '周会', recurrenceCode: '', exclusionCode: '', comment: '' })
    ).resolves.toEqual({ ok: false, error })
    await service.findById('0198f0de-8f7f-7000-8000-000000000001')
    await service.list({ offset: 0, limit: 50 })
    expect(repository.findById).toHaveBeenCalledOnce()
    expect(repository.list).toHaveBeenCalledWith({ offset: 0, limit: 50 })
  })
})
