import { _electron as electron, expect, test } from '@playwright/test'
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const packageJson = JSON.parse(readFileSync(resolve('package.json'), 'utf8')) as {
  name: string
  version: string
}

test('launches the unpacked production app and has a non-empty NSIS installer', async () => {
  const executable = resolve('release/win-unpacked/schedule.exe')
  const installer = resolve(
    `release/${packageJson.name}-${packageJson.version}-setup.exe`
  )
  expect(statSync(installer).size).toBeGreaterThan(0)

  const directory = mkdtempSync(join(tmpdir(), 'schedule-packaged-e2e-'))
  const application = await electron.launch({
    executablePath: executable,
    args: [`--user-data-dir=${join(directory, 'profile')}`],
    env: {
      ...process.env,
      SCHEDULE_DATABASE_PATH: join(directory, 'schedule.db'),
      SCHEDULE_DISABLE_TRAY: '1'
    }
  })
  try {
    const window = await application.firstWindow()
    await expect(window.getByRole('link', { name: 'Home' })).toBeVisible()
    await expect.poll(() => window.evaluate(() => location.protocol)).toBe('file:')
    await expect.poll(() => window.evaluate(() => typeof process)).toBe('undefined')
    await expect.poll(() => window.evaluate(() =>
      typeof Reflect.get(window, 'scheduleHost')
    )).toBe('object')
  } finally {
    await application.close()
    rmSync(directory, { recursive: true, force: true })
  }
})
