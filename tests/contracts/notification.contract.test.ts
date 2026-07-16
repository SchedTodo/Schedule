import { describe, expect, it } from 'vitest'

import { NotificationInputSchema } from '../../src/contracts/notification.contract'

describe('notification contract', () => {
  it('accepts a bounded title and body', () => {
    expect(NotificationInputSchema.parse({ title: 'Take a break', body: 'Small Break' }))
      .toEqual({ title: 'Take a break', body: 'Small Break' })
  })

  it.each([
    {},
    { title: '', body: 'Small Break' },
    { title: 'Focus', body: '', extra: true },
    { title: 'x'.repeat(201), body: 'Focus 1' },
    { title: 'Focus', body: 'x'.repeat(1001) }
  ])('rejects malformed input %#', (input) => {
    expect(NotificationInputSchema.safeParse(input).success).toBe(false)
  })
})
