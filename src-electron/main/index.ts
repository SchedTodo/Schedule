import { app, BrowserWindow, ipcMain } from 'electron'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { ScheduleService } from '../../src/application/schedule-service'
import { SystemClock } from '../../src/domain/shared/clock'
import { CryptoIdGenerator } from '../../src/domain/shared/id-generator'
import { openScheduleDatabase } from '../adapters/db/client'
import { migrateV1Database } from '../adapters/db/migrate-v1'
import migrationSql from '../adapters/db/migrations/0001_v2_schema.sql?raw'
import occurrenceMigrationSql from '../adapters/db/migrations/0002_occurrence.sql?raw'
import { DrizzleOccurrenceRepository } from '../adapters/db/occurrence-repository'
import { DrizzleScheduleRepository } from '../adapters/db/schedule-repository'
import { registerScheduleIpcHandlers } from './ipc/register-handlers'
import { registerApplicationLifecycle } from './lifecycle'
import { createMainWindowOptions, loadMainWindow } from './window'

const mainDirectory = dirname(fileURLToPath(import.meta.url))
const preloadPath = resolve(mainDirectory, '../preload/index.cjs')
const webEntryPath = resolve(mainDirectory, '../../dist-web/index.html')

function createWindow(): BrowserWindow {
  const window = new BrowserWindow(createMainWindowOptions(preloadPath))
  void loadMainWindow(window, process.env.VITE_DEV_SERVER_URL, webEntryPath)
  return window
}

function registerSchedulePlatform(): void {
  const databasePath =
    process.env.SCHEDULE_DATABASE_PATH ?? resolve(app.getPath('userData'), 'schedule-v2.db')
  const databaseExists = existsSync(databasePath)
  if (databaseExists) {
    migrateV1Database(databasePath, `${databasePath}.v1.backup.db`, migrationSql)
  }

  const connection = openScheduleDatabase(databasePath)
  if (!databaseExists) connection.sqlite.exec(migrationSql)
  connection.sqlite.exec(occurrenceMigrationSql)
  const repository = new DrizzleScheduleRepository(connection.database)
  const occurrenceRepository = new DrizzleOccurrenceRepository(connection.database)
  const service = new ScheduleService(repository, {
    clock: new SystemClock(),
    idGenerator: new CryptoIdGenerator(),
    defaultTimeZone: 'UTC',
    weekStartsOn: 1,
    resolveTimeZoneAbbreviation: () => ({ kind: 'unknown' })
  }, occurrenceRepository)
  registerScheduleIpcHandlers(ipcMain, { schedules: service, occurrences: occurrenceRepository })
  app.on('before-quit', () => connection.sqlite.close())
}

void app.whenReady().then(() => {
  registerSchedulePlatform()
  registerApplicationLifecycle(app, createWindow, () => BrowserWindow.getAllWindows().length)
  createWindow()
})
