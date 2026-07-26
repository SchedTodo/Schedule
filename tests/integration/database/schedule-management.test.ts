// @vitest-environment node

import { readFileSync } from 'node:fs'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ScheduleService } from '../../../src/application/schedule-service'
import { FixedClock } from '../../../src/domain/shared/clock'
import { DrizzleOccurrenceRepository } from '../../../src-electron/adapters/db/occurrence-repository'
import { DrizzleScheduleRepository } from '../../../src-electron/adapters/db/schedule-repository'
import { databaseSchema } from '../../../src-electron/adapters/db/schema'

describe('Drizzle schedule management', () => {
  let sqlite: Database.Database
  let repository: DrizzleScheduleRepository

  beforeEach(() => {
    sqlite = new Database(':memory:')
    sqlite.exec(readFileSync(new URL('../../../src-electron/adapters/db/schema.sql', import.meta.url), 'utf8'))
    repository = new DrizzleScheduleRepository(drizzle(sqlite, { schema: databaseSchema }))
  })
  afterEach(() => sqlite.close())

  it('persists relative dates as absolute dates across later edits', async () => {
    let sequence = 0
    const database = drizzle(sqlite, { schema: databaseSchema })
    const occurrenceRepository = new DrizzleOccurrenceRepository(database)
    const dependencies = {
      idGenerator: {
        next: () => `10000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`
      },
      defaultTimeZone: 'Asia/Shanghai',
      weekStartsOn: 1 as const,
      resolveTimeZoneAbbreviation: (value: string) => value === 'CST'
        ? { kind: 'resolved' as const, timeZone: 'America/Chicago' }
        : { kind: 'unknown' as const }
    }
    const createService = new ScheduleService(repository, {
      ...dependencies,
      clock: new FixedClock('2026-07-12T16:30:00Z')
    }, occurrenceRepository)
    const created = await createService.create({
      title: 'Review',
      recurrenceCode: 'tdy-tmr 10:00-11:00 America/Chicago;',
      exclusionCode: 'tmr 10:00-11:00 CST;',
      comment: ''
    })
    expect(created.ok).toBe(true)
    if (!created.ok) return

    const persisted = sqlite.prepare(
      'SELECT recurrence_code, exclusion_code FROM schedule WHERE id = ?'
    ).get(created.value.id)
    expect(persisted).toEqual({
      recurrence_code: '2026/7/12-2026/7/13 10:00-11:00 America/Chicago;',
      exclusion_code: '2026/7/13 10:00-11:00 America/Chicago;'
    })

    const updateService = new ScheduleService(repository, {
      ...dependencies,
      clock: new FixedClock('2026-07-20T16:30:00Z')
    }, occurrenceRepository)
    await updateService.update({
      id: created.value.id,
      title: created.value.title,
      recurrenceCode: created.value.recurrenceCode,
      exclusionCode: created.value.exclusionCode,
      comment: created.value.comment
    })

    expect(sqlite.prepare(
      'SELECT recurrence_code, exclusion_code FROM schedule WHERE id = ?'
    ).get(created.value.id)).toEqual(persisted)
  })

  it('stars, soft deletes, restores, and pages schedules', async () => {
    const schedule = {
      id: '10000000-0000-4000-8000-000000000001', kind: 'event' as const,
      title: 'Review', recurrenceCode: '2026/7/13 10:00-11:00;', exclusionCode: '',
      comment: '', starred: false, createdAt: '2026-07-11T08:00:00Z', updatedAt: '2026-07-11T08:00:00Z'
    }
    await repository.save(schedule)
    sqlite.prepare(`INSERT INTO schedule_occurrence
      (id, schedule_id, excluded, start, end, start_mark, end_mark, comment, done, created_at, updated_at)
      VALUES (?, ?, 0, ?, ?, '11', '11', '', 0, ?, ?)`)
      .run('20000000-0000-4000-8000-000000000001', schedule.id, 1, 2, 1, 1)
    sqlite.prepare(`INSERT INTO concentration_record (id, schedule_id, start, end)
      VALUES (?, ?, ?, ?)`)
      .run('30000000-0000-4000-8000-000000000001', schedule.id, 1, 2)
    await repository.setStarred(schedule.id, true, '2026-07-11T09:00:00Z')
    let page = await repository.searchPage({ search: '', starred: true, deleted: false, page: 1, pageSize: 20 })
    expect(page.ok && page.value.items[0]).toMatchObject({ starred: true, deleted: false })

    await repository.setDeleted(schedule.id, true, '2026-07-11T10:00:00Z')
    await expect(repository.findById(schedule.id)).resolves.toMatchObject({
      ok: true,
      value: { id: schedule.id, deleted: true }
    })
    expect(sqlite.prepare('SELECT deleted_at FROM schedule_occurrence').get())
      .toEqual({ deleted_at: Date.parse('2026-07-11T10:00:00Z') })
    expect(sqlite.prepare('SELECT deleted_at FROM concentration_record').get())
      .toEqual({ deleted_at: Date.parse('2026-07-11T10:00:00Z') })
    page = await repository.searchPage({ search: '', deleted: true, page: 1, pageSize: 20 })
    expect(page.ok && page.value.total).toBe(1)
    await repository.setDeleted(schedule.id, false, '2026-07-11T11:00:00Z')
    await expect(repository.findById(schedule.id)).resolves.toMatchObject({
      ok: true,
      value: { id: schedule.id, deleted: false }
    })
    expect(sqlite.prepare('SELECT deleted_at FROM schedule_occurrence').get())
      .toEqual({ deleted_at: null })
    expect(sqlite.prepare('SELECT deleted_at FROM concentration_record').get())
      .toEqual({ deleted_at: null })
  })

  it('queries all deletion states when deleted is omitted', async () => {
    const active = {
      id: '10000000-0000-4000-8000-000000000001', kind: 'event' as const,
      title: 'Active', recurrenceCode: '2026/7/13 10:00-11:00;', exclusionCode: '',
      comment: '', starred: false, createdAt: '2026-07-11T08:00:00Z', updatedAt: '2026-07-11T08:00:00Z'
    }
    const deleted = {
      ...active,
      id: '10000000-0000-4000-8000-000000000002',
      title: 'Deleted'
    }
    await repository.save(active)
    await repository.save(deleted)
    await repository.setDeleted(deleted.id, true, '2026-07-11T09:00:00Z')

    const all = await repository.searchPage({ search: '', page: 1, pageSize: 20 })
    expect(all.ok && all.value.items.map(({ id }) => id)).toEqual(
      expect.arrayContaining([active.id, deleted.id])
    )
    const activeOnly = await repository.searchPage({ search: '', deleted: false, page: 1, pageSize: 20 })
    expect(activeOnly.ok && activeOnly.value.items.map(({ id }) => id)).toEqual([active.id])
    const deletedOnly = await repository.searchPage({ search: '', deleted: true, page: 1, pageSize: 20 })
    expect(deletedOnly.ok && deletedOnly.value.items.map(({ id }) => id)).toEqual([deleted.id])
  })

  it('combines text conditions and sorts database pages deterministically', async () => {
    const base = {
      kind: 'event' as const,
      recurrenceCode: '2026/7/13 10:00-11:00;',
      exclusionCode: '',
      starred: true,
      createdAt: '2026-07-11T08:00:00Z'
    }
    const sameTimeFirstId = {
      ...base,
      id: '10000000-0000-4000-8000-000000000001',
      title: '项目',
      comment: '复盘',
      updatedAt: '2026-07-11T09:00:00Z'
    }
    const sameTimeSecondId = {
      ...base,
      id: '10000000-0000-4000-8000-000000000002',
      title: 'C++ 项目',
      comment: '复盘',
      updatedAt: '2026-07-11T09:00:00Z'
    }
    const recent = {
      ...base,
      id: '10000000-0000-4000-8000-000000000003',
      title: '项目会议',
      comment: '',
      updatedAt: '2026-07-12T08:00:00Z'
    }
    await repository.save(sameTimeSecondId)
    await repository.save(recent)
    await repository.save(sameTimeFirstId)

    const firstPage = await repository.searchPage({
      search: '项目 会议 | 复盘',
      starred: true,
      kind: 'event',
      page: 1,
      pageSize: 2
    })
    expect(firstPage.ok && firstPage.value).toMatchObject({
      total: 3,
      items: [
        { id: recent.id },
        { id: sameTimeFirstId.id }
      ]
    })

    const secondPage = await repository.searchPage({
      search: '项目 会议|复盘',
      starred: true,
      kind: 'event',
      page: 2,
      pageSize: 2
    })
    expect(secondPage.ok && secondPage.value.items.map(({ id }) => id))
      .toEqual([sameTimeSecondId.id])

    const literalPlus = await repository.searchPage({
      search: 'c++',
      page: 1,
      pageSize: 10
    })
    expect(literalPlus.ok && literalPlus.value.items.map(({ id }) => id))
      .toEqual([sameTimeSecondId.id])

    const emptyOperators = await repository.searchPage({
      search: ' | || ',
      page: 1,
      pageSize: 10
    })
    expect(emptyOperators.ok && emptyOperators.value.total).toBe(3)

    const noMatch = await repository.searchPage({
      search: '不存在',
      page: 1,
      pageSize: 10
    })
    expect(noMatch.ok && noMatch.value.total).toBe(0)
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
