import { expect, test } from '@playwright/test'

test('loads the standalone Web application without a host preload', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-07-13T04:00:00.000Z'))
  await page.goto('/')

  await expect(page.getByRole('link', { name: 'Home' })).toBeVisible()
  await expect(page.getByText('Guest')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add' })).toBeVisible()
  expect(await page.evaluate(() => Reflect.has(globalThis, 'scheduleHost'))).toBe(false)
})
