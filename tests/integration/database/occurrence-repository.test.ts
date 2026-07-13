// @vitest-environment node

import { readFileSync } from 'node:fs'

import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { DrizzleOccurrenceRepository } from '../../../src-electron/adapters/db/occurrence-repository'

describe('DrizzleOccurrenceRepository', () => {
  let sqlite: Database.Database
  let repository: DrizzleOccurrenceRepository

  beforeEach(() => {
    sqlite = new Database(':memory:')
    sqlite.exec(readFileSync(new URL('../../../src-electron/adapters/db/migrations/0001_v2_schema.sql', import.meta.url), 'utf8'))
    sqlite.exec(readFileSync(new URL('../../../src-electron/adapters/db/migrations/0002_occurrence.sql', import.meta.url), 'utf8'))
    sqlite.prepare(`INSERT INTO schedule
      (id, kind, title, recurrence_code, exclusion_code, comment, starred, created_at, updated_at)
      VALUES (?, ?, ?, ?, '', '整个日程备注', 0, ?, ?)`)
      .run('10000000-0000-4000-8000-000000000001', 'event', 'Review', '2026/7/13 10:00-11:00', 1, 1)
    repository = new DrizzleOccurrenceRepository(drizzle(sqlite))
  })

  afterEach(() => sqlite.close())

  it('stores drafts and lists visible event occurrences in start order', async () => {
    await repository.replaceForSchedule(
      '10000000-0000-4000-8000-000000000001',
      [
        { id: '20000000-0000-4000-8000-000000000002', excluded: false, start: '2026-07-14T02:00:00Z', end: '2026-07-14T03:00:00Z', startMark: '11', endMark: '11', comment: '', done: false },
        { id: '20000000-0000-4000-8000-000000000001', excluded: false, start: '2026-07-13T02:00:00Z', end: '2026-07-13T03:00:00Z', startMark: '11', endMark: '11', comment: '单次时间片备注', done: false }
      ]
    )

    const result = await repository.listRange({
      start: '2026-07-13T00:00:00Z',
      end: '2026-07-15T00:00:00Z',
      limit: 5000
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.map(({ id }) => id)).toEqual([
      '20000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000002'
    ])
    expect(result.value[0]).toMatchObject({
      title: 'Review',
      kind: 'event',
      comment: '单次时间片备注',
      scheduleComment: '整个日程备注'
    })
    const details = await repository.listBySchedule('10000000-0000-4000-8000-000000000001')
    expect(details.ok && details.value[0]?.comment).toBe('单次时间片备注')
  })

  it('hides excluded, completed, and soft-deleted occurrences', async () => {
    await repository.replaceForSchedule('10000000-0000-4000-8000-000000000001', [
      { id: '20000000-0000-4000-8000-000000000001', excluded: true, start: '2026-07-13T02:00:00Z', end: '2026-07-13T03:00:00Z', startMark: '11', endMark: '11', comment: '', done: false },
      { id: '20000000-0000-4000-8000-000000000002', excluded: false, start: '2026-07-13T04:00:00Z', end: '2026-07-13T05:00:00Z', startMark: '11', endMark: '11', comment: '', done: true },
      { id: '20000000-0000-4000-8000-000000000003', excluded: false, start: '2026-07-13T06:00:00Z', end: '2026-07-13T07:00:00Z', startMark: '11', endMark: '11', comment: '', done: false, deletedAt: '2026-07-12T00:00:00Z' }
    ])

    await expect(repository.listRange({
      start: '2026-07-13T00:00:00Z', end: '2026-07-14T00:00:00Z', limit: 5000
    })).resolves.toEqual({ ok: true, value: [] })
  })

  it('uses the selected time zone for Todo logical-day boundaries', async () => {
    sqlite.prepare('UPDATE schedule SET kind = ? WHERE id = ?')
      .run('todo', '10000000-0000-4000-8000-000000000001')
    await repository.replaceForSchedule('10000000-0000-4000-8000-000000000001', [
      { id: '20000000-0000-4000-8000-000000000001', excluded: false, start: null, end: '2026-07-13T15:00:00Z', startMark: '11', endMark: '11', comment: '', done: false },
      { id: '20000000-0000-4000-8000-000000000002', excluded: false, start: null, end: '2026-07-14T12:00:00Z', startMark: '11', endMark: '11', comment: '', done: false }
    ])

    const result = await repository.listTodos({
      now: '2026-07-13T18:00:00Z',
      timeZone: 'Asia/Shanghai',
      logicalDayStartHour: 0,
      logicalDayStartMinute: 0
    })

    expect(result.ok && result.value.map(({ id }) => id)).toEqual([
      '20000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000002'
    ])
  })
})
