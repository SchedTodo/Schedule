import { _electron as electron, expect, test } from '@playwright/test'

test('starts one isolated window from the standalone Web build', async () => {
  const application = await electron.launch({ args: ['.'] })

  try {
    const window = await application.firstWindow()
    await expect(window.getByRole('heading', { name: 'Schedule' })).toBeVisible()
    expect(application.windows()).toHaveLength(1)
    await expect
      .poll(() => window.evaluate(() => typeof process))
      .toBe('undefined')
    await expect
      .poll(() =>
        window.evaluate(() => {
          const host = Reflect.get(window, 'scheduleHost') as Record<string, unknown> | undefined
          return host ? Object.keys(host).sort() : []
        })
      )
      .toEqual(['createSchedule', 'findScheduleById', 'listSchedules'])
  } finally {
    await application.close()
  }
})
