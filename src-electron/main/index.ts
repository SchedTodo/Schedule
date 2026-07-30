import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  powerMonitor,
  screen,
  shell
} from 'electron'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { AlarmCoordinator } from '../../src/application/alarm-coordinator'
import { ScheduleService } from '../../src/application/schedule-service'
import { SystemClock } from '../../src/domain/shared/clock'
import { CryptoIdGenerator } from '../../src/domain/shared/id-generator'
import { resolveConfiguredTimeZoneAbbreviation } from '../../src/parser/time-zone-abbreviations'
import { resolveSupportedLocale } from '../../src/i18n/locale'
import { initializeScheduleDatabase } from '../adapters/db/client'
import schemaSql from '../adapters/db/schema.sql?raw'
import { DrizzleOccurrenceRepository } from '../adapters/db/occurrence-repository'
import { DrizzleSettingsRepository } from '../adapters/db/settings-repository'
import { ElectronNotifier } from '../adapters/electron-notifier'
import { ElectronExternalLink } from '../adapters/electron-external-link'
import { DrizzleRecordRepository } from '../adapters/db/record-repository'
import { DrizzleScheduleRepository } from '../adapters/db/schedule-repository'
import {
  DesktopLifecycleController,
  resolveLaunchMode,
  type Disposable
} from './desktop-lifecycle-controller'
import { AlarmRuntime } from './alarm-runtime'
import {
  createElectronShortcutPort,
  createElectronWindowPort
} from './electron-desktop-adapters'
import { registerScheduleIpcHandlers } from './ipc/register-handlers'
import { createMainWindowOptions, installWindowOpenHandler, loadMainWindow } from './window'
import { createApplicationTray, type TrayLike } from './tray'
import { registerWidgetIpcHandlers } from './ipc/register-widget-handlers'
import { widgetIpcChannels } from '../ipc-contracts/widget-ipc'
import {
  createWidgetWindowOptions,
  ensureVisibleBounds,
  WidgetWindowStateStore
} from './widget-window'

const mainDirectory = dirname(fileURLToPath(import.meta.url))
const preloadPath = resolve(mainDirectory, '../preload/index.cjs')
const webEntryPath = resolve(mainDirectory, '../../dist-web/index.html')

/**
 * 组装数据库、仓储、应用服务、IPC 和提醒运行时，并返回需要随应用释放的资源。
 */
function registerSchedulePlatform(onDataChanged?: () => void): readonly Disposable[] {
  const databasePath =
    process.env.SCHEDULE_DATABASE_PATH ?? resolve(app.getPath('userData'), 'schedule-v2.db')
  const connection = initializeScheduleDatabase(databasePath, schemaSql)
  const repository = new DrizzleScheduleRepository(connection.database)
  const occurrenceRepository = new DrizzleOccurrenceRepository(connection.database)
  const settingsRepository = new DrizzleSettingsRepository(
    connection.database,
    resolveSupportedLocale(app.getLocale())
  )
  const notifier = new ElectronNotifier()
  const recordRepository = new DrizzleRecordRepository(connection.database, new CryptoIdGenerator())
  const alarmRuntime = new AlarmRuntime({
    coordinator: new AlarmCoordinator({
      clock: new SystemClock(),
      getSettings: () => settingsRepository.get(),
      listCandidates: (query) => occurrenceRepository.listAlarmCandidates(query),
      notify: async (input) => { notifier.notifyMessage(input) }
    }),
    powerMonitor,
    reportError: (error) => { console.error('Electron alarm failed', error) }
  })
  const service = new ScheduleService(repository, {
    clock: new SystemClock(),
    idGenerator: new CryptoIdGenerator(),
    defaultTimeZone: 'UTC',
    weekStartsOn: 1,
    resolveTimeZoneAbbreviation: () => ({ kind: 'unknown' })
  }, occurrenceRepository)
  /** 按数据库中的最新设置创建写操作服务，避免长期缓存时区和周起始日。 */
  async function configuredService() {
    const current = await settingsRepository.get()
    const settings = current.ok ? current.value : undefined
    return new ScheduleService(repository, {
      clock: new SystemClock(),
      idGenerator: new CryptoIdGenerator(),
      defaultTimeZone: settings?.timeZone ?? 'UTC',
      weekStartsOn: settings?.weekStart ?? 1,
      resolveTimeZoneAbbreviation: (value) =>
        resolveConfiguredTimeZoneAbbreviation(
          value,
          settings?.timeZoneAbbreviations ?? {}
        )
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
  }, {
    onAlarmInputsChanged: () => {
      void alarmRuntime.request('mutation')
      onDataChanged?.()
    }
  })
  void alarmRuntime.start()
  return [
    alarmRuntime,
    { dispose: () => { connection.sqlite.close() } }
  ]
}

void app.whenReady().then(() => {
  let widgetForChanges: BrowserWindow | undefined
  const resources = registerSchedulePlatform(() => {
    widgetForChanges?.webContents.send(widgetIpcChannels.dataChanged)
  })
  const backgroundEnabled = process.env.SCHEDULE_DISABLE_TRAY !== '1'
  const mainWindow = new BrowserWindow(createMainWindowOptions(preloadPath))
  installWindowOpenHandler(
    mainWindow.webContents,
    new ElectronExternalLink(shell),
    (error) => { console.error('Electron external link failed', error) }
  )

  const widgetStore = new WidgetWindowStateStore(
    resolve(app.getPath('userData'), 'widget-window-state.json')
  )
  const storedWidgetState = widgetStore.load()
  if (storedWidgetState.bounds !== undefined) {
    storedWidgetState.bounds = ensureVisibleBounds(
      storedWidgetState.bounds,
      screen.getDisplayMatching(storedWidgetState.bounds).workArea
    )
  }
  const widgetAvailable = process.env.SCHEDULE_DISABLE_WIDGET !== '1'
  const widgetWindow = widgetAvailable
    ? new BrowserWindow(createWidgetWindowOptions(preloadPath, storedWidgetState))
    : undefined
  let tray: TrayLike | undefined
  let widgetFeatureEnabled =
    storedWidgetState.enabled || process.env.SCHEDULE_ENABLE_WIDGET === '1'
  let quitting = false
  let saveWidgetTimer: ReturnType<typeof setTimeout> | undefined
  function saveWidgetState(): void {
    if (!widgetWindow) return
    try {
      widgetStore.save({
        bounds: widgetWindow.getBounds(),
        enabled: widgetFeatureEnabled,
        visible: widgetWindow.isVisible(),
        alwaysOnTop: widgetWindow.isAlwaysOnTop()
      })
    } catch (error) {
      console.error('Electron widget state failed', error)
    }
  }
  function scheduleWidgetSave(): void {
    if (saveWidgetTimer !== undefined) clearTimeout(saveWidgetTimer)
    saveWidgetTimer = setTimeout(saveWidgetState, 150)
  }
  function showWidget(focus = true): void {
    if (!widgetWindow) return
    widgetWindow.setIgnoreMouseEvents(false)
    if (focus) {
      widgetWindow.show()
      widgetWindow.focus()
    } else {
      widgetWindow.showInactive()
    }
    saveWidgetState()
  }
  function toggleWidget(): void {
    if (!widgetWindow || !widgetFeatureEnabled) return
    if (widgetWindow.isVisible()) {
      widgetWindow.hide()
      saveWidgetState()
    } else {
      showWidget()
    }
  }
  const launchMode = resolveLaunchMode(process.argv)
  const controller = new DesktopLifecycleController({
    window: createElectronWindowPort(mainWindow),
    shortcuts: createElectronShortcutPort(globalShortcut),
    requestAppQuit: () => { app.quit() },
    reportError: (error) => { console.error('Electron lifecycle failed', error) },
    resources: [
      ...resources,
      {
        dispose: () => {
          if (saveWidgetTimer !== undefined) clearTimeout(saveWidgetTimer)
          saveWidgetState()
          tray?.destroy()
        }
      }
    ],
    backgroundEnabled,
    development: Boolean(process.env.VITE_DEV_SERVER_URL),
    onMainShown: () => { widgetWindow?.hide() },
    onMainHidden: () => {
      if (widgetFeatureEnabled) showWidget(false)
    }
  })

  controller.start(launchMode)
  if (widgetWindow) {
    widgetForChanges = widgetWindow
    installWindowOpenHandler(
      widgetWindow.webContents,
      new ElectronExternalLink(shell),
      (error) => { console.error('Electron widget external link failed', error) }
    )
    widgetWindow.on('ready-to-show', () => {
      if (widgetFeatureEnabled && launchMode === 'autostart') showWidget(false)
    })
    widgetWindow.on('close', (event) => {
      if (quitting) return
      event.preventDefault()
      widgetWindow.hide()
      saveWidgetState()
    })
    widgetWindow.on('move', scheduleWidgetSave)
    widgetWindow.on('resize', scheduleWidgetSave)
    registerWidgetIpcHandlers(ipcMain, {
      widget: widgetWindow,
      main: mainWindow,
      showMain: () => { controller.showMainWindow() },
      isEnabled: () => widgetFeatureEnabled,
      setEnabled: (value) => {
        widgetFeatureEnabled = value
        if (!value) widgetWindow.hide()
      },
      saveState: saveWidgetState
    })
  }
  if (backgroundEnabled) {
    tray = createApplicationTray(resolve(mainDirectory, '../../resources/icon256.ico'), {
      show: () => { controller.showMainWindow() },
      toggleWidget,
      quit: () => { controller.quit() }
    })
  }

  app.on('activate', () => { controller.showMainWindow() })
  app.on('before-quit', () => {
    quitting = true
    controller.dispose()
  })
  app.on('window-all-closed', () => {
    if (!backgroundEnabled) app.quit()
  })
  void loadMainWindow(mainWindow, process.env.VITE_DEV_SERVER_URL, webEntryPath)
  if (widgetWindow) {
    const widgetUrl = process.env.VITE_DEV_SERVER_URL
      ? `${process.env.VITE_DEV_SERVER_URL.replace(/\/$/u, '')}/#/widget`
      : `${pathToFileURL(webEntryPath).href}#/widget`
    void widgetWindow.loadURL(widgetUrl)
  }
})
