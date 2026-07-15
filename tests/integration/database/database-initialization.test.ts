// @vitest-environment node

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { initializeScheduleDatabase } from '../../../src-electron/adapters/db/client'

const schemaSql = readFileSync(
  new URL('../../../src-electron/adapters/db/schema.sql', import.meta.url),
  'utf8'
)

describe('initializeScheduleDatabase', () => {
  let directory: string

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'schedule-database-'))
  })

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true })
  })

  it('creates the complete current schema for a new database', () => {
    const connection = initializeScheduleDatabase(join(directory, 'schedule.db'), schemaSql)
    const tables = connection.sqlite.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
    ).all() as Array<{ name: string }>

    expect(tables.map(({ name }) => name)).toEqual([
      'app_settings',
      'concentration_record',
      'schedule',
      'schedule_occurrence'
    ])
    connection.sqlite.close()
  })

  it('opens an existing database without applying schema changes', () => {
    const path = join(directory, 'existing.db')
    const existing = new Database(path)
    existing.exec('CREATE TABLE marker (value TEXT NOT NULL)')
    existing.close()

    const connection = initializeScheduleDatabase(path, schemaSql)
    const schedule = connection.sqlite.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schedule'"
    ).get()

    expect(schedule).toBeUndefined()
    connection.sqlite.close()
  })
})
