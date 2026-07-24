import { expect, test, type ElectronApplication } from '@playwright/test'

import {
  closeSchedule,
  launchSchedule,
  removeScheduleDirectory
} from '../support/electron'

test('creates and restores a schedule through the isolated host gateway', async () => {
  const first = await launchSchedule({ keepDirectory: true })
  let application: ElectronApplication = first.application
  let second: Awaited<ReturnType<typeof launchSchedule>> | undefined
  try {
    let window = await application.firstWindow()
    const deadline = new Date()
    deadline.setUTCDate(deadline.getUTCDate() + 1)
    const dateCode = `${deadline.getUTCFullYear()}/${deadline.getUTCMonth() + 1}/${deadline.getUTCDate()}`
    await window.getByRole('button', { name: 'Add' }).click()
    await window.getByLabel('Name').fill('持久化周会')
    await window.getByLabel('rTime').fill(`${dateCode} 10:00`)
    await window.getByRole('button', { name: 'Confirm' }).click()
    await expect(window.getByRole('row', { name: /持久化周会/ })).toBeVisible()
    expect(await window.evaluate(() => typeof process)).toBe('undefined')

    await closeSchedule(first)
    second = await launchSchedule({ directory: first.directory })
    application = second.application
    window = await application.firstWindow()
    await expect(window.getByRole('row', { name: /持久化周会/ })).toBeVisible()
  } finally {
    if (second) await closeSchedule(second)
    else {
      if (application.process().exitCode === null) await application.close()
      removeScheduleDirectory(first.directory)
    }
  }
})

test('renders a visible week grid and the schedule comment tooltip', async () => {
  const launched = await launchSchedule()
  const { application } = launched

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

    await card.click()
    await expect(window.locator('.n-page-header__title')).toHaveText('Schedule')
    await window.locator('.n-page-header__back').click()
    await expect(window.getByTestId('week-view')).toBeVisible()

    await window.getByRole('button', { name: 'month', exact: true }).click()
    const monthCard = window
      .getByTestId('month-view')
      .getByRole('button', { name: /周视图回归/ })
    await monthCard.click()
    await expect(window.locator('.n-page-header__title')).toHaveText('Schedule')
    await window.locator('.n-page-header__back').click()
    await expect(window.getByTestId('month-view')).toBeVisible()
  } finally {
    await closeSchedule(launched)
  }
})
