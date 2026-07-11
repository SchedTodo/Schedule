import { copyFileSync, existsSync, readFileSync } from 'node:fs'
import { constants } from 'node:fs'

import Database from 'better-sqlite3'

export type MigrationResult = { readonly status: 'current' | 'migrated' }

interface LegacyScheduleRow {
  readonly id: string
  readonly type: string
  readonly name: string
  readonly rTimeCode: string
  readonly exTimeCode: string
  readonly comment: string
  readonly star: number
  readonly deleted: number
  readonly created: string | null
  readonly updated: string | null
}

function tableExists(database: Database.Database, name: string): boolean {
  return (
    database
      .prepare(
        `SELECT 1
         FROM sqlite_master
         WHERE type = 'table' AND lower(name) = lower(?)`
      )
      .get(name) !== undefined
  )
}

function isCurrentDatabase(database: Database.Database): boolean {
  if (!tableExists(database, 'app_migration')) return false
  const row = database.prepare('SELECT MAX(version) AS version FROM app_migration').get() as {
    version: number | null
  }
  return (row.version ?? 0) >= 1
}

function renameLegacyTable(database: Database.Database, source: string, target: string): void {
  if (tableExists(database, source) && !tableExists(database, target)) {
    database.exec(`ALTER TABLE "${source}" RENAME TO "${target}"`)
  }
}

function instantMilliseconds(value: string | null, fallback: number): number {
  if (value === null) return fallback
  const milliseconds = Date.parse(value)
  return Number.isNaN(milliseconds) ? fallback : milliseconds
}

export function migrateV1Database(databasePath: string, backupPath: string): MigrationResult {
  const inspectionDatabase = new Database(databasePath)
  try {
    if (isCurrentDatabase(inspectionDatabase)) return { status: 'current' }
    if (!tableExists(inspectionDatabase, 'Schedule')) {
      throw new Error('不支持的数据库格式：未找到 1.2 Schedule 表')
    }
  } finally {
    inspectionDatabase.close()
  }

  if (existsSync(backupPath)) {
    throw new Error(`备份文件已存在：${backupPath}`)
  }
  copyFileSync(databasePath, backupPath, constants.COPYFILE_EXCL)

  const database = new Database(databasePath)
  const migrationSql = readFileSync(
    new URL('./migrations/0001_v2_schema.sql', import.meta.url),
    'utf8'
  )

  try {
    database.transaction(() => {
      renameLegacyTable(database, 'Schedule', 'legacy_schedule')
      renameLegacyTable(database, 'Time', 'legacy_time')
      renameLegacyTable(database, 'Record', 'legacy_record')
      renameLegacyTable(database, 'Setting', 'legacy_setting')
      database.exec(migrationSql)

      const rows = database.prepare('SELECT * FROM legacy_schedule').all() as LegacyScheduleRow[]
      const insert = database.prepare(
        `INSERT INTO schedule (
          id, kind, title, recurrence_code, exclusion_code, comment,
          starred, deleted_at, created_at, updated_at
        ) VALUES (
          @id, @kind, @title, @recurrenceCode, @exclusionCode, @comment,
          @starred, @deletedAt, @createdAt, @updatedAt
        )`
      )

      for (const row of rows) {
        const createdAt = instantMilliseconds(row.created, 0)
        const updatedAt = instantMilliseconds(row.updated, createdAt)
        insert.run({
          id: row.id,
          kind: row.type === 'todo' ? 'todo' : 'event',
          title: row.name,
          recurrenceCode: row.rTimeCode,
          exclusionCode: row.exTimeCode,
          comment: row.comment,
          starred: row.star === 0 ? 0 : 1,
          deletedAt: row.deleted === 0 ? null : updatedAt,
          createdAt,
          updatedAt
        })
      }
    })()
  } finally {
    database.close()
  }

  return { status: 'migrated' }
}
