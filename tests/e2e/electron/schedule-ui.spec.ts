import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { _electron as electron, expect, test } from '@playwright/test'

test('creates and restores a schedule through the isolated host gateway', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'schedule-electron-ui-'))
  const databasePath = join(directory, 'schedule.db')
  const profilePath = join(directory, 'profile')
  const launch = () =>
    electron.launch({
      args: [
        `--user-data-dir=${profilePath}`,
        '.'
      ],
      env: {
        ...process.env,
        SCHEDULE_DATABASE_PATH: databasePath,
        SCHEDULE_DISABLE_TRAY: '1'
      }
    })

  let application = await launch()
  try {
    let window = await application.firstWindow()
    await window.getByRole('button', { name: 'Add' }).click()
    await window.getByLabel('Name').fill('持久化周会')
    await window.getByLabel('rTime').fill('2026/7/12 10:00')
    await window.getByRole('button', { name: 'Confirm' }).click()
    await expect(window.getByRole('button', { name: /持久化周会/ })).toBeVisible()
    expect(await window.evaluate(() => typeof process)).toBe('undefined')

    await application.close()
    application = await launch()
    window = await application.firstWindow()
    await expect(window.getByRole('button', { name: /持久化周会/ })).toBeVisible()
  } finally {
    await application.close()
    rmSync(directory, { recursive: true, force: true })
  }
})
