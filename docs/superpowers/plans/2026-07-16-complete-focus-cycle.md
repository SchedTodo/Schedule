# Complete Focus Cycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the four-Focus Pomodoro loop with automatic breaks, pause/resume, Focus-only elapsed time and records, and host-routed stage notifications.

**Architecture:** A pure timestamp-driven `FocusCycle` owns stage transitions and elapsed-time accounting. A `FocusSession` coordinates Todo-bound contiguous Focus intervals and callback-based record/notification effects, while the Vue page only loads data, drives refreshes, and renders snapshots. A validated notification capability is added vertically through the browser gateway, host gateway, preload/IPC, and Electron main-process adapter.

**Tech Stack:** TypeScript 6, Vue 3, Vue Router, Naive UI, Zod, Vitest fake timers, Electron 43, Node.js 24 LTS, pnpm 11.11.0.

## Global Constraints

- `release/1.2.0` is immutable; all work remains on `main`.
- Keep `src` browser-runnable and platform-independent; Electron-only code stays in `src-electron`.
- Use the existing `PlatformGateway` for records and notifications; Vue must not import host APIs.
- Use configured `focusMinutes`, `smallBreakMinutes`, and `bigBreakMinutes`.
- Save only real contiguous Focus intervals strictly longer than 60,000 ms; Break and pause time never enter records.
- Preserve the fixed sequence of four Focus stages, three Small Breaks, then one Big Break.
- Do not add TanStack Query or new dependencies.
- Follow RED-GREEN TDD and use Conventional Commit types with concise Chinese subjects.

---

## File Map

- Create `src/contracts/notification.contract.ts`: validated renderer-to-host notification input.
- Modify `src/contracts/platform.contract.ts`: add the notification gateway capability.
- Modify `src/platform/browser/in-memory-gateway.ts`: browser-safe notification implementation.
- Modify `src/platform/host/host-api.ts`: validated preload surface method.
- Modify `src/platform/host/host-gateway.ts`: host API to platform gateway mapping.
- Modify `src-electron/ipc/schedule-ipc.ts`: notification IPC channel and contract.
- Modify `src-electron/preload/schedule-api.ts`: named preload notification method.
- Modify `src-electron/main/ipc/register-handlers.ts`: validated notification handler.
- Modify `src-electron/adapters/electron-notifier.ts`: generic title/body notification method.
- Modify `src-electron/main/index.ts`: provide the notification gateway.
- Modify `tests/contracts/host-api.test.ts`: host notification mapping coverage.
- Modify `tests/integration/ipc/schedule-ipc.test.ts`: notification validation and round trip.
- Create `tests/contracts/notification.contract.test.ts`: strict input contract coverage.
- Create `src/features/concentrate/focus-cycle.ts`: pure timestamp-driven stage state machine.
- Create `tests/unit/features/focus-cycle.test.ts`: stage, pause/resume, and elapsed-time tests.
- Create `src/features/concentrate/focus-session.ts`: Todo interval and side-effect coordination.
- Create `tests/unit/features/focus-session.test.ts`: record and notification behavior tests.
- Modify `src/pages/concentrate/[timeId].vue`: simple state-machine-driven page.
- Create `tests/unit/features/concentrate-page.test.ts`: page integration with fake timers.

---

### Task 1: Add the validated platform notification port

**Files:**
- Create: `src/contracts/notification.contract.ts`
- Create: `tests/contracts/notification.contract.test.ts`
- Modify: `src/contracts/platform.contract.ts`
- Modify: `src/platform/browser/in-memory-gateway.ts`
- Modify: `src/platform/host/host-api.ts`
- Modify: `src/platform/host/host-gateway.ts`
- Modify: `src-electron/ipc/schedule-ipc.ts`
- Modify: `src-electron/preload/schedule-api.ts`
- Modify: `src-electron/main/ipc/register-handlers.ts`
- Modify: `src-electron/adapters/electron-notifier.ts`
- Modify: `src-electron/main/index.ts`
- Modify: `tests/contracts/host-api.test.ts`
- Modify: `tests/integration/ipc/schedule-ipc.test.ts`

**Interfaces:**
- Produces: `NotificationInput`, `NotificationInputSchema`, and `PlatformGateway.notifications.show(input): Promise<AppResult<void>>`.
- Consumes: existing `AppResult`, preload invocation, IPC validation, and Electron `Notification`.

- [ ] **Step 1: Write failing contract and boundary tests**

Create `tests/contracts/notification.contract.test.ts`:

```ts
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
```

Extend `tests/contracts/host-api.test.ts` so the complete host object includes `showNotification`, calls `gateway.notifications.show({ title: 'Focus', body: 'Focus 2' })`, and asserts the named method received that object.

Extend the `createHarness` gateway in `tests/integration/ipc/schedule-ipc.test.ts` with:

```ts
notifications: {
  show: gateway.notifications?.show ?? vi.fn(async () => ({ ok: true as const, value: undefined }))
}
```

and add:

```ts
it('validates and round trips notification requests', async () => {
  const show = vi.fn(async () => ({ ok: true as const, value: undefined }))
  const { api, handlers } = createHarness({
    schedules: { create: vi.fn(), findById: vi.fn(), list: vi.fn() },
    notifications: { show }
  })

  await expect(api.showNotification({ title: 'Focus', body: 'Focus 2' }))
    .resolves.toEqual({ ok: true, value: undefined })
  await expect(handlers.get('notification:show')?.({}, { title: '', body: 'Focus 2' }))
    .resolves.toMatchObject({ ok: false, error: { code: 'VALIDATION_FAILED' } })
  expect(show).toHaveBeenCalledWith({ title: 'Focus', body: 'Focus 2' })
})
```

Update the harness input type with `notifications?: Partial<PlatformGateway['notifications']>`.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/contracts/notification.contract.test.ts tests/contracts/host-api.test.ts tests/integration/ipc/schedule-ipc.test.ts
```

Expected: FAIL because `notification.contract.ts`, `PlatformGateway.notifications`, and `showNotification` do not exist.

- [ ] **Step 3: Implement the notification contract and gateway surface**

Create `src/contracts/notification.contract.ts`:

```ts
import { z } from 'zod'

export const NotificationInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().max(1000)
}).strict()

export type NotificationInput = z.infer<typeof NotificationInputSchema>
```

Add to `PlatformGateway` in `src/contracts/platform.contract.ts`:

```ts
readonly notifications: {
  show(input: NotificationInput): Promise<AppResult<void>>
}
```

Import `NotificationInput` from `notification.contract.ts`. In `createInMemoryGateway`, add a browser-safe implementation that validates input and returns either the existing validation error or `{ ok: true, value: undefined }`:

```ts
notifications: {
  async show(input) {
    const parsed = NotificationInputSchema.safeParse(input)
    return parsed.success
      ? { ok: true, value: undefined }
      : { ok: false, error: validationError }
  }
}
```

In `src/platform/host/host-api.ts`, add `showNotification(input: NotificationInput): Promise<AppResult<void>>` to the interface and `HostScheduleApiSchema`. In `src/platform/host/host-gateway.ts`, add:

```ts
notifications: {
  show: (input) => api.showNotification(input)
}
```

- [ ] **Step 4: Implement preload and IPC forwarding**

In `src-electron/ipc/schedule-ipc.ts`, add `showNotification: 'notification:show'` and:

```ts
[scheduleIpcChannels.showNotification]: {
  input: NotificationInputSchema,
  output: appResultSchema(z.void())
}
```

In `src-electron/preload/schedule-api.ts`, add the typed `showNotification` method and implement it with the same output-parse pattern as `createRecord`.

In `registerScheduleIpcHandlers`, register:

```ts
const notificationContract = scheduleIpcContracts[scheduleIpcChannels.showNotification]
ipcMain.handle(scheduleIpcChannels.showNotification, (_event, input) => execute(
  input,
  (value) => notificationContract.input.parse(value),
  (value) => gateway.notifications.show(value),
  (value) => notificationContract.output.parse(value)
))
```

- [ ] **Step 5: Implement the Electron notification adapter**

Add to `ElectronNotifier`:

```ts
notifyMessage(input: NotificationInput): void {
  new Notification(input).show()
}
```

In `src-electron/main/index.ts`, provide:

```ts
notifications: {
  async show(input) {
    notifier.notifyMessage(input)
    return { ok: true, value: undefined }
  }
}
```

Keep the existing alarm `notify(alarm)` method unchanged.

- [ ] **Step 6: Run focused tests and type checks for GREEN**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/contracts/notification.contract.test.ts tests/contracts/host-api.test.ts tests/integration/ipc/schedule-ipc.test.ts
.\node_modules\.bin\vue-tsc.cmd --noEmit -p tsconfig.app.json
.\node_modules\.bin\tsc.cmd --noEmit -p tsconfig.electron.json
```

Expected: all commands PASS with no TypeScript diagnostics.

- [ ] **Step 7: Commit the notification vertical slice**

```powershell
git add src/contracts/notification.contract.ts src/contracts/platform.contract.ts src/platform/browser/in-memory-gateway.ts src/platform/host/host-api.ts src/platform/host/host-gateway.ts src-electron/ipc/schedule-ipc.ts src-electron/preload/schedule-api.ts src-electron/main/ipc/register-handlers.ts src-electron/adapters/electron-notifier.ts src-electron/main/index.ts tests/contracts/notification.contract.test.ts tests/contracts/host-api.test.ts tests/integration/ipc/schedule-ipc.test.ts
git commit -m "feat(focus): 增加平台阶段通知端口"
```

---

### Task 2: Build the timestamp-driven Focus cycle

**Files:**
- Create: `src/features/concentrate/focus-cycle.ts`
- Create: `tests/unit/features/focus-cycle.test.ts`

**Interfaces:**
- Produces: `FocusCycle`, `FocusCycleDurations`, `FocusCycleSnapshot`, `FocusCycleTransition`, and `FocusStage`.
- Consumes: an injected `() => number` epoch-millisecond clock.

- [ ] **Step 1: Write the failing sequence and pause/resume tests**

Create `tests/unit/features/focus-cycle.test.ts` with a mutable fixed clock and assertions against this public API:

```ts
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
```

- [ ] **Step 2: Run the state-machine test and verify RED**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/unit/features/focus-cycle.test.ts
```

Expected: FAIL because `focus-cycle.ts` does not exist.

- [ ] **Step 3: Implement the minimal state machine**

Create `src/features/concentrate/focus-cycle.ts` with:

```ts
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
```

Keep constructor inputs internal and positive because values originate from the validated positive settings contract; do not add duplicate configuration validation.

- [ ] **Step 4: Run the state-machine test and verify GREEN**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/unit/features/focus-cycle.test.ts
```

Expected: PASS (4 tests).

- [ ] **Step 5: Commit the pure Focus cycle**

```powershell
git add src/features/concentrate/focus-cycle.ts tests/unit/features/focus-cycle.test.ts
git commit -m "feat(focus): 增加四阶段专注循环状态机"
```

---

### Task 3: Coordinate Todo records and stage notifications

**Files:**
- Create: `src/features/concentrate/focus-session.ts`
- Create: `tests/unit/features/focus-session.test.ts`

**Interfaces:**
- Consumes: `FocusCycle`, `NotificationInput`, `CreateConcentrationRecordInput`, a clock, and async notification/record callbacks.
- Produces: `FocusSession` with `start()`, `pause()`, `tick()`, `selectTodo(todo)`, `dispose()`, and `snapshot()`.

- [ ] **Step 1: Write failing Focus-session tests**

Create `tests/unit/features/focus-session.test.ts`. Use a mutable clock initialized to `Date.parse('2026-07-16T00:00:00.000Z')`. The notification test uses `{ focusMs: 1_000, smallBreakMs: 500, bigBreakMs: 750 }`; every record test creates a fresh session with `{ focusMs: 120_000, smallBreakMs: 30_000, bigBreakMs: 60_000 }`. Cover these exact assertions:

```ts
it('notifies for every automatically started stage', () => {
  session.start()
  advance(1_000); session.tick()
  advance(500); session.tick()
  expect(notify).toHaveBeenNthCalledWith(1, { title: 'Take a break', body: 'Small Break' })
  expect(notify).toHaveBeenNthCalledWith(2, { title: 'Time to focus', body: 'Focus 2 of 4' })
})

it('saves a qualifying Focus interval to the outgoing Todo on selection change', async () => {
  await session.selectTodo({ scheduleId: firstScheduleId })
  session.start()
  advance(60_001); session.tick()
  await session.selectTodo({ scheduleId: secondScheduleId })
  expect(saveRecord).toHaveBeenCalledWith({
    scheduleId: firstScheduleId,
    start: '2026-07-16T00:00:00.000Z',
    end: '2026-07-16T00:01:00.001Z'
  })
})

it.each([59_999, 60_000])('discards a %i ms Focus interval', async (milliseconds) => {
  await session.selectTodo({ scheduleId: firstScheduleId })
  session.start(); advance(milliseconds); session.tick()
  await session.dispose()
  expect(saveRecord).not.toHaveBeenCalled()
})

it('does not merge paused time into a record', async () => {
  await session.selectTodo({ scheduleId: firstScheduleId })
  session.start(); advance(60_001); session.pause()
  advance(30_000); session.start(); advance(39_999); session.tick()
  await session.dispose()
  expect(saveRecord).toHaveBeenCalledOnce()
  expect(saveRecord.mock.calls[0]![0]).toMatchObject({
    start: '2026-07-16T00:00:00.000Z',
    end: '2026-07-16T00:01:00.001Z'
  })
})
```

Add this stage-boundary test with `{ focusMs: 60_001, smallBreakMs: 60_000, bigBreakMs: 60_000 }`:

```ts
it('closes Focus at the transition boundary and never records Break time', async () => {
  await session.selectTodo({ scheduleId: firstScheduleId })
  session.start(); advance(90_001); session.tick()
  await session.dispose()
  expect(saveRecord).toHaveBeenCalledOnce()
  expect(saveRecord).toHaveBeenCalledWith({
    scheduleId: firstScheduleId,
    start: '2026-07-16T00:00:00.000Z',
    end: '2026-07-16T00:01:00.001Z'
  })
})
```

- [ ] **Step 2: Run the Focus-session test and verify RED**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/unit/features/focus-session.test.ts
```

Expected: FAIL because `focus-session.ts` does not exist.

- [ ] **Step 3: Implement interval tracking and effect dispatch**

Create `src/features/concentrate/focus-session.ts` with this implementation:

```ts
import type { CreateConcentrationRecordInput } from '../../contracts/record.contract'
import type { NotificationInput } from '../../contracts/notification.contract'
import {
  FocusCycle,
  type FocusCycleDurations,
  type FocusCycleSnapshot,
  type FocusCycleTransition
} from './focus-cycle'

interface SelectedTodo { readonly scheduleId: string }
interface FocusInterval { readonly scheduleId: string; readonly startMs: number; readonly endMs: number }
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
```

This removes intervals before awaiting their effects, so repeated disposal cannot duplicate records. Notification and persistence rejections are swallowed at this orchestration boundary because the design makes them non-fatal and defines no retry policy.

- [ ] **Step 4: Run session and state-machine tests for GREEN**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/unit/features/focus-cycle.test.ts tests/unit/features/focus-session.test.ts
```

Expected: PASS with deterministic timestamps and no unhandled promise rejections.

- [ ] **Step 5: Commit Focus-session coordination**

```powershell
git add src/features/concentrate/focus-session.ts tests/unit/features/focus-session.test.ts
git commit -m "feat(focus): 按待办保存有效专注片段"
```

---

### Task 4: Replace the single countdown with the complete page flow

**Files:**
- Modify: `src/pages/concentrate/[timeId].vue`
- Create: `tests/unit/features/concentrate-page.test.ts`

**Interfaces:**
- Consumes: `FocusSession`, configured settings, Todo occurrences, `PlatformGateway.records.create`, and `PlatformGateway.notifications.show`.
- Produces: the simple complete-cycle UI and lifecycle wiring.

- [ ] **Step 1: Write the failing page integration test**

Create `tests/unit/features/concentrate-page.test.ts` with `vi.useFakeTimers()`, `vi.setSystemTime('2026-07-16T00:00:00.000Z')`, a memory router route `/concentrate/:timeId`, and a gateway whose settings are updated to one-minute Focus and Break durations. Mount the page and assert:

```ts
expect(wrapper.text()).toContain('Focus 1 of 4')
expect(wrapper.text()).toContain('01:00')
expect(wrapper.text()).toContain('Focused 00:00:00')

await wrapper.get('[data-testid="focus-toggle"]').trigger('click')
await vi.advanceTimersByTimeAsync(60_000)
expect(wrapper.text()).toContain('Small Break')
expect(wrapper.text()).toContain('Focused 00:01:00')
expect(platform.notifications.show).toHaveBeenCalledWith({
  title: 'Take a break', body: 'Small Break'
})

await wrapper.get('[data-testid="focus-toggle"]').trigger('click')
await vi.advanceTimersByTimeAsync(30_000)
expect(wrapper.text()).toContain('00:30')
await wrapper.get('[data-testid="focus-toggle"]').trigger('click')
await vi.advanceTimersByTimeAsync(10_000)
expect(wrapper.text()).toContain('00:30')
```

Add a second test with two Todo options and `focusMinutes: 2`: run Focus for 60,001 ms, change the `NSelect` value, await pending promises, and assert `records.create` used the outgoing Todo's `scheduleId`. Add an unmount test with the same two-minute Focus duration and assertion. Restore real timers in `afterEach`.

- [ ] **Step 2: Run the page test and verify RED**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/unit/features/concentrate-page.test.ts
```

Expected: FAIL because the current page has no stage label, cumulative Focus display, notification call, or correct record segmentation.

- [ ] **Step 3: Integrate `FocusSession` into the page**

Replace page-local duration/session/timer policy with:

```ts
const snapshot = ref<FocusCycleSnapshot>()
let session: FocusSession | undefined
let timer: ReturnType<typeof setInterval> | undefined

function refresh() {
  session?.tick()
  snapshot.value = session?.snapshot()
}

function toggle() {
  if (!session) return
  if (session.snapshot().running) session.pause()
  else session.start()
  refresh()
}

async function selectTodo(id: string) {
  const todo = todos.value.find((value) => value.id === id)
  await session?.selectTodo(todo && { scheduleId: todo.scheduleId })
  selectedId.value = id
  refresh()
}
```

Import `defaultSettings` from `settings.contract.ts`. After the settings request returns, set `const values = settingsResult.ok ? settingsResult.value : defaultSettings`; use `values` both for the Todo query's time-zone fields and for construction:

```ts
session = new FocusSession({
  focusMs: values.focusMinutes * 60_000,
  smallBreakMs: values.smallBreakMinutes * 60_000,
  bigBreakMs: values.bigBreakMinutes * 60_000
}, {
  now: () => Date.now(),
  notify: (input) => platform.notifications.show(input),
  saveRecord: (input) => platform.records.create(input)
})
await session.selectTodo(selected.value && { scheduleId: selected.value.scheduleId })
snapshot.value = session.snapshot()
timer = setInterval(refresh, 250)
```

On unmount, clear the refresh interval and call `void session?.dispose()`.

- [ ] **Step 4: Render the minimal complete-cycle UI**

Keep `NPageHeader`, `NCard`, `NSelect`, `NProgress`, and `NButton`. Render:

```vue
<p class="stage-label">
  {{ snapshot?.stage === 'focus' ? `Focus ${snapshot.focusNumber} of 4` :
    snapshot?.stage === 'smallBreak' ? 'Small Break' : 'Big Break' }}
</p>
<NProgress type="circle" :percentage="snapshot?.progressPercent ?? 0">
  {{ formatCountdown(snapshot?.remainingMs ?? 0) }}
</NProgress>
<p class="focused-total">Focused {{ formatTotal(snapshot?.cumulativeFocusMs ?? 0) }}</p>
<NButton data-testid="focus-toggle" @click="toggle">
  {{ snapshot?.running ? 'Pause' : snapshot?.cumulativeFocusMs === 0 ? 'Start' : 'Resume' }}
</NButton>
```

Implement `formatCountdown(milliseconds)` as `MM:SS` using the ceiling of remaining whole seconds, and `formatTotal(milliseconds)` as zero-padded `HH:MM:SS` using the floor of elapsed whole seconds. Use the existing dark page styling and centered card; make no watch-art or unrelated layout changes.

- [ ] **Step 5: Run focused tests and fix only integration defects**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/unit/features/focus-cycle.test.ts tests/unit/features/focus-session.test.ts tests/unit/features/concentrate-page.test.ts tests/contracts/notification.contract.test.ts tests/contracts/host-api.test.ts tests/integration/ipc/schedule-ipc.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit the page flow**

```powershell
git add src/pages/concentrate/[timeId].vue tests/unit/features/concentrate-page.test.ts
git commit -m "feat(focus): 恢复完整专注循环界面"
```

---

### Task 5: Run project verification

**Files:**
- Modify only files already in scope if verification exposes a directly related defect.

**Interfaces:**
- Consumes: the complete notification, state-machine, session, and page implementation.
- Produces: verification evidence for the Web and Electron boundaries.

- [ ] **Step 1: Run lint**

```powershell
.\node_modules\.bin\eslint.cmd .
```

Expected: PASS with zero errors.

- [ ] **Step 2: Run Web and Electron type checks**

```powershell
.\node_modules\.bin\vue-tsc.cmd --noEmit -p tsconfig.app.json
.\node_modules\.bin\tsc.cmd --noEmit -p tsconfig.electron.json
```

Expected: both PASS with no diagnostics.

- [ ] **Step 3: Run the required unit, contract, and parser suites**

```powershell
.\node_modules\.bin\vitest.cmd run tests/unit tests/contracts tests/parser
```

Expected: PASS.

- [ ] **Step 4: Run the focused IPC integration suite**

```powershell
.\node_modules\.bin\vitest.cmd run tests/integration/ipc/schedule-ipc.test.ts
```

Expected: PASS.

- [ ] **Step 5: Build Web and Electron targets**

```powershell
.\node_modules\.bin\vite.cmd build
.\node_modules\.bin\vite.cmd build --config vite.electron-main.config.ts
.\node_modules\.bin\vite.cmd build --config vite.electron-preload.config.ts
```

Expected: all builds PASS.

- [ ] **Step 6: Inspect the final diff**

```powershell
git status --short
git diff --check HEAD~4..HEAD
git diff --stat HEAD~4..HEAD
```

Expected: only GAP-01 files are present, `diff --check` is silent, and no generated build output is tracked.
