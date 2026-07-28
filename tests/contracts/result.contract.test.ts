import { describe, expect, it } from 'vitest'

import { AppErrorDtoSchema } from '../../src/contracts/result'

describe('application error contract', () => {
  it('requires a stable localization key', () => {
    expect(AppErrorDtoSchema.safeParse({
      code: 'NOT_FOUND',
      messageKey: 'error.notFound',
      message: 'not found'
    }).success).toBe(true)
    expect(AppErrorDtoSchema.safeParse({
      code: 'NOT_FOUND',
      message: 'not found'
    }).success).toBe(false)
  })
})
