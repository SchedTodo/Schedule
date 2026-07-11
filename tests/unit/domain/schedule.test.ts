import { describe, expect, it } from 'vitest'

import { Schedule } from '../../../src/domain/schedule/schedule'
import { FixedClock } from '../../../src/domain/shared/clock'
import type { IdGenerator } from '../../../src/domain/shared/id-generator'

const fixedIdGenerator: IdGenerator = {
  next: () => '018f6f50-4eb0-7b90-a612-2d37b4fd4000'
}

describe('Schedule.create', () => {
  it('creates an immutable schedule with injected identity and time', () => {
    const schedule = Schedule.create(
      {
        kind: 'event',
        title: 'Weekly review',
        recurrenceCode: '2026/7/13 10:00-11:00 weekly;',
        exclusionCode: '',
        comment: ''
      },
      {
        clock: new FixedClock('2026-07-11T02:00:00Z'),
        idGenerator: fixedIdGenerator
      }
    )

    expect(schedule.id).toBe('018f6f50-4eb0-7b90-a612-2d37b4fd4000')
    expect(schedule.title).toBe('Weekly review')
    expect(schedule.createdAt.toString()).toBe('2026-07-11T02:00:00Z')
    expect(schedule.updatedAt).toBe(schedule.createdAt)
    expect(Object.isFrozen(schedule)).toBe(true)
  })

  it('rejects an empty title', () => {
    expect(() =>
      Schedule.create(
        {
          kind: 'todo',
          title: '   ',
          recurrenceCode: '',
          exclusionCode: '',
          comment: ''
        },
        {
          clock: new FixedClock('2026-07-11T02:00:00Z'),
          idGenerator: fixedIdGenerator
        }
      )
    ).toThrow('SCHEDULE_TITLE_EMPTY')
  })
})
