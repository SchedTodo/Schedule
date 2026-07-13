import { describe, expect, it } from 'vitest'

import {
  CreateScheduleInputSchema,
  ScheduleDtoSchema
} from '../../src/contracts/schedule.contract'

describe('CreateScheduleInputSchema', () => {
  it('accepts a valid schedule creation command', () => {
    const result = CreateScheduleInputSchema.safeParse({
      title: 'Weekly review',
      recurrenceCode: '2026/7/13 10:00-11:00 weekly;',
      exclusionCode: '',
      comment: ''
    })

    expect(result.success).toBe(true)
  })

  it('rejects an empty schedule title', () => {
    const result = CreateScheduleInputSchema.safeParse({
      title: '   ',
      recurrenceCode: '2026/7/13 10:00-11:00 weekly;',
      exclusionCode: '',
      comment: ''
    })

    expect(result.success).toBe(false)
  })

  it('rejects unknown input fields', () => {
    const result = CreateScheduleInputSchema.safeParse({
      title: 'Weekly review',
      recurrenceCode: '2026/7/13 10:00-11:00 weekly;',
      exclusionCode: '',
      comment: '',
      version: 99
    })

    expect(result.success).toBe(false)
  })

  it('rejects exclusions when there is no recurrence rule', () => {
    expect(CreateScheduleInputSchema.safeParse({
      title: 'Todo',
      recurrenceCode: '',
      exclusionCode: '2026/7/13 10:00 UTC;',
      comment: ''
    }).success).toBe(false)
  })
})

describe('ScheduleDtoSchema', () => {
  it('rejects malformed platform results', () => {
    const result = ScheduleDtoSchema.safeParse({
      id: '018f6f50-4eb0-7b90-a612-2d37b4fd4000',
      kind: 'event',
      title: 'Weekly review',
      recurrenceCode: '2026/7/13 10:00-11:00 weekly;',
      exclusionCode: '',
      comment: '',
      starred: false,
      createdAt: 'not-an-instant',
      updatedAt: '2026-07-11T03:00:00Z'
    })

    expect(result.success).toBe(false)
  })
})
