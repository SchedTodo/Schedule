import { _electron as electron, expect, test } from '@playwright/test'

test('starts one isolated window from the standalone Web build', async () => {
  const application = await electron.launch({
    args: [
      '--disable-gpu',
      '--disable-gpu-compositing',
      '--disable-software-rasterizer',
      '.'
    ]
  })

  try {
    const window = await application.firstWindow()
    await expect(window.getByRole('link', { name: 'Home' })).toBeVisible()
    await expect(window.getByText('Guest')).toBeVisible()
    await expect(window.getByRole('button', { name: 'Add' })).toBeVisible()
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
