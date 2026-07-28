import { expect, test } from '@playwright/test'

test('loads the standalone Web application without a host preload', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-07-13T04:00:00.000Z'))
  await page.goto('/')

  await expect(page.getByRole('link', { name: '首页' })).toBeVisible()
  await expect(page.getByText('访客')).toBeVisible()
  await expect(page.getByRole('button', { name: '添加' })).toBeVisible()
  expect(await page.evaluate(() => Reflect.has(globalThis, 'scheduleHost'))).toBe(false)
})
