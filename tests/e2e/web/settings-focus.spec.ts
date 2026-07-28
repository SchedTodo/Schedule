import { expect, test } from '@playwright/test'

import { createSchedule } from '../support/web'

test('updates settings and completes a focus-stage transition with a virtual clock', async ({
  page
}) => {
  await page.clock.install({ time: new Date('2026-07-13T04:00:00.000Z') })
  await page.goto('/')
  await createSchedule(page, {
    title: '专注待办',
    recurrenceCode: '2026/7/13 18:00'
  })

  await page.getByRole('link', { name: '设置' }).click()
  await page.getByText('周二', { exact: true }).click()
  await page.getByText('周视图', { exact: true }).click()
  const focusMinutes = page
    .getByText('专注时长', { exact: true })
    .locator('xpath=following-sibling::div[1]')
    .getByRole('textbox', { name: '请输入' })
  await focusMinutes.fill('1')
  await focusMinutes.press('Enter')
  await expect(page.getByRole('radio', { name: '周二' })).toBeChecked()
  await expect(page.getByRole('radio', { name: '周视图' })).toBeChecked()
  await expect(focusMinutes).toHaveValue('1')

  await page.getByRole('link', { name: '首页' }).click()
  await page
    .getByRole('row', { name: /专注待办/ })
    .getByRole('button', { name: '专注', exact: true })
    .click()
  await expect(page.getByText('第 1 / 4 次专注')).toBeVisible()
  await page.getByTestId('focus-toggle').click()
  await expect(page.getByTestId('focus-toggle')).toHaveText('暂停')
  await page.getByTestId('focus-toggle').click()
  await expect(page.getByTestId('focus-toggle')).toHaveText('继续')
  await page.getByTestId('focus-toggle').click()
  await page.clock.fastForward('01:00')
  await expect(page.getByText('短休息')).toBeVisible()
})

test('switches language immediately and restores it after reload', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: '设置' }).click()
  await page
    .getByText('语言', { exact: true })
    .locator('xpath=following-sibling::div[1]')
    .click()
  await page.getByText('English', { exact: true }).last().click()

  await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible()
  await expect(page.getByText('Appearance', { exact: true })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible()
  await expect(page.getByText('Appearance', { exact: true })).toBeVisible()
})
