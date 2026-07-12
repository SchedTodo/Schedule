import { describe, expect, it } from 'vitest'
import { CreateConcentrationRecordInputSchema } from '../../src/contracts/record.contract'

describe('concentration record contract', () => {
  it('accepts positive sessions and rejects reversed ranges', () => {
    const input = {
      scheduleId: '10000000-0000-4000-8000-000000000001',
      start: '2026-07-12T10:00:00Z', end: '2026-07-12T10:25:00Z'
    }
    expect(CreateConcentrationRecordInputSchema.safeParse(input).success).toBe(true)
    expect(CreateConcentrationRecordInputSchema.safeParse({ ...input, end: '2026-07-12T09:59:00Z' }).success).toBe(false)
  })
})
