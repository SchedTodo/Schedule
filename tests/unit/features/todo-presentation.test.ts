import { describe, expect, it } from 'vitest'

import { Temporal } from '../../../src/domain/shared/temporal'
import {
  formatTodoDeadline,
  todoTone
} from '../../../src/features/schedule/todo-presentation'

const now = Temporal.Instant.from('2026-07-13T04:00:00Z')

describe('Todo presentation', () => {
  it.each([
    ['2026-07-13T03:59:00Z', false, 'expired'],
    ['2026-07-13T15:30:00Z', false, 'today'],
    ['2026-07-14T04:00:00Z', false, 'tomorrow'],
    ['2026-07-15T04:00:00Z', false, 'future'],
    ['2026-07-13T15:30:00Z', true, 'done'],
    ['2026-07-13T03:59:00Z', true, 'expired']
  ] as const)('classifies %s with done=%s as %s', (end, done, expected) => {
    expect(todoTone(end, done, 'Asia/Shanghai', now)).toBe(expected)
  })

  it('formats the legacy deadline without seconds or locale punctuation', () => {
    expect(formatTodoDeadline('2026-07-13T15:30:00Z', 'Asia/Shanghai')).toBe('07-13 23:30')
  })
})
