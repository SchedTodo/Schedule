import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

interface LaunchedSchedule {
  application: ElectronApplication
  directory: string
}

async function launchSchedule(extraArgs: readonly string[] = []): Promise<LaunchedSchedule> {
  const directory = mkdtempSync(join(tmpdir(), 'schedule-electron-startup-'))
  const application = await electron.launch({
    args: [
      `--user-data-dir=${directory}`,
      '.',
      ...extraArgs
    ],
    env: {
      ...process.env,
      SCHEDULE_DISABLE_TRAY: '1',
      SCHEDULE_DATABASE_PATH: ':memory:'
    }
  })
  return { application, directory }
}

async function closeSchedule({ application, directory }: LaunchedSchedule): Promise<void> {
  await application.close()
  rmSync(directory, { recursive: true, force: true })
}

test('starts one visible maximized and isolated window from the standalone Web build', async () => {
  const launched = await launchSchedule()
  const { application } = launched
  try {
    const window = await application.firstWindow()
    await expect(window.getByRole('link', { name: 'Home' })).toBeVisible()
    await expect(window.getByText('Guest')).toBeVisible()
    await expect(window.getByRole('button', { name: 'Add' })).toBeVisible()
    expect(application.windows()).toHaveLength(1)
    await expect.poll(() => application.evaluate(({ BrowserWindow }) => {
      const mainWindow = BrowserWindow.getAllWindows()[0]
      return mainWindow
        ? { visible: mainWindow.isVisible(), maximized: mainWindow.isMaximized() }
        : undefined
    })).toEqual({ visible: true, maximized: true })
    await expect.poll(() => window.evaluate(() => typeof process)).toBe('undefined')
    await expect.poll(() =>
      window.evaluate(() => {
        const host = Reflect.get(window, 'scheduleHost') as Record<string, unknown> | undefined
        return host ? Object.keys(host).sort() : []
      })
    ).toEqual([
      'createRecord',
      'createSchedule',
      'deleteRecord',
      'excludeOccurrences',
      'findScheduleById',
      'getSettings',
      'listOccurrences',
      'listRecords',
      'listScheduleOccurrences',
      'listSchedules',
      'listTodos',
      'searchSchedules',
      'setOccurrenceDone',
      'setScheduleDeleted',
      'setScheduleStarred',
      'showNotification',
      'updateOccurrenceComment',
      'updateSchedule',
      'updateSettings'
    ])
  } finally {
    await closeSchedule(launched)
  }
})

test('keeps an autostart launch hidden and out of the foreground', async () => {
  const launched = await launchSchedule(['--autostart'])
  const { application } = launched
  try {
    await application.firstWindow()
    await expect.poll(() => application.evaluate(({ BrowserWindow }) => {
      const mainWindow = BrowserWindow.getAllWindows()[0]
      return mainWindow
        ? {
            visible: mainWindow.isVisible(),
            maximized: mainWindow.isMaximized(),
            focused: mainWindow.isFocused()
          }
        : undefined
    })).toEqual({ visible: false, maximized: false, focused: false })
  } finally {
    await closeSchedule(launched)
  }
})

test('denies unsafe window.open requests without creating a child window', async () => {
  const launched = await launchSchedule()
  const { application } = launched
  try {
    const window = await application.firstWindow()
    await window.evaluate(() => { window.open('file:///C:/secret.txt') })
    await expect.poll(() => application.windows().length).toBe(1)
  } finally {
    await closeSchedule(launched)
  }
})

test('exits when the user closes the window while the tray is disabled', async () => {
  const launched = await launchSchedule()
  const { application, directory } = launched
  const process = application.process()
  try {
    const window = await application.firstWindow()
    const exited = new Promise<void>((resolve, reject) => {
      process.once('exit', () => { resolve() })
      process.once('error', reject)
    })
    await window.close()
    await exited
  } finally {
    if (process.exitCode === null) await application.close()
    rmSync(directory, { recursive: true, force: true })
  }
})
