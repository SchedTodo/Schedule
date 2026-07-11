import { describe, expect, it, vi } from 'vitest'

import { ScheduleService } from '../../../src/application/schedule-service'
import { FixedClock } from '../../../src/domain/shared/clock'
import type { ScheduleRepository } from '../../../src/platform/ports'

function repositoryWith(overrides: Partial<ScheduleRepository> = {}): ScheduleRepository {
  return {
    save: vi.fn(async (schedule) => ({ ok: true as const, value: schedule })),
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
