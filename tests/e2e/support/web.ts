import type { Page } from '@playwright/test'

export interface ScheduleDraft {
  title: string
  recurrenceCode: string
  comment?: string
}

export async function createSchedule(page: Page, draft: ScheduleDraft): Promise<void> {
  await page.getByRole('button', { name: 'Add' }).click()
  await page.getByLabel('Name').fill(draft.title)
  await page.getByLabel('rTime').fill(draft.recurrenceCode)
  if (draft.comment !== undefined) await page.getByLabel('Comment').fill(draft.comment)
  await page.getByRole('button', { name: 'Confirm' }).click()
}
