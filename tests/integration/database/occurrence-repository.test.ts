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
    const details = await repository.listVisibleBySchedule('10000000-0000-4000-8000-000000000001')
    expect(details.ok && details.value[0]?.comment).toBe('单次时间片备注')
  })

  it('separates visible occurrences from complete reconciliation history', async () => {
    await repository.replaceForSchedule('10000000-0000-4000-8000-000000000001', [
      { id: '20000000-0000-4000-8000-000000000001', excluded: false, start: '2026-07-13T02:00:00Z', end: '2026-07-13T03:00:00Z', startMark: '11', endMark: '11', comment: 'active', done: false },
      { id: '20000000-0000-4000-8000-000000000002', excluded: true, start: '2026-07-14T02:00:00Z', end: '2026-07-14T03:00:00Z', startMark: '11', endMark: '11', comment: 'excluded', done: false },
      { id: '20000000-0000-4000-8000-000000000003', excluded: false, start: '2026-07-15T02:00:00Z', end: '2026-07-15T03:00:00Z', startMark: '11', endMark: '11', comment: 'deleted', done: false, deletedAt: '2026-07-12T00:00:00Z' }
    ])

    const visible = await repository.listVisibleBySchedule(
      '10000000-0000-4000-8000-000000000001'
    )
    const all = await repository.listAllBySchedule(
      '10000000-0000-4000-8000-000000000001'
    )

    expect(visible.ok && visible.value.map(({ id }) => id)).toEqual([
      '20000000-0000-4000-8000-000000000001'
    ])
    expect(all.ok && all.value.map(({ id, deleted }) => ({ id, deleted }))).toEqual([
      { id: '20000000-0000-4000-8000-000000000001', deleted: false },
      { id: '20000000-0000-4000-8000-000000000002', deleted: false },
      { id: '20000000-0000-4000-8000-000000000003', deleted: true }
    ])
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

  it('atomically excludes selected occurrences and appends concrete exTime rules', async () => {
    const first = '20000000-0000-4000-8000-000000000001'
    const second = '20000000-0000-4000-8000-000000000002'
    await repository.replaceForSchedule('10000000-0000-4000-8000-000000000001', [
      { id: first, excluded: false, start: '2026-07-13T10:00:00Z', end: '2026-07-13T11:00:00Z', startMark: '11', endMark: '11', comment: '', done: false },
      { id: second, excluded: false, start: '2026-07-14T10:00:00Z', end: '2026-07-14T11:00:00Z', startMark: '11', endMark: '11', comment: '', done: false }
    ])

    await expect(repository.excludeMany({ ids: [first, second] })).resolves.toEqual({
      ok: true,
      value: undefined
    })

    const rows = sqlite.prepare(`SELECT excluded, deleted_at FROM schedule_occurrence
      ORDER BY id`).all()
    expect(rows).toEqual([
      { excluded: 1, deleted_at: null },
      { excluded: 1, deleted_at: null }
    ])
    expect(sqlite.prepare('SELECT exclusion_code FROM schedule').get()).toEqual({
      exclusion_code: '2026/7/13 10:00-11:00 UTC;2026/7/14 10:00-11:00 UTC'
    })
  })

  it('rolls back a batch when any occurrence is missing', async () => {
    const id = '20000000-0000-4000-8000-000000000001'
    await repository.replaceForSchedule('10000000-0000-4000-8000-000000000001', [
      { id, excluded: false, start: '2026-07-13T10:00:00Z', end: '2026-07-13T11:00:00Z', startMark: '11', endMark: '11', comment: '', done: false }
    ])

    await expect(repository.excludeMany({
      ids: [id, '20000000-0000-4000-8000-000000000099']
    })).resolves.toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
    expect(sqlite.prepare('SELECT excluded FROM schedule_occurrence WHERE id = ?').get(id))
      .toEqual({ excluded: 0 })
    expect(sqlite.prepare('SELECT exclusion_code FROM schedule').get())
      .toEqual({ exclusion_code: '' })
  })
})
