import { expect, test } from '@playwright/test'

import { createSchedule } from '../support/web'

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-07-13T04:00:00.000Z'))
  await page.goto('/')
})

test('creates, edits, and soft-deletes a Todo', async ({ page }) => {
  await createSchedule(page, {
    title: '端到端待办',
    recurrenceCode: '2026/7/13 18:00'
  })
  await page.getByText('端到端待办', { exact: true }).first().click()
  await page.getByRole('button', { name: 'Edit' }).click()
  await page.getByLabel('Name').fill('已编辑待办')
  await page.getByLabel('rTime').fill('2026/7/13 19:00')
  await page.getByRole('button', { name: 'Confirm' }).click()
  await expect(page.getByText('已编辑待办', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Delete' }).first().click()
  await page.getByRole('button', { name: 'Confirm' }).click()
  await expect(page).toHaveURL(/#\/database$/)
  await expect(page.getByRole('row', { name: /已编辑待办.*true/ })).toBeVisible()
})

test('shows a parser error instead of silently closing the workflow', async ({ page }) => {
  await createSchedule(page, {
    title: '无效日程',
    recurrenceCode: 'not a schedule expression'
  })

  await expect(page.getByRole('alert')).toContainText('日程数据无效')
  await expect(page.getByText('无效日程', { exact: true })).toHaveCount(0)
})
