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
        '--disable-gpu',
        '--disable-gpu-compositing',
        '--disable-software-rasterizer',
        `--user-data-dir=${profilePath}`,
        '.'
      ],
      env: {
        ...process.env,
        SCHEDULE_DATABASE_PATH: databasePath
      }
    })

  let application = await launch()
  try {
    let window = await application.firstWindow()
    await window.getByLabel('标题').fill('持久化周会')
    await window.getByLabel('时间规则').fill('2026-07-12 10:00')
    await window.getByRole('button', { name: '创建日程' }).click()
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
