// @vitest-environment node

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { migrateV1Database } from '../../../src-electron/adapters/db/migrate-v1'

const legacySchema = `
  CREATE TABLE "Schedule" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rrules" TEXT NOT NULL,
    "rTimeCode" TEXT NOT NULL,
    "exTimeCode" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "star" INTEGER NOT NULL DEFAULT 0,
    "deleted" INTEGER NOT NULL DEFAULT 0,
    "created" TEXT,
    "updated" TEXT,
    "syncAt" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE "Time" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "end" TEXT NOT NULL
  );
  CREATE TABLE "Record" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "start" TEXT NOT NULL,
    "end" TEXT NOT NULL
  );
  CREATE TABLE "Setting" (
    "key" TEXT PRIMARY KEY NOT NULL,
    "type" TEXT NOT NULL,
    "value" TEXT NOT NULL
  );
`

describe('migrateV1Database', () => {
  let directory: string
  let databasePath: string
  let backupPath: string

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'schedule-v1-migration-'))
    databasePath = join(directory, 'prod.db')
    backupPath = join(directory, 'prod.v1.backup.db')

    const database = new Database(databasePath)
    database.exec(legacySchema)
    database
      .prepare(
        `INSERT INTO "Schedule" (
          id, type, name, rrules, rTimeCode, exTimeCode, comment,
          star, deleted, created, updated, syncAt, version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        '018f6f50-4eb0-7b90-a612-2d37b4fd4000',
        'event',
        'Legacy review',
        '',
        '2026/7/13 10:00-11:00;',
        '',
        'legacy comment',
        1,
        0,
        '2026-07-11T02:00:00Z',
        '2026-07-11T03:00:00Z',
        null,
        3
      )
    database
      .prepare('INSERT INTO "Time" (id, scheduleId, end) VALUES (?, ?, ?)')
      .run('time-1', '018f6f50-4eb0-7b90-a612-2d37b4fd4000', '2026-07-13T03:00:00Z')
    database
      .prepare('INSERT INTO "Record" (id, scheduleId, start, end) VALUES (?, ?, ?, ?)')
      .run(
        'record-1',
        '018f6f50-4eb0-7b90-a612-2d37b4fd4000',
        '2026-07-11T02:00:00Z',
        '2026-07-11T03:00:00Z'
      )
    database.close()
  })

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true })
  })

  it('backs up and migrates legacy schedules without discarding dependent data', () => {
    const original = readFileSync(databasePath)

    expect(migrateV1Database(databasePath, backupPath)).toEqual({ status: 'migrated' })
    expect(existsSync(backupPath)).toBe(true)
    expect(readFileSync(backupPath)).toEqual(original)

    const database = new Database(databasePath, { readonly: true })
    expect(database.prepare('SELECT COUNT(*) AS count FROM schedule').get()).toEqual({ count: 1 })
    expect(database.prepare('SELECT title, kind, starred FROM schedule').get()).toEqual({
      title: 'Legacy review',
      kind: 'event',
      starred: 1
    })
    expect(database.prepare('SELECT COUNT(*) AS count FROM legacy_time').get()).toEqual({ count: 1 })
    expect(database.prepare('SELECT COUNT(*) AS count FROM legacy_record').get()).toEqual({ count: 1 })
    database.close()
  })

  it('is idempotent after a successful migration', () => {
    expect(migrateV1Database(databasePath, backupPath)).toEqual({ status: 'migrated' })
    expect(migrateV1Database(databasePath, backupPath)).toEqual({ status: 'current' })

    const database = new Database(databasePath, { readonly: true })
    expect(database.prepare('SELECT COUNT(*) AS count FROM schedule').get()).toEqual({ count: 1 })
    expect(database.prepare('SELECT COUNT(*) AS count FROM app_migration').get()).toEqual({ count: 1 })
    database.close()
  })

  it('refuses to overwrite an existing backup', () => {
    writeFileSync(backupPath, 'existing backup')

    expect(() => migrateV1Database(databasePath, backupPath)).toThrow('备份文件已存在')
    expect(readFileSync(backupPath, 'utf8')).toBe('existing backup')

    const database = new Database(databasePath, { readonly: true })
    expect(database.prepare('SELECT COUNT(*) AS count FROM "Schedule"').get()).toEqual({ count: 1 })
    database.close()
  })
})
