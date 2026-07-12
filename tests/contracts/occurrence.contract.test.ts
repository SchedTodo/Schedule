import { describe, expect, it } from 'vitest'

import {
  OccurrenceRangeQuerySchema,
  ScheduleOccurrenceDtoSchema
} from '../../src/contracts/occurrence.contract'

const baseOccurrence = {
  id: '10000000-0000-4000-8000-000000000001',
  scheduleId: '10000000-0000-4000-8000-000000000002',
  kind: 'event' as const,
  title: 'Weekly review',
  excluded: false,
  start: '2026-07-13T01:00:00Z',
  end: '2026-07-13T02:00:00Z',
  startMark: '11' as const,
  endMark: '11' as const,
  comment: '',
  done: false
}

describe('schedule occurrence contracts', () => {
  it('accepts an event occurrence with a concrete start and end', () => {
    expect(ScheduleOccurrenceDtoSchema.safeParse(baseOccurrence).success).toBe(true)
  })

  it('accepts a Todo occurrence without a start', () => {
    expect(ScheduleOccurrenceDtoSchema.safeParse({
      ...baseOccurrence,
      kind: 'todo',
      start: null
    }).success).toBe(true)
  })

  it('rejects unknown fields and invalid known-time marks', () => {
    expect(ScheduleOccurrenceDtoSchema.safeParse({
      ...baseOccurrence,
      unexpected: true
    }).success).toBe(false)
    expect(ScheduleOccurrenceDtoSchema.safeParse({
      ...baseOccurrence,
      startMark: '1?'
    }).success).toBe(false)
  })

  it('rejects an event whose end precedes its start', () => {
    expect(ScheduleOccurrenceDtoSchema.safeParse({
      ...baseOccurrence,
      end: '2026-07-13T00:59:59Z'
    }).success).toBe(false)
  })

  it('accepts a bounded occurrence range and rejects reversed bounds', () => {
    expect(OccurrenceRangeQuerySchema.safeParse({
      start: '2026-07-01T00:00:00Z',
      end: '2026-08-01T00:00:00Z'
    }).success).toBe(true)
    expect(OccurrenceRangeQuerySchema.safeParse({
      start: '2026-08-01T00:00:00Z',
      end: '2026-07-01T00:00:00Z'
    }).success).toBe(false)
  })
})
