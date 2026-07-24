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

  await page.getByRole('link', { name: 'Settings' }).click()
  await page.getByText('TU', { exact: true }).click()
  await page.getByText('WeekView', { exact: true }).click()
  const focusMinutes = page
    .getByText('Focus Time', { exact: true })
    .locator('xpath=following-sibling::div[1]')
    .getByRole('textbox', { name: 'Please Input' })
  await focusMinutes.fill('1')
  await focusMinutes.press('Enter')
  await expect(page.getByRole('radio', { name: 'TU' })).toBeChecked()
  await expect(page.getByRole('radio', { name: 'WeekView' })).toBeChecked()
  await expect(focusMinutes).toHaveValue('1')

  await page.getByRole('link', { name: 'Home' }).click()
  await page
    .getByRole('row', { name: /专注待办/ })
    .getByRole('button', { name: 'Concentrate' })
    .click()
  await expect(page.getByText('Focus 1 of 4')).toBeVisible()
  await page.getByTestId('focus-toggle').click()
  await expect(page.getByTestId('focus-toggle')).toHaveText('Pause')
  await page.getByTestId('focus-toggle').click()
  await expect(page.getByTestId('focus-toggle')).toHaveText('Resume')
  await page.getByTestId('focus-toggle').click()
  await page.clock.fastForward('01:00')
  await expect(page.getByText('Small Break')).toBeVisible()
})
