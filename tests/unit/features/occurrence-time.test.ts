import { describe, expect, it } from 'vitest'

import { occurrenceWallTime } from '../../../src/features/schedule/occurrence-time'

describe('occurrenceWallTime', () => {
  it('converts one UTC instant into the selected wall-clock time', () => {
    expect(occurrenceWallTime('2026-07-13T23:30:00Z', 'UTC')).toEqual({
      date: '2026-07-13', hour: 23, minute: 30
    })
    expect(occurrenceWallTime('2026-07-13T23:30:00Z', 'Asia/Shanghai')).toEqual({
      date: '2026-07-14', hour: 7, minute: 30
    })
  })
})
