import type { Page } from '@playwright/test'

export interface ScheduleDraft {
  title: string
  recurrenceCode: string
  comment?: string
}

export async function createSchedule(page: Page, draft: ScheduleDraft): Promise<void> {
  await page.getByRole('button', { name: '添加' }).click()
  await page.getByLabel('名称').fill(draft.title)
  await page.getByLabel('rTime').fill(draft.recurrenceCode)
  if (draft.comment !== undefined) await page.getByLabel('备注').fill(draft.comment)
  await page.getByRole('button', { name: '确认' }).click()
}
