import { describe, expect, it } from 'vitest'

import { FixedClock } from '../../../src/domain/shared/clock'

describe('FixedClock', () => {
  it('returns the configured instant deterministically', () => {
    const clock = new FixedClock('2026-07-11T02:00:00Z')

    expect(clock.now().toString()).toBe('2026-07-11T02:00:00Z')
    expect(clock.now()).toBe(clock.now())
  })
})
