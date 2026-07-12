import { _electron as electron, expect, test } from '@playwright/test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('starts one isolated window from the standalone Web build', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'schedule-electron-startup-'))
  const application = await electron.launch({
    args: [
      `--user-data-dir=${directory}`,
      '.'
    ],
    env: {
      ...process.env,
      SCHEDULE_DISABLE_TRAY: '1',
      SCHEDULE_DATABASE_PATH: ':memory:'
    }
  })
  try {
    const window = await application.firstWindow()
    await expect(window.getByRole('link', { name: 'Home' })).toBeVisible()
    await expect(window.getByText('Guest')).toBeVisible()
    await expect(window.getByRole('button', { name: 'Add' })).toBeVisible()
    expect(application.windows()).toHaveLength(1)
    await expect
      .poll(() => window.evaluate(() => typeof process))
      .toBe('undefined')
    await expect
      .poll(() =>
        window.evaluate(() => {
          const host = Reflect.get(window, 'scheduleHost') as Record<string, unknown> | undefined
          return host ? Object.keys(host).sort() : []
        })
      )
      .toHaveLength(18)
  } finally {
    await application.close()
    rmSync(directory, { recursive: true, force: true })
  }
})
