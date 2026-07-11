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
