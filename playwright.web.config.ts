import { defineConfig } from '@playwright/test'

import base from './playwright.config'

export default defineConfig({
  ...base,
  testDir: './tests/e2e/web',
  use: {
    ...base.use,
    baseURL: 'http://127.0.0.1:4173'
  },
  webServer: {
    command: 'pnpm exec vite preview --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false
  }
})
