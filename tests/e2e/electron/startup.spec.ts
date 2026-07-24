import { expect, test } from '@playwright/test'

import { closeSchedule, launchSchedule } from '../support/electron'

test('starts one visible maximized and isolated window from the standalone Web build', async () => {
  const launched = await launchSchedule({ databasePath: ':memory:' })
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
  const launched = await launchSchedule({
    databasePath: ':memory:',
    extraArgs: ['--autostart']
  })
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
  const launched = await launchSchedule({ databasePath: ':memory:' })
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
  const launched = await launchSchedule({ databasePath: ':memory:' })
  const { application } = launched
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
    await closeSchedule(launched)
  }
})

test('hides on close while tray mode is active and restores on activate', async () => {
  const launched = await launchSchedule({ databasePath: ':memory:', tray: true })
  try {
    await launched.application.firstWindow()
    await launched.application.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.close()
    })
    await expect
      .poll(() =>
        launched.application.evaluate(
          ({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isVisible()
        )
      )
      .toBe(false)
    expect(launched.application.process().exitCode).toBeNull()

    await launched.application.evaluate(({ app }) => {
      app.emit('activate')
    })
    await expect
      .poll(() =>
        launched.application.evaluate(({ BrowserWindow }) => {
          const window = BrowserWindow.getAllWindows()[0]
          return (
            window && {
              visible: window.isVisible(),
              maximized: window.isMaximized(),
              focused: window.isFocused()
            }
          )
        })
      )
      .toEqual({ visible: true, maximized: true, focused: true })
  } finally {
    await closeSchedule(launched)
  }
})
