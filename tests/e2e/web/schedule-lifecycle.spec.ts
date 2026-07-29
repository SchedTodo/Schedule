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
  await page.getByRole('button', { name: '编辑' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('名称').fill('已编辑待办')
  await dialog.getByLabel('rTime').fill('2026/7/13 19:00')
  await dialog.getByRole('button', { name: '确认' }).click()
  await expect(page.getByText('已编辑待办', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: '删除' }).first().click()
  await page.getByRole('button', { name: '确认' }).click()
  await expect(page).toHaveURL(/#\/database$/)
  await expect(page.getByRole('row', { name: /已编辑待办.*true/ })).toBeVisible()
})

test('keeps an invalid schedule open with an inline parser error', async ({ page }) => {
  await createSchedule(page, {
    title: '无效日程',
    recurrenceCode: 'not a schedule expression'
  })

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByLabel('rTime')).toHaveText('not a schedule expression')
  await expect(dialog.locator('.cm-lintRange-error')).toBeVisible()
  await expect(page.locator('.n-notification')).toHaveCount(0)
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByText('无效日程', { exact: true })).toHaveCount(0)
})

test('accepts a grammar completion with the keyboard', async ({ page }) => {
  await page.getByRole('button', { name: '添加' }).click()
  const dialog = page.getByRole('dialog')
  const editor = dialog.getByLabel('rTime')
  const editorRoot = dialog.locator('.schedule-code-editor').first()
  const widths = await editorRoot.evaluate((element) => ({
    editor: element.getBoundingClientRect().width,
    container: element.parentElement?.getBoundingClientRect().width ?? 0
  }))
  expect(widths.editor).toBeCloseTo(widths.container, 0)

  await editor.fill('2026/7/13 10:00 ')
  await editor.pressSequentially('wee')
  await expect(page.locator('.cm-tooltip-autocomplete')).toBeVisible()
  await expect(page.locator('.cm-completionInfo')).toContainText('每周重复')
  await expect(page.locator('.cm-completionInfo')).toContainText('2026/7/13 10:00 weekly')
  await expect(editor).toHaveText('2026/7/13 10:00 wee')
  await editor.press('ArrowDown')
  await editor.press('Tab')
  await expect(editor).toHaveText('2026/7/13 10:00 weekly')

  await editor.press('Tab')
  await expect(dialog.getByLabel('exTime')).toBeFocused()

  await editor.fill('2026/7/13 10:00 ')
  await editor.pressSequentially('by')
  await expect(page.locator('.cm-tooltip-autocomplete')).toBeVisible()
  await editor.press('Enter')
  await editor.pressSequentially('x')
  await expect(editor).toHaveText('2026/7/13 10:00 by[x]')

  await editor.fill('')
  await editor.press('Alt+Enter')
  await expect(page.locator('.cm-tooltip-autocomplete')).toBeVisible()
})
