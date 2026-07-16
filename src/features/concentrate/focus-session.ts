import type { NotificationInput } from '../../contracts/notification.contract'
import type { CreateConcentrationRecordInput } from '../../contracts/record.contract'
import {
  FocusCycle,
  type FocusCycleDurations,
  type FocusCycleSnapshot,
  type FocusCycleTransition
} from './focus-cycle'

interface SelectedTodo {
  readonly scheduleId: string
}

interface FocusInterval {
  readonly scheduleId: string
  readonly startMs: number
  readonly endMs: number
}

interface FocusSessionDependencies {
  readonly now: () => number
  readonly notify: (input: NotificationInput) => Promise<unknown>
  readonly saveRecord: (input: CreateConcentrationRecordInput) => Promise<unknown>
}

const minimumRecordMs = 60_000

function notificationFor(transition: FocusCycleTransition): NotificationInput {
  if (transition.stage === 'focus') {
    return { title: 'Time to focus', body: `Focus ${transition.focusNumber} of 4` }
  }
  return transition.stage === 'smallBreak'
    ? { title: 'Take a break', body: 'Small Break' }
    : { title: 'Take a break', body: 'Big Break' }
}

export class FocusSession {
  readonly #cycle: FocusCycle
  #selectedTodo: SelectedTodo | undefined
  #activeStartMs: number | undefined
  #intervals: FocusInterval[] = []

  constructor(
    durations: FocusCycleDurations,
    private readonly dependencies: FocusSessionDependencies
  ) {
    this.#cycle = new FocusCycle(durations, dependencies.now)
  }

  start(): void {
    if (this.#cycle.snapshot().running) return
    this.#cycle.start()
    if (this.#cycle.snapshot().stage === 'focus' && this.#selectedTodo) {
      this.#activeStartMs = this.dependencies.now()
    }
  }

  pause(): void {
    if (!this.#cycle.snapshot().running) return
    this.#processTransitions(this.#cycle.pause())
    this.#closeActive(this.dependencies.now())
  }

  tick(): void {
    this.#processTransitions(this.#cycle.tick())
  }

  snapshot(): FocusCycleSnapshot {
    return this.#cycle.snapshot()
  }

  async selectTodo(todo: SelectedTodo | undefined): Promise<void> {
    this.tick()
    const previousScheduleId = this.#selectedTodo?.scheduleId
    this.#closeActive(this.dependencies.now())
    if (previousScheduleId) await this.#flush(previousScheduleId)
    this.#selectedTodo = todo
    if (todo && this.#cycle.snapshot().running && this.#cycle.snapshot().stage === 'focus') {
      this.#activeStartMs = this.dependencies.now()
    }
  }

  async dispose(): Promise<void> {
    this.tick()
    this.#closeActive(this.dependencies.now())
    const scheduleIds = [...new Set(this.#intervals.map(({ scheduleId }) => scheduleId))]
    for (const scheduleId of scheduleIds) await this.#flush(scheduleId)
    this.#selectedTodo = undefined
  }

  #processTransitions(transitions: readonly FocusCycleTransition[]): void {
    for (const transition of transitions) {
      this.#closeActive(transition.atMs)
      void this.dependencies.notify(notificationFor(transition)).catch(() => undefined)
      if (transition.stage === 'focus' && this.#selectedTodo) {
        this.#activeStartMs = transition.atMs
      }
    }
  }

  #closeActive(endMs: number): void {
    if (this.#activeStartMs === undefined || !this.#selectedTodo) return
    if (endMs > this.#activeStartMs) {
      this.#intervals.push({
        scheduleId: this.#selectedTodo.scheduleId,
        startMs: this.#activeStartMs,
        endMs
      })
    }
    this.#activeStartMs = undefined
  }

  async #flush(scheduleId: string): Promise<void> {
    const selected = this.#intervals.filter((value) => value.scheduleId === scheduleId)
    this.#intervals = this.#intervals.filter((value) => value.scheduleId !== scheduleId)
    await Promise.all(selected
      .filter(({ startMs, endMs }) => endMs - startMs > minimumRecordMs)
      .map(({ startMs, endMs }) => this.dependencies.saveRecord({
        scheduleId,
        start: new Date(startMs).toISOString(),
        end: new Date(endMs).toISOString()
      }).catch(() => undefined)))
  }
}
