import { describe, expect, it, vi } from 'vitest'

import type { PlatformGateway } from '../../../src/contracts/platform.contract'
import { createScheduleHostApi } from '../../../src-electron/preload/schedule-api'
import { registerScheduleIpcHandlers } from '../../../src-electron/main/ipc/register-handlers'
import { createMainWindowOptions } from '../../../src-electron/main/window'
import { ElectronExternalLink } from '../../../src-electron/adapters/electron-external-link'

const schedule = {
  id: '0198f0de-8f7f-7000-8000-000000000001',
  kind: 'event' as const,
  title: '评审',
  recurrenceCode: '2026-07-12 10:00',
  exclusionCode: '',
  comment: '',
  starred: false,
  createdAt: '2026-07-11T08:00:00.000Z',
  updatedAt: '2026-07-11T08:00:00.000Z'
}

const occurrence = {
  id: '1198f0de-8f7f-7000-8000-000000000001',
  scheduleId: schedule.id,
  kind: 'event' as const,
  title: schedule.title,
  excluded: false,
  start: '2026-07-12T10:00:00.000Z',
  end: '2026-07-12T11:00:00.000Z',
  startMark: '11' as const,
  endMark: '11' as const,
  comment: '',
  scheduleComment: '',
  done: false
}

function createHarness(
  gateway: {
    schedules: Pick<PlatformGateway['schedules'], 'create' | 'findById' | 'list'> & Partial<PlatformGateway['schedules']>
    occurrences?: Partial<PlatformGateway['occurrences']>
  }
) {
  const handlers = new Map<string, (_event: unknown, input: unknown) => Promise<unknown>>()
  registerScheduleIpcHandlers(
    {
      handle(channel, handler) {
        handlers.set(channel, handler)
      }
    },
    {
      schedules: {
        ...gateway.schedules,
        update: gateway.schedules.update ?? vi.fn(),
        setStarred: gateway.schedules.setStarred ?? vi.fn(),
        setDeleted: gateway.schedules.setDeleted ?? vi.fn(),
        searchPage: gateway.schedules.searchPage ?? vi.fn()
      },
      occurrences: {
        listRange: gateway.occurrences?.listRange ?? vi.fn(async () => ({ ok: true as const, value: [] })),
        listVisibleBySchedule: gateway.occurrences?.listVisibleBySchedule ?? vi.fn(async () => ({ ok: true as const, value: [] })),
        updateComment: gateway.occurrences?.updateComment ?? vi.fn(),
        excludeMany: gateway.occurrences?.excludeMany ?? vi.fn(),
        listTodos: gateway.occurrences?.listTodos ?? vi.fn(async () => ({ ok: true as const, value: [] })),
        setDone: gateway.occurrences?.setDone ?? vi.fn()
      },
      settings: {
        get: vi.fn(async () => ({ ok: true as const, value: {
          timeZone: 'UTC', weekStart: 1 as const, todoAlarmEnabled: true, todoAlarmBeforeMinutes: 5,
          eventAlarmEnabled: true, eventAlarmBeforeMinutes: 5, calendarMode: 'month' as const,
          weekViewDays: 5, logicalDayStartHour: 0, logicalDayStartMinute: 0,
          openAtLogin: false, focusMinutes: 25, smallBreakMinutes: 5, bigBreakMinutes: 20
        } })),
        update: vi.fn()
      },
      records: {
        create: vi.fn(),
        listBySchedule: vi.fn(async () => ({ ok: true as const, value: [] })),
        delete: vi.fn()
      }
    }
  )

  const api = createScheduleHostApi(async (channel, input) => {
    const handler = handlers.get(channel)
    if (!handler) throw new Error(`Missing handler: ${channel}`)
    return handler({}, input)
  })

  return { api, handlers }
}

describe('typed schedule IPC', () => {
  it('round trips a valid create request through named methods', async () => {
    const create = vi.fn(async () => ({ ok: true as const, value: schedule }))
    const { api } = createHarness({
      schedules: {
        create,
        findById: vi.fn(),
        list: vi.fn()
      }
    })

    await expect(
      api.createSchedule({ title: '评审', recurrenceCode: '2026-07-12 10:00' })
    ).resolves.toEqual({ ok: true, value: schedule })
    expect(create).toHaveBeenCalledWith({
      title: '评审',
      recurrenceCode: '2026-07-12 10:00',
      exclusionCode: '',
      comment: ''
    })
  })

  it('rejects malformed renderer input and unknown fields before calling the gateway', async () => {
    const create = vi.fn()
    const { handlers } = createHarness({
      schedules: { create, findById: vi.fn(), list: vi.fn() }
    })
    const handler = handlers.get('schedule:create')

    await expect(handler?.({}, { title: '', recurrenceCode: '', extra: true })).resolves.toMatchObject({
      ok: false,
      error: { code: 'VALIDATION_FAILED' }
    })
    expect(create).not.toHaveBeenCalled()
  })

  it('converts handler exceptions to a stable internal error', async () => {
    const { api } = createHarness({
      schedules: {
        create: vi.fn(async () => {
          throw new Error('database path must not leak')
        }),
        findById: vi.fn(),
        list: vi.fn()
      }
    })

    await expect(
      api.createSchedule({ title: '评审', recurrenceCode: '2026-07-12 10:00' })
    ).resolves.toEqual({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: '日程操作失败' }
    })
  })

  it('validates responses in preload before returning them to the renderer', async () => {
    const api = createScheduleHostApi(async () => ({
      ok: true,
      value: { ...schedule, createdAt: { epochMilliseconds: 1 } }
    }))

    await expect(api.findScheduleById(schedule.id)).rejects.toThrow()
  })

  it('serializes schedule DTO dates as ISO strings across IPC', async () => {
    const { api } = createHarness({
      schedules: {
        create: vi.fn(),
        findById: vi.fn(async () => ({
          ok: true as const,
          value: { ...schedule, deleted: false }
        })),
        list: vi.fn(async () => ({ ok: true as const, value: [schedule] }))
      }
    })

    const found = await api.findScheduleById(schedule.id)
    const listed = await api.listSchedules({})

    expect(found.ok && found.value?.createdAt).toBe('2026-07-11T08:00:00.000Z')
    expect(listed.ok && listed.value[0]?.updatedAt).toBe('2026-07-11T08:00:00.000Z')
  })

  it('validates and round trips occurrence range queries', async () => {
    const listRange = vi.fn(async () => ({ ok: true as const, value: [occurrence] }))
    const { api, handlers } = createHarness({
      schedules: { create: vi.fn(), findById: vi.fn(), list: vi.fn() },
      occurrences: { listRange }
    })
    const query = {
      start: '2026-07-01T00:00:00Z',
      end: '2026-08-01T00:00:00Z',
      limit: 5000
    }

    await expect(api.listOccurrences(query)).resolves.toEqual({ ok: true, value: [occurrence] })
    await expect(handlers.get('occurrence:list-range')?.({}, { ...query, extra: true }))
      .resolves.toMatchObject({ ok: false, error: { code: 'VALIDATION_FAILED' } })
    expect(listRange).toHaveBeenCalledWith(query)
  })

  it('validates and round trips batch occurrence exclusion', async () => {
    const excludeMany = vi.fn(async () => ({ ok: true as const, value: undefined }))
    const { api, handlers } = createHarness({
      schedules: { create: vi.fn(), findById: vi.fn(), list: vi.fn() },
      occurrences: { excludeMany }
    })
    const input = { ids: [occurrence.id] }

    await expect(api.excludeOccurrences(input)).resolves.toEqual({
      ok: true,
      value: undefined
    })
    await expect(handlers.get('occurrence:exclude-many')?.({}, { ids: [] }))
      .resolves.toMatchObject({ ok: false, error: { code: 'VALIDATION_FAILED' } })
    await expect(handlers.get('occurrence:exclude-many')?.({}, { ids: ['invalid'] }))
      .resolves.toMatchObject({ ok: false, error: { code: 'VALIDATION_FAILED' } })
    expect(excludeMany).toHaveBeenCalledWith(input)
  })
})

describe('secure Electron host boundary', () => {
  it('enables renderer isolation and disables Node integration', () => {
    expect(createMainWindowOptions('D:/app/preload.js').webPreferences).toMatchObject({
      preload: 'D:/app/preload.js',
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    })
  })

  it('opens HTTPS links and rejects unsafe external protocols', async () => {
    const openExternal = vi.fn(async () => undefined)
    const links = new ElectronExternalLink({ openExternal })

    await expect(links.open('https://example.com/help')).resolves.toBeUndefined()
    await expect(links.open('file:///C:/secret.txt')).rejects.toThrow('不允许的外部链接协议')
    await expect(links.open('javascript:alert(1)')).rejects.toThrow('不允许的外部链接协议')
    expect(openExternal).toHaveBeenCalledOnce()
  })
})
