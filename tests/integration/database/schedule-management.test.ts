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
})
