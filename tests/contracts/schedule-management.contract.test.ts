import { describe, expect, it } from 'vitest'

import {
  ScheduleDetailDtoSchema,
  ScheduleSearchQuerySchema,
  UpdateScheduleInputSchema
} from '../../src/contracts/schedule.contract'
import {
  ExcludeOccurrenceInputSchema,
  TodoOccurrenceQuerySchema,
  SetOccurrenceDoneInputSchema,
  UpdateOccurrenceCommentInputSchema
} from '../../src/contracts/occurrence.contract'

const id = '10000000-0000-4000-8000-000000000001'

describe('schedule management contracts', () => {
  it('represents deleted state in schedule details', () => {
    expect(ScheduleDetailDtoSchema.parse({
      id,
      kind: 'event',
      title: 'Review',
      recurrenceCode: '2026/7/13 10:00-11:00;',
      exclusionCode: '',
      comment: '',
      starred: false,
      deleted: false,
      createdAt: '2026-07-11T08:00:00Z',
      updatedAt: '2026-07-11T08:00:00Z'
    }).deleted).toBe(false)
  })

  it('accepts a strict schedule update', () => {
    expect(UpdateScheduleInputSchema.safeParse({
      id,
      title: 'Review',
      recurrenceCode: '2026/7/13 10:00-11:00;',
      exclusionCode: '',
      comment: ''
    }).success).toBe(true)
    expect(UpdateScheduleInputSchema.safeParse({
      id, title: 'Review', recurrenceCode: '', exclusionCode: '', comment: '', extra: true
    }).success).toBe(false)
    expect(UpdateScheduleInputSchema.safeParse({
      id, title: 'Review', recurrenceCode: '', exclusionCode: '2026/7/13 10:00 UTC;', comment: ''
    }).success).toBe(false)
  })

  it('validates database filters and paging', () => {
    const parsed = ScheduleSearchQuerySchema.parse({ page: 2, pageSize: 25, starred: true })
    expect(parsed).toMatchObject({ page: 2, pageSize: 25, starred: true, deleted: false })
    expect(ScheduleSearchQuerySchema.safeParse({ page: 0, pageSize: 201 }).success).toBe(false)
  })

  it('validates occurrence comment and exclusion inputs', () => {
    expect(UpdateOccurrenceCommentInputSchema.safeParse({ id, comment: 'Moved' }).success).toBe(true)
    expect(ExcludeOccurrenceInputSchema.safeParse({ id }).success).toBe(true)
    expect(ExcludeOccurrenceInputSchema.safeParse({ id: 'invalid' }).success).toBe(false)
  })

  it('validates logical-day Todo queries and completion updates', () => {
    expect(TodoOccurrenceQuerySchema.parse({
      now: '2026-07-12T02:00:00Z',
      timeZone: 'UTC'
    })).toMatchObject({
      timeZone: 'UTC',
      logicalDayStartHour: 0,
      logicalDayStartMinute: 0
    })
    expect(SetOccurrenceDoneInputSchema.safeParse({ id, done: true }).success).toBe(true)
  })
})
