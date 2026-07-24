import { defineConfig } from '@playwright/test'

import base from './playwright.config'

export default defineConfig({
  ...base,
  testDir: './tests/e2e',
  testIgnore: ['web/**']
})
