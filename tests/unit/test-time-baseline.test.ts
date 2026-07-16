import { Temporal } from '@js-temporal/polyfill'
import { describe, expect, it } from 'vitest'

import { TEST_NOW } from '../support/time'

describe('test time baseline', () => {
  it('freezes Date and Temporal.Now at the shared instant', () => {
    expect(new Date().toISOString()).toBe(TEST_NOW)
    expect(Date.now()).toBe(Date.parse(TEST_NOW))
    expect(Temporal.Now.instant().epochMilliseconds).toBe(Date.parse(TEST_NOW))
  })
})
