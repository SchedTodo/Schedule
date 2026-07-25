import { existsSync } from 'node:fs'

import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'

import { databaseSchema } from './schema'

/** 打开 SQLite 数据库，启用外键与 WAL，并创建带模式类型的 Drizzle 客户端。 */
export function openScheduleDatabase(path: string) {
  const sqlite = new Database(path)
  sqlite.pragma('foreign_keys = ON')
  sqlite.pragma('journal_mode = WAL')

  return {
    sqlite,
    database: drizzle(sqlite, { schema: databaseSchema })
  }
}

/** 打开数据库，并仅在首次创建文件时执行初始化模式 SQL。 */
export function initializeScheduleDatabase(path: string, schemaSql: string) {
  const databaseExists = existsSync(path)
  const connection = openScheduleDatabase(path)
  if (!databaseExists) connection.sqlite.exec(schemaSql)
  return connection
}
