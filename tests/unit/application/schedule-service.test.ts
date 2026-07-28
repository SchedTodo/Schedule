import { describe, expect, it, vi } from 'vitest'

import { ScheduleService } from '../../../src/application/schedule-service'
import { FixedClock } from '../../../src/domain/shared/clock'
import type { OccurrenceRepository, ScheduleRepository } from '../../../src/platform/ports'

function repositoryWith(overrides: Partial<ScheduleRepository> = {}): ScheduleRepository {
  return {
    save: vi.fn(async (schedule) => ({ ok: true as const, value: schedule })),
    saveWithOccurrences: vi.fn(async (schedule) => ({ ok: true as const, value: schedule })),
    findById: vi.fn(async () => ({ ok: true as const, value: null })),
    list: vi.fn(async () => ({ ok: true as const, value: [] })),
    deleteById: vi.fn(async () => ({ ok: true as const, value: undefined })),
    setStarred: vi.fn(async () => ({ ok: true as const, value: {
      id: '0198f0de-8f7f-7000-8000-000000000001', kind: 'event' as const, title: '周会',
      recurrenceCode: '2026/7/12 10:00-11:00', exclusionCode: '', comment: '', starred: true,
      createdAt: '2026-07-11T08:00:00Z', updatedAt: '2026-07-11T08:00:00Z'
    } })),
    setDeleted: vi.fn(async () => ({ ok: true as const, value: undefined })),
    searchPage: vi.fn(async () => ({ ok: true as const, value: { items: [], total: 0 } })),
    ...overrides
  }
}

function occurrenceRepositoryWith(
  overrides: Partial<OccurrenceRepository> = {}
): OccurrenceRepository {
  return {
    listRange: vi.fn(async () => ({ ok: true as const, value: [] })),
    listAlarmCandidates: vi.fn(async () => ({ ok: true as const, value: [] })),
    listVisibleBySchedule: vi.fn(async () => ({ ok: true as const, value: [] })),
    listAllBySchedule: vi.fn(async () => ({ ok: true as const, value: [] })),
    updateComment: vi.fn(),
    excludeMany: vi.fn(async () => ({ ok: true as const, value: undefined })),
    listTodos: vi.fn(async () => ({ ok: true as const, value: [] })),
    setDone: vi.fn(),
    ...overrides
  }
}

describe('ScheduleService', () => {
  it('creates and saves a deterministic schedule DTO', async () => {
    const repository = repositoryWith()
    const service = new ScheduleService(repository, {
      clock: new FixedClock('2026-07-11T08:00:00Z'),
      idGenerator: { next: () => '0198f0de-8f7f-7000-8000-000000000001' },
      defaultTimeZone: 'UTC',
      weekStartsOn: 1,
      resolveTimeZoneAbbreviation: () => ({ kind: 'unknown' })
    })

    const result = await service.create({
      title: ' 周会 ',
      recurrenceCode: '',
      exclusionCode: '',
      comment: ''
    })

    expect(result).toEqual({
      ok: true,
      value: {
        id: '0198f0de-8f7f-7000-8000-000000000001',
        kind: 'todo',
        title: '周会',
        recurrenceCode: '',
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
      expect.objectContaining({
        title: '周会',
        recurrenceCode: '2026/7/13 10:00-11:00 Asia/Shanghai;'
      }),
      [expect.objectContaining({
        scheduleId: '10000000-0000-4000-8000-000000000001',
        start: '2026-07-13T02:00:00Z',
        end: '2026-07-13T03:00:00Z'
      })]
    )
    expect(result.ok && result.value.recurrenceCode).toBe(
      '2026/7/13 10:00-11:00 Asia/Shanghai;'
    )
  })

  it('infers Todo from a single deadline time', async () => {
    const repository = repositoryWith()
    const service = new ScheduleService(repository, {
      clock: new FixedClock('2026-07-11T08:00:00Z'),
      idGenerator: { next: () => '10000000-0000-4000-8000-000000000001' },
      defaultTimeZone: 'UTC', weekStartsOn: 1,
      resolveTimeZoneAbbreviation: () => ({ kind: 'unknown' })
    })
    const result = await service.create({
      title: 'Deadline', recurrenceCode: '2026/7/13 10:00;', exclusionCode: '', comment: ''
    })
    expect(result.ok && result.value.kind).toBe('todo')
  })

  it('persists relative recurrence and exclusion dates in their effective time zone', async () => {
    let sequence = 0
    const repository = repositoryWith()
    const service = new ScheduleService(repository, {
      clock: new FixedClock('2026-07-12T16:30:00Z'),
      idGenerator: { next: () => `10000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}` },
      defaultTimeZone: 'Asia/Shanghai',
      weekStartsOn: 1,
      resolveTimeZoneAbbreviation: (value) => value === 'CST'
        ? { kind: 'resolved', timeZone: 'America/Chicago' }
        : { kind: 'unknown' }
    })

    const result = await service.create({
      title: 'Review',
      recurrenceCode: 'tdy-tmr 10:00-11:00 America/Chicago;',
      exclusionCode: 'tmr 10:00-11:00 CST;',
      comment: ''
    })

    expect(result.ok && result.value).toMatchObject({
      recurrenceCode: '2026/7/12-2026/7/13 10:00-11:00 America/Chicago;',
      exclusionCode: '2026/7/13 10:00-11:00 America/Chicago;'
    })
    expect(repository.saveWithOccurrences).toHaveBeenCalledWith(
      expect.objectContaining({
        recurrenceCode: '2026/7/12-2026/7/13 10:00-11:00 America/Chicago;',
        exclusionCode: '2026/7/13 10:00-11:00 America/Chicago;'
      }),
      expect.any(Array)
    )
  })

  it('restores matching historical occurrences with their identity and user state', async () => {
    const schedule = {
      id: '10000000-0000-4000-8000-000000000001',
      kind: 'event' as const,
      title: 'Review',
      recurrenceCode: '2026/7/13 10:00-11:00 UTC;',
      exclusionCode: '2026/7/13 10:00-11:00 UTC;',
      comment: '',
      starred: false,
      deleted: false,
      createdAt: '2026-07-11T08:00:00Z',
      updatedAt: '2026-07-11T08:00:00Z'
    }
    const historical = {
      id: '20000000-0000-4000-8000-000000000001',
      scheduleId: schedule.id,
      kind: 'event' as const,
      title: schedule.title,
      excluded: true,
      start: '2026-07-13T10:00:00Z',
      end: '2026-07-13T11:00:00Z',
      startMark: '11' as const,
      endMark: '11' as const,
      comment: 'keep',
      done: true,
      deleted: true
    }
    const repository = repositoryWith({
      findById: vi.fn(async () => ({ ok: true as const, value: schedule }))
    })
    const occurrences = occurrenceRepositoryWith({
      listAllBySchedule: vi.fn(async () => ({ ok: true as const, value: [historical] }))
    })
    const service = new ScheduleService(repository, {
      clock: new FixedClock('2026-07-12T08:00:00Z'),
      idGenerator: { next: () => '20000000-0000-4000-8000-000000000099' },
      defaultTimeZone: 'UTC',
      weekStartsOn: 1,
      resolveTimeZoneAbbreviation: () => ({ kind: 'unknown' })
    }, occurrences)

    await service.update({
      id: schedule.id,
      title: schedule.title,
      recurrenceCode: '2026/7/13 10:00-11:00 UTC;',
      exclusionCode: '',
      comment: ''
    })

    expect(occurrences.listAllBySchedule).toHaveBeenCalledWith(schedule.id)
    expect(repository.saveWithOccurrences).toHaveBeenCalledWith(
      expect.anything(),
      [expect.objectContaining({
        id: historical.id,
        excluded: false,
        comment: 'keep',
        done: true
      })]
    )
  })

  it('returns repository failures and delegates reads', async () => {
    const error = {
      code: 'PERSISTENCE_FAILED' as const,
      messageKey: 'error.persistenceFailed' as const,
      message: '保存失败'
    }
    const repository = repositoryWith({
      save: vi.fn(async () => ({ ok: false as const, error })),
      findById: vi.fn(async () => ({ ok: true as const, value: null })),
      list: vi.fn(async () => ({ ok: true as const, value: [] }))
    })
    const service = new ScheduleService(repository, {
      clock: new FixedClock('2026-07-11T08:00:00Z'),
      idGenerator: { next: () => '0198f0de-8f7f-7000-8000-000000000001' },
      defaultTimeZone: 'UTC',
      weekStartsOn: 1,
      resolveTimeZoneAbbreviation: () => ({ kind: 'unknown' })
    })

    await expect(
      service.create({ title: '周会', recurrenceCode: '', exclusionCode: '', comment: '' })
    ).resolves.toEqual({ ok: false, error })
    await service.findById('0198f0de-8f7f-7000-8000-000000000001')
    await service.list({ offset: 0, limit: 50 })
    expect(repository.findById).toHaveBeenCalledOnce()
    expect(repository.list).toHaveBeenCalledWith({ offset: 0, limit: 50 })
  })

  it('rejects updates and starring for deleted schedules', async () => {
    const deleted = {
      id: '10000000-0000-4000-8000-000000000001', kind: 'event' as const,
      title: 'Review', recurrenceCode: '2026/7/13 10:00-11:00 UTC;', exclusionCode: '',
      comment: '', starred: false, deleted: true,
      createdAt: '2026-07-11T08:00:00Z', updatedAt: '2026-07-11T08:00:00Z'
    }
    const repository = repositoryWith({
      findById: vi.fn(async () => ({ ok: true as const, value: deleted }))
    })
    const service = new ScheduleService(repository, {
      clock: new FixedClock('2026-07-12T08:00:00Z'),
      idGenerator: { next: () => '20000000-0000-4000-8000-000000000001' },
      defaultTimeZone: 'UTC',
      weekStartsOn: 1,
      resolveTimeZoneAbbreviation: () => ({ kind: 'unknown' })
    })

    await expect(service.update({
      id: deleted.id, title: deleted.title, recurrenceCode: deleted.recurrenceCode,
      exclusionCode: '', comment: ''
    })).resolves.toMatchObject({ ok: false, error: { code: 'VALIDATION_FAILED' } })
    await expect(service.setStarred({ id: deleted.id, starred: true }))
      .resolves.toMatchObject({ ok: false, error: { code: 'VALIDATION_FAILED' } })
    expect(repository.saveWithOccurrences).not.toHaveBeenCalled()
    expect(repository.setStarred).not.toHaveBeenCalled()
  })
})
