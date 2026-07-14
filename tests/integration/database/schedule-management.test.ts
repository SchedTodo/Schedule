// @vitest-environment node

import { readFileSync } from 'node:fs'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { DrizzleScheduleRepository } from '../../../src-electron/adapters/db/schedule-repository'

describe('Drizzle schedule management', () => {
  let sqlite: Database.Database
  let repository: DrizzleScheduleRepository

  beforeEach(() => {
    sqlite = new Database(':memory:')
    sqlite.exec(readFileSync(new URL('../../../src-electron/adapters/db/migrations/0001_v2_schema.sql', import.meta.url), 'utf8'))
    sqlite.exec(readFileSync(new URL('../../../src-electron/adapters/db/migrations/0002_occurrence.sql', import.meta.url), 'utf8'))
    repository = new DrizzleScheduleRepository(drizzle(sqlite))
  })
  afterEach(() => sqlite.close())

  it('stars, soft deletes, restores, and pages schedules', async () => {
    const schedule = {
      id: '10000000-0000-4000-8000-000000000001', kind: 'event' as const,
      title: 'Review', recurrenceCode: '2026/7/13 10:00-11:00;', exclusionCode: '',
      comment: '', starred: false, createdAt: '2026-07-11T08:00:00Z', updatedAt: '2026-07-11T08:00:00Z'
    }
    await repository.save(schedule)
    await repository.setStarred(schedule.id, true, '2026-07-11T09:00:00Z')
    let page = await repository.searchPage({ search: '', starred: true, deleted: false, page: 1, pageSize: 20 })
    expect(page.ok && page.value.items[0]).toMatchObject({ starred: true, deleted: false })

    await repository.setDeleted(schedule.id, true, '2026-07-11T10:00:00Z')
    page = await repository.searchPage({ search: '', deleted: true, page: 1, pageSize: 20 })
    expect(page.ok && page.value.total).toBe(1)
    await repository.setDeleted(schedule.id, false, '2026-07-11T11:00:00Z')
    await expect(repository.findById(schedule.id)).resolves.toMatchObject({ ok: true, value: { id: schedule.id } })
  })

  it('restores desired rows and soft deletes occurrences no longer generated', async () => {
    const schedule = {
      id: '10000000-0000-4000-8000-000000000001', kind: 'event' as const,
      title: 'Review', recurrenceCode: '2026/7/13-14 10:00-11:00 UTC;', exclusionCode: '',
      comment: '', starred: false, createdAt: '2026-07-11T08:00:00Z', updatedAt: '2026-07-11T08:00:00Z'
    }
    const restoredId = '20000000-0000-4000-8000-000000000001'
    const removedId = '20000000-0000-4000-8000-000000000002'
    await repository.saveWithOccurrences(schedule, [
      {
        id: restoredId, scheduleId: schedule.id, kind: 'event', title: schedule.title,
        excluded: true, start: '2026-07-13T10:00:00Z', end: '2026-07-13T11:00:00Z',
        startMark: '11', endMark: '11', comment: 'keep', done: true
      },
      {
        id: removedId, scheduleId: schedule.id, kind: 'event', title: schedule.title,
        excluded: false, start: '2026-07-14T10:00:00Z', end: '2026-07-14T11:00:00Z',
        startMark: '11', endMark: '11', comment: '', done: false
      }
    ])

    await repository.saveWithOccurrences(
      { ...schedule, recurrenceCode: '2026/7/13 10:00-11:00 UTC;', updatedAt: '2026-07-12T08:00:00Z' },
      [{
        id: restoredId, scheduleId: schedule.id, kind: 'event', title: schedule.title,
        excluded: false, start: '2026-07-13T10:00:00Z', end: '2026-07-13T11:00:00Z',
        startMark: '11', endMark: '11', comment: 'keep', done: true
      }]
    )

    const rows = sqlite.prepare(`SELECT id, excluded, comment, done, deleted_at
      FROM schedule_occurrence ORDER BY id`).all() as Array<{
        id: string
        excluded: number
        comment: string
        done: number
        deleted_at: number | null
      }>
    expect(rows).toEqual([
      { id: restoredId, excluded: 0, comment: 'keep', done: 1, deleted_at: null },
      expect.objectContaining({ id: removedId, deleted_at: expect.any(Number) })
    ])
  })
})
