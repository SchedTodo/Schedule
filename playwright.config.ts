import { defineConfig } from '@playwright/test'

export default defineConfig({
  fullyParallel: false,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  retries: 0,
  use: {
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    viewport: { width: 1440, height: 900 },
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  }
})
