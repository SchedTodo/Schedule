// @vitest-environment node

import { readFileSync } from 'node:fs'

import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { ScheduleDto } from '../../../src/contracts/schedule.contract'
import { DrizzleScheduleRepository } from '../../../src-electron/adapters/db/schedule-repository'

const firstSchedule: ScheduleDto = {
  id: '018f6f50-4eb0-7b90-a612-2d37b4fd4000',
  kind: 'event',
  title: 'Weekly review',
  recurrenceCode: '2026/7/13 10:00-11:00 weekly;',
  exclusionCode: '',
  comment: '',
  starred: false,
  createdAt: '2026-07-11T02:00:00Z',
  updatedAt: '2026-07-11T02:00:00Z'
}

describe('DrizzleScheduleRepository', () => {
  let sqlite: Database.Database
  let repository: DrizzleScheduleRepository

  beforeEach(() => {
    sqlite = new Database(':memory:')
    sqlite.exec(
      readFileSync(
        new URL('../../../src-electron/adapters/db/migrations/0001_v2_schema.sql', import.meta.url),
        'utf8'
      )
    )
    repository = new DrizzleScheduleRepository(drizzle(sqlite))
  })

  afterEach(() => {
    sqlite.close()
  })

  it('saves and reads a schedule without leaking database row types', async () => {
    const saved = await repository.save(firstSchedule)
    const found = await repository.findById(firstSchedule.id)

    expect(saved).toEqual({ ok: true, value: firstSchedule })
    expect(found).toEqual({ ok: true, value: firstSchedule })
  })

  it('upserts changes and lists newest schedules first', async () => {
    await repository.save(firstSchedule)
    await repository.save({
      ...firstSchedule,
      title: 'Updated review',
      starred: true,
      updatedAt: '2026-07-11T03:00:00Z'
    })
    await repository.save({
      ...firstSchedule,
      id: '018f6f50-4eb0-7b90-a612-2d37b4fd4001',
      title: 'Older todo',
      kind: 'todo',
      createdAt: '2026-07-11T01:00:00Z',
      updatedAt: '2026-07-11T01:00:00Z'
    })

    const result = await repository.list({ offset: 0, limit: 50 })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.map(({ title }) => title)).toEqual(['Updated review', 'Older todo'])
    expect(result.value[0]?.starred).toBe(true)
  })

  it('soft-deletes schedules from reads and lists', async () => {
    await repository.save(firstSchedule)
    const deleted = await repository.deleteById(
      firstSchedule.id,
      '2026-07-11T04:00:00Z'
    )

    expect(deleted).toEqual({ ok: true, value: undefined })
    await expect(repository.findById(firstSchedule.id)).resolves.toEqual({
      ok: true,
      value: null
    })
    await expect(repository.list({ offset: 0, limit: 50 })).resolves.toEqual({
      ok: true,
      value: []
    })
  })
})
