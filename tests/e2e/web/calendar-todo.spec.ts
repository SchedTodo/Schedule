import { expect, test } from '@playwright/test'

import { createSchedule } from '../support/web'

test('completes a Todo and switches an event between month and week views', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-07-13T04:00:00.000Z'))
  await page.goto('/')
  await createSchedule(page, {
    title: '日历事件',
    recurrenceCode: '2026/7/13 10:00-11:00;'
  })
  await createSchedule(page, {
    title: '完成待办',
    recurrenceCode: '2026/7/13 18:00'
  })

  await expect(page.getByTestId('month-view').getByText('日历事件')).toBeVisible()
  await page.getByRole('button', { name: 'week', exact: true }).click()
  await expect(page.getByTestId('week-view').getByText('日历事件')).toBeVisible()
  await page.getByRole('button', { name: 'month', exact: true }).click()
  await expect(page.getByTestId('month-view')).toBeVisible()

  const row = page.getByRole('row', { name: /完成待办/ })
  await row.getByRole('checkbox', { name: 'Done' }).check()
  await expect(row.getByRole('checkbox', { name: 'Done' })).toBeChecked()
})
