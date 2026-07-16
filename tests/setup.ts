import { afterEach, beforeEach, vi } from 'vitest'

import { TEST_NOW } from './support/time'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(TEST_NOW)
})

afterEach(() => {
  vi.useRealTimers()
})
