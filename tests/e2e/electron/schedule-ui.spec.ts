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
    await expect(window.getByRole('row', { name: /持久化周会/ })).toBeVisible()
    expect(await window.evaluate(() => typeof process)).toBe('undefined')

    await application.close()
    application = await launch()
    window = await application.firstWindow()
    await expect(window.getByRole('row', { name: /持久化周会/ })).toBeVisible()
  } finally {
    await application.close()
    rmSync(directory, { recursive: true, force: true })
  }
})

test('renders a visible week grid and the schedule comment tooltip', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'schedule-electron-week-'))
  const databasePath = join(directory, 'schedule.db')
  const profilePath = join(directory, 'profile')
  const application = await electron.launch({
    args: [`--user-data-dir=${profilePath}`, '.'],
    env: {
      ...process.env,
      SCHEDULE_DATABASE_PATH: databasePath,
      SCHEDULE_DISABLE_TRAY: '1'
    }
  })

  try {
    const window = await application.firstWindow()
    const now = new Date()
    const dateCode = `${now.getUTCFullYear()}/${now.getUTCMonth() + 1}/${now.getUTCDate()}`
    await window.getByRole('button', { name: 'Add' }).click()
    await window.getByLabel('Name').fill('周视图回归')
    await window.getByLabel('rTime').fill(`${dateCode} 10:00-11:00;`)
    await window.getByLabel('Comment').fill('周视图备注')
    await window.getByRole('button', { name: 'Confirm' }).click()
    await window.getByRole('button', { name: 'week', exact: true }).click()

    const week = window.getByTestId('week-view')
    await expect(week).toBeVisible()
    const workspaceBox = await window.locator('.schedule-workspace').boundingBox()
    const weekBox = await week.boundingBox()
    expect(weekBox?.height).toBeGreaterThan((workspaceBox?.height ?? 0) * 0.75)

    const columns = week.locator('.day-card')
    expect(await columns.count()).toBe(5)
    for (const column of await columns.all()) {
      expect((await column.boundingBox())?.height).toBeGreaterThan((weekBox?.height ?? 0) * 0.95)
    }

    const card = week.getByRole('button', { name: /周视图回归/ })
    await expect(card).toBeVisible()
    expect((await card.boundingBox())?.height).toBeGreaterThan(0)
    await card.hover()
    await expect(window.getByText('周视图备注')).toBeVisible()
  } finally {
    await application.close()
    rmSync(directory, { recursive: true, force: true })
  }
})
