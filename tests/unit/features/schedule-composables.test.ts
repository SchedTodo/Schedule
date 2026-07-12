import { nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import type { AppResult } from '../../../src/contracts/result'
import type { PlatformGateway } from '../../../src/contracts/platform.contract'
import type { ScheduleDto } from '../../../src/contracts/schedule.contract'
import { useScheduleDetail } from '../../../src/features/schedule/use-schedule-detail'
import { useScheduleList } from '../../../src/features/schedule/use-schedule-list'
import { useScheduleMutations } from '../../../src/features/schedule/use-schedule-mutations'

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

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

function gatewayWith(
  overrides: Partial<PlatformGateway['schedules']>
): PlatformGateway {
  return {
    schedules: {
      create: vi.fn(),
      findById: vi.fn(),
      list: vi.fn(),
      update: vi.fn(),
      setStarred: vi.fn(),
      setDeleted: vi.fn(),
      searchPage: vi.fn(),
      ...overrides
    },
    occurrences: {
      listRange: vi.fn(async () => ({ ok: true as const, value: [] }))
      ,listBySchedule: vi.fn(async () => ({ ok: true as const, value: [] }))
      ,updateComment: vi.fn()
      ,exclude: vi.fn()
    }
  }
}

describe('schedule composables', () => {
  it('loads a schedule list immediately and supports empty results', async () => {
    const initial = deferred<AppResult<readonly ScheduleDto[]>>()
    const list = vi
      .fn()
      .mockReturnValueOnce(initial.promise)
      .mockResolvedValueOnce({ ok: true, value: [] })
    const state = useScheduleList(gatewayWith({ list }), { offset: 0, limit: 50 })

    expect(state.loading.value).toBe(true)
    initial.resolve({ ok: true, value: [schedule] })
    await vi.waitFor(() => expect(state.items.value).toEqual([schedule]))
    await state.refresh()
    expect(state.items.value).toEqual([])
    expect(state.loading.value).toBe(false)
    expect(state.error.value).toBeNull()
  })

  it('keeps stable application errors from list and detail requests', async () => {
    const error = { code: 'PLATFORM_UNAVAILABLE' as const, message: '平台不可用' }
    const gateway = gatewayWith({
      list: vi.fn(async () => ({ ok: false as const, error })),
      findById: vi.fn(async () => ({ ok: false as const, error }))
    })
    const list = useScheduleList(gateway, { offset: 0, limit: 50 })
    const detail = useScheduleDetail(gateway, schedule.id)

    await Promise.all([list.refresh(), detail.refresh()])
    expect(list.error.value).toEqual(error)
    expect(detail.error.value).toEqual(error)
    expect(detail.schedule.value).toBeNull()
  })

  it('suppresses stale list responses', async () => {
    const older = deferred<AppResult<readonly ScheduleDto[]>>()
    const newer = deferred<AppResult<readonly ScheduleDto[]>>()
    const list = vi.fn().mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise)
    const state = useScheduleList(gatewayWith({ list }), { offset: 0, limit: 50 })
    const latestRefresh = state.refresh()

    newer.resolve({ ok: true, value: [schedule] })
    await latestRefresh
    older.resolve({ ok: true, value: [] })
    await nextTick()

    expect(state.items.value).toEqual([schedule])
  })

  it('refreshes after creating a schedule and exposes mutation state', async () => {
    const afterMutation = vi.fn(async () => undefined)
    const create = vi.fn(async () => ({ ok: true as const, value: schedule }))
    const state = useScheduleMutations(gatewayWith({ create }), afterMutation)

    await expect(
      state.createSchedule({
        title: '周会',
        recurrenceCode: '2026-07-12 10:00',
        exclusionCode: '',
        comment: ''
      })
    ).resolves.toEqual({ ok: true, value: schedule })
    expect(afterMutation).toHaveBeenCalledOnce()
    expect(state.loading.value).toBe(false)
    expect(state.error.value).toBeNull()
  })
})
