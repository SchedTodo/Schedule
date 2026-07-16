import { describe, expect, it } from 'vitest'

import { FocusCycle } from '../../../src/features/concentrate/focus-cycle'

function harness() {
  let now = 0
  const cycle = new FocusCycle(
    { focusMs: 4_000, smallBreakMs: 1_000, bigBreakMs: 2_000 },
    () => now
  )
  return { cycle, advance: (milliseconds: number) => { now += milliseconds } }
}

describe('FocusCycle', () => {
  it('runs four Focus stages with three Small Breaks and one Big Break', () => {
    const { cycle, advance } = harness()
    cycle.start()
    const stages = []
    for (const milliseconds of [4_000, 1_000, 4_000, 1_000, 4_000, 1_000, 4_000, 2_000]) {
      advance(milliseconds)
      stages.push(...cycle.tick().map(({ stage }) => stage))
    }
    expect(stages).toEqual([
      'smallBreak', 'focus', 'smallBreak', 'focus',
      'smallBreak', 'focus', 'bigBreak', 'focus'
    ])
    expect(cycle.snapshot()).toMatchObject({ stage: 'focus', focusNumber: 1, running: true })
  })

  it('reconciles delayed ticks across multiple boundaries', () => {
    const { cycle, advance } = harness()
    cycle.start()
    advance(9_500)
    expect(cycle.tick().map(({ stage }) => stage)).toEqual(['smallBreak', 'focus', 'smallBreak'])
    expect(cycle.snapshot()).toMatchObject({ stage: 'smallBreak', remainingMs: 500 })
  })

  it('freezes while paused and resumes from the same remainder', () => {
    const { cycle, advance } = harness()
    cycle.start()
    advance(1_500)
    cycle.pause()
    expect(cycle.snapshot()).toMatchObject({ running: false, remainingMs: 2_500, cumulativeFocusMs: 1_500 })
    advance(10_000)
    cycle.tick()
    expect(cycle.snapshot()).toMatchObject({ remainingMs: 2_500, cumulativeFocusMs: 1_500 })
    cycle.start()
    advance(500)
    cycle.tick()
    expect(cycle.snapshot()).toMatchObject({ remainingMs: 2_000, cumulativeFocusMs: 2_000 })
  })

  it('excludes Break time from cumulative Focus time', () => {
    const { cycle, advance } = harness()
    cycle.start()
    advance(5_000)
    cycle.tick()
    expect(cycle.snapshot().cumulativeFocusMs).toBe(4_000)
  })
})
