export type FocusStage = 'focus' | 'smallBreak' | 'bigBreak'
export type FocusNumber = 1 | 2 | 3 | 4

export interface FocusCycleDurations {
  readonly focusMs: number
  readonly smallBreakMs: number
  readonly bigBreakMs: number
}

export interface FocusCycleSnapshot {
  readonly stage: FocusStage
  readonly focusNumber: FocusNumber
  readonly running: boolean
  readonly remainingMs: number
  readonly cumulativeFocusMs: number
  readonly progressPercent: number
}

export interface FocusCycleTransition {
  readonly stage: FocusStage
  readonly focusNumber: FocusNumber
  readonly atMs: number
}

const stages: ReadonlyArray<{ stage: FocusStage; focusNumber: FocusNumber }> = [
  { stage: 'focus', focusNumber: 1 },
  { stage: 'smallBreak', focusNumber: 1 },
  { stage: 'focus', focusNumber: 2 },
  { stage: 'smallBreak', focusNumber: 2 },
  { stage: 'focus', focusNumber: 3 },
  { stage: 'smallBreak', focusNumber: 3 },
  { stage: 'focus', focusNumber: 4 },
  { stage: 'bigBreak', focusNumber: 4 }
]

export class FocusCycle {
  #index = 0
  #running = false
  #remainingMs: number
  #cumulativeFocusMs = 0
  #lastMs: number | undefined

  constructor(
    private readonly durations: FocusCycleDurations,
    private readonly now: () => number
  ) {
    this.#remainingMs = this.durationFor('focus')
  }

  start(): void {
    if (this.#running) return
    this.#running = true
    this.#lastMs = this.now()
  }

  pause(): FocusCycleTransition[] {
    const transitions = this.tick()
    this.#running = false
    this.#lastMs = undefined
    return transitions
  }

  tick(): FocusCycleTransition[] {
    if (!this.#running || this.#lastMs === undefined) return []
    const current = this.now()
    let elapsed = Math.max(0, current - this.#lastMs)
    let cursor = this.#lastMs
    const transitions: FocusCycleTransition[] = []
    while (elapsed >= this.#remainingMs) {
      const boundary = cursor + this.#remainingMs
      if (stages[this.#index]!.stage === 'focus') this.#cumulativeFocusMs += this.#remainingMs
      elapsed -= this.#remainingMs
      cursor = boundary
      this.#index = (this.#index + 1) % stages.length
      this.#remainingMs = this.durationFor(stages[this.#index]!.stage)
      transitions.push({ ...stages[this.#index]!, atMs: boundary })
    }
    if (stages[this.#index]!.stage === 'focus') this.#cumulativeFocusMs += elapsed
    this.#remainingMs -= elapsed
    this.#lastMs = current
    return transitions
  }

  snapshot(): FocusCycleSnapshot {
    const current = stages[this.#index]!
    const duration = this.durationFor(current.stage)
    return {
      ...current,
      running: this.#running,
      remainingMs: this.#remainingMs,
      cumulativeFocusMs: this.#cumulativeFocusMs,
      progressPercent: Math.round((1 - this.#remainingMs / duration) * 100)
    }
  }

  private durationFor(stage: FocusStage): number {
    if (stage === 'focus') return this.durations.focusMs
    if (stage === 'smallBreak') return this.durations.smallBreakMs
    return this.durations.bigBreakMs
  }
}
