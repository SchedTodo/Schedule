import { expect, test } from '@playwright/test'

import { closeSchedule, launchSchedule } from '../support/electron'

test('routes Open At Login through app.setLoginItemSettings without changing the host', async () => {
  const launched = await launchSchedule({ databasePath: ':memory:' })
  try {
    const window = await launched.application.firstWindow()
    await launched.application.evaluate(({ app }) => {
      const state = globalThis as typeof globalThis & { capturedLogin?: boolean }
      app.setLoginItemSettings = (settings) => {
        state.capturedLogin = settings.openAtLogin
      }
    })

    await window.getByRole('link', { name: 'Settings' }).click()
    await window
      .getByText('Open At Login', { exact: true })
      .locator('xpath=following-sibling::div[1]')
      .getByRole('switch')
      .click()

    await expect
      .poll(() =>
        launched.application.evaluate(
          () =>
            (globalThis as typeof globalThis & { capturedLogin?: boolean }).capturedLogin
        )
      )
      .toBe(true)
  } finally {
    await closeSchedule(launched)
  }
})

test('validates and delivers a notification through preload and IPC', async () => {
  const launched = await launchSchedule({ databasePath: ':memory:' })
  try {
    const window = await launched.application.firstWindow()
    await launched.application.evaluate(({ Notification }) => {
      const state = globalThis as typeof globalThis & {
        capturedNotification?: { title: string; body: string }
      }
      Notification.prototype.show = function () {
        state.capturedNotification = { title: this.title, body: this.body }
      }
    })

    const result = await window.evaluate(async () => {
      const host = Reflect.get(window, 'scheduleHost') as {
        showNotification(input: { title: string; body: string }): Promise<unknown>
      }
      return host.showNotification({ title: 'Focus', body: 'Focus 2' })
    })
    expect(result).toMatchObject({ ok: true })
    await expect
      .poll(() =>
        launched.application.evaluate(
          () =>
            (
              globalThis as typeof globalThis & {
                capturedNotification?: { title: string; body: string }
              }
            ).capturedNotification
        )
      )
      .toEqual({ title: 'Focus', body: 'Focus 2' })
  } finally {
    await closeSchedule(launched)
  }
})

test('delegates HTTPS externally and rejects unsafe protocols', async () => {
  const launched = await launchSchedule({ databasePath: ':memory:' })
  try {
    const window = await launched.application.firstWindow()
    await launched.application.evaluate(({ shell }) => {
      const state = globalThis as typeof globalThis & { externalUrls?: string[] }
      state.externalUrls = []
      shell.openExternal = async (url) => {
        state.externalUrls?.push(url)
      }
    })

    await window.evaluate(() => {
      window.open('https://example.com/help')
    })
    await expect
      .poll(() =>
        launched.application.evaluate(
          () => (globalThis as typeof globalThis & { externalUrls?: string[] }).externalUrls
        )
      )
      .toEqual(['https://example.com/help'])

    await window.evaluate(() => {
      window.open('file:///C:/secret.txt')
    })
    await expect.poll(() => launched.application.windows().length).toBe(1)
    expect(
      await launched.application.evaluate(
        () => (globalThis as typeof globalThis & { externalUrls?: string[] }).externalUrls
      )
    ).toEqual(['https://example.com/help'])
  } finally {
    await closeSchedule(launched)
  }
})
