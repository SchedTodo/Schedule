import { app, BrowserWindow, ipcMain } from 'electron'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { ScheduleService } from '../../src/application/schedule-service'
import { dueAlarms } from '../../src/application/alarm-scheduler'
import { SystemClock } from '../../src/domain/shared/clock'
import { CryptoIdGenerator } from '../../src/domain/shared/id-generator'
import { initializeScheduleDatabase } from '../adapters/db/client'
import schemaSql from '../adapters/db/schema.sql?raw'
import { DrizzleOccurrenceRepository } from '../adapters/db/occurrence-repository'
import { DrizzleSettingsRepository } from '../adapters/db/settings-repository'
import { ElectronNotifier } from '../adapters/electron-notifier'
import { DrizzleRecordRepository } from '../adapters/db/record-repository'
import { DrizzleScheduleRepository } from '../adapters/db/schedule-repository'
import { registerScheduleIpcHandlers } from './ipc/register-handlers'
import { registerApplicationLifecycle } from './lifecycle'
import { createMainWindowOptions, loadMainWindow } from './window'
import { createApplicationTray } from './tray'

const mainDirectory = dirname(fileURLToPath(import.meta.url))
const preloadPath = resolve(mainDirectory, '../preload/index.cjs')
const webEntryPath = resolve(mainDirectory, '../../dist-web/index.html')
let quitting = false

function createWindow(): BrowserWindow {
  const window = new BrowserWindow(createMainWindowOptions(preloadPath))
  window.on('close', (event) => {
    if (quitting || process.env.SCHEDULE_DISABLE_TRAY === '1') return
    event.preventDefault()
    window.hide()
  })
  void loadMainWindow(window, process.env.VITE_DEV_SERVER_URL, webEntryPath)
  return window
}

function registerSchedulePlatform(): void {
  const databasePath =
    process.env.SCHEDULE_DATABASE_PATH ?? resolve(app.getPath('userData'), 'schedule-v2.db')
  const connection = initializeScheduleDatabase(databasePath, schemaSql)
  const repository = new DrizzleScheduleRepository(connection.database)
  const occurrenceRepository = new DrizzleOccurrenceRepository(connection.database)
  const settingsRepository = new DrizzleSettingsRepository(connection.database)
  const notifier = new ElectronNotifier()
  const recordRepository = new DrizzleRecordRepository(connection.database, new CryptoIdGenerator())
  const notified = new Set<string>()
  const service = new ScheduleService(repository, {
    clock: new SystemClock(),
    idGenerator: new CryptoIdGenerator(),
    defaultTimeZone: 'UTC',
    weekStartsOn: 1,
    resolveTimeZoneAbbreviation: () => ({ kind: 'unknown' })
  }, occurrenceRepository)
  async function configuredService() {
    const current = await settingsRepository.get()
    const settings = current.ok ? current.value : undefined
    return new ScheduleService(repository, {
      clock: new SystemClock(),
      idGenerator: new CryptoIdGenerator(),
      defaultTimeZone: settings?.timeZone ?? 'UTC',
      weekStartsOn: settings?.weekStart ?? 1,
      resolveTimeZoneAbbreviation: () => ({ kind: 'unknown' })
    }, occurrenceRepository)
  }
  registerScheduleIpcHandlers(ipcMain, {
    schedules: {
      create: async (input) => (await configuredService()).create(input),
      update: async (input) => (await configuredService()).update(input),
      findById: (id) => service.findById(id),
      list: (query) => service.list(query),
      setStarred: (input) => service.setStarred(input),
      setDeleted: (input) => service.setDeleted(input),
      searchPage: (query) => service.searchPage(query)
    },
    occurrences: occurrenceRepository,
    settings: {
      get: () => settingsRepository.get(),
      async update(input) {
        const result = await settingsRepository.update(input)
        if (result.ok && input.openAtLogin !== undefined) {
          app.setLoginItemSettings({ openAtLogin: input.openAtLogin })
        }
        return result
      }
    },
    records: recordRepository,
    notifications: {
      async show(input) {
        notifier.notifyMessage(input)
        return { ok: true, value: undefined }
      }
    }
  })
  const alarmTimer = setInterval(() => {
    void (async () => {
      const now = new Date()
      const settings = await settingsRepository.get()
      if (!settings.ok) return
      const end = new Date(now.getTime() + 2 * 86_400_000)
      const [events, todos] = await Promise.all([
        occurrenceRepository.listRange({ start: now.toISOString(), end: end.toISOString(), limit: 5000 }),
        occurrenceRepository.listTodos({
          now: now.toISOString(),
          timeZone: settings.value.timeZone,
          logicalDayStartHour: settings.value.logicalDayStartHour,
          logicalDayStartMinute: settings.value.logicalDayStartMinute
        })
      ])
      if (!events.ok || !todos.ok) return
      for (const alarm of dueAlarms([...events.value, ...todos.value], settings.value, now.toISOString(), 30)) {
        const key = `${alarm.occurrence.id}:${alarm.alarmAt}`
        if (notified.has(key)) continue
        notified.add(key)
        notifier.notify(alarm)
      }
    })()
  }, 30_000)
  app.on('before-quit', () => {
    clearInterval(alarmTimer)
    connection.sqlite.close()
  })
}

void app.whenReady().then(() => {
  registerSchedulePlatform()
  registerApplicationLifecycle(app, createWindow, () => BrowserWindow.getAllWindows().length)
  createWindow()
  app.on('before-quit', () => {
    quitting = true
  })
  if (process.env.SCHEDULE_DISABLE_TRAY === '1') return
  const tray = createApplicationTray(
    resolve(mainDirectory, '../../resources/icon256.ico'),
    () => BrowserWindow.getAllWindows()[0],
    createWindow,
    () => {
      quitting = true
      app.quit()
    }
  )
  app.on('before-quit', () => {
    tray.destroy()
  })
})
