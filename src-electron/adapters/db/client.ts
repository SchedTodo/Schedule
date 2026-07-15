import { existsSync } from 'node:fs'

import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'

import { databaseSchema } from './schema'

export function openScheduleDatabase(path: string) {
  const sqlite = new Database(path)
  sqlite.pragma('foreign_keys = ON')
  sqlite.pragma('journal_mode = WAL')

  return {
    sqlite,
    database: drizzle(sqlite, { schema: databaseSchema })
  }
}

export function initializeScheduleDatabase(path: string, schemaSql: string) {
  const databaseExists = existsSync(path)
  const connection = openScheduleDatabase(path)
  if (!databaseExists) connection.sqlite.exec(schemaSql)
  return connection
}
