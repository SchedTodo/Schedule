# GAP-01 Complete Focus Cycle Design

**Date:** 2026-07-16

**Status:** Approved

## Goal

Restore the user-visible 1.2 Pomodoro sequence on the v2 concentrate page while keeping timing logic browser-runnable, sending notifications through a platform port, and persisting only qualifying Focus intervals through the existing concentration-record port.

## Scope

The page runs the durations from settings in this fixed repeating sequence:

1. Focus 1
2. Small Break
3. Focus 2
4. Small Break
5. Focus 3
6. Small Break
7. Focus 4
8. Big Break

After the user starts the timer, a completed stage advances automatically and the next stage starts immediately. Completing Big Break returns to Focus 1. Pause and resume preserve the current stage and remaining time.

The UI is intentionally simple. It shows the selected Todo, current stage, Focus number within the four-Focus cycle, remaining stage time, progress, cumulative Focus time, and one Start/Pause/Resume control. Reproducing the legacy watch artwork is outside this gap.

## Architecture

### Focus-session state machine

A focused TypeScript module under `src/features/concentrate` owns the timer behavior independently of Vue. It consumes the three configured durations and a clock returning the current epoch time. Its observable state contains the stage, Focus number, running state, remaining seconds, progress, and cumulative Focus milliseconds.

The state machine uses elapsed timestamps rather than assuming that every interval callback represents exactly one second. A UI refresh interval asks it to reconcile against the injected clock. Reconciliation may cross more than one stage when callbacks are delayed, and it emits one stage-transition event for every crossed boundary.

Only elapsed time while a Focus stage is running contributes to cumulative Focus time. Break time and paused time never contribute.

### Focus record intervals

The controller tracks real, contiguous Focus intervals for the selected Todo. An interval opens when a Focus stage begins or resumes and closes when the timer pauses, the Focus stage ends, the Todo changes, or the page unmounts. Break stages never open an interval.

Closed intervals are buffered with the Todo's `scheduleId`. On Todo change or page unmount, the controller flushes buffered intervals for the Todo being left through `platform.records.create`. Only an individual interval strictly longer than 60,000 milliseconds is saved. Shorter or exactly one-minute intervals are discarded because the requirement says “超过一分钟”. Each record retains its real start and end timestamps, so pauses and Break stages cannot inflate its displayed duration.

Changing Todo first reconciles the timer to the current clock, closes any active Focus interval for the old Todo, flushes the old Todo's buffer, then associates subsequent Focus time with the new Todo. The Pomodoro stage and countdown continue; selecting a Todo does not restart the cycle.

Unmount follows the same reconcile, close, and flush sequence, then clears the UI refresh interval. Persistence is asynchronous and best-effort during teardown, matching the existing page lifecycle constraint. A failed record result does not create a false in-memory success or change timer state.

## Platform notification port

`PlatformGateway` gains a notification capability with a narrow method for a Focus/Break transition message. The input is validated at the host boundary and contains a title and body only; Vue and the state machine never import Electron or use the browser `Notification` API.

The browser in-memory gateway implements the port without a host API, which keeps `src` browser-runnable and makes calls observable in tests. The host gateway forwards it through the validated preload API and IPC. The Electron handler invokes an Electron notifier adapter in the main process. Notification failure is non-fatal: the timer continues into the new stage.

A notification describes the stage that has just started. Focus notifications distinguish the new Focus stage; Small Break and Big Break notifications identify the break type.

## Vue integration

The concentrate page continues to load settings and Todo occurrences through `PlatformGateway`. Once loaded, it constructs the controller with `focusMinutes`, `smallBreakMinutes`, and `bigBreakMinutes` converted to milliseconds.

The page binds the Todo selector to an explicit change handler rather than relying only on `v-model`, allowing the outgoing Todo to be flushed before the new selection takes ownership of future Focus intervals. It renders controller state and delegates Start/Pause/Resume actions to the controller. The page contains no timing policy, record-threshold logic, or host notification calls beyond the platform port.

The initial state is Focus 1 and paused, preserving the current v2 requirement that the user explicitly starts. Automatic running applies after stage completion, as approved, and does not make page entry auto-start like 1.2.

## Error handling

- Settings or Todo loading retains the existing fallback behavior: default Focus duration and an empty Todo list where applicable.
- Record creation and notification calls return through platform results. Failure does not stop or rewind the Pomodoro cycle.
- No record is created when there is no selected Todo, the stage is a Break, the timer is paused, or the contiguous Focus interval is at most one minute.
- Timer reconciliation clamps durations and processes boundaries deterministically, preventing negative remaining time.

## Testing

Tests use Vitest fake timers and a fixed system time.

Pure state-machine tests cover:

- the complete four-Focus sequence and restart after Big Break;
- automatic continuation at every boundary;
- delayed callback reconciliation across boundaries;
- pause freezing stage, remaining time, and cumulative Focus time;
- resume continuing from the preserved remainder;
- cumulative Focus time excluding Break and pause time.

Page/controller tests cover:

- durations loaded from settings;
- stage and cumulative Focus display;
- notification calls through the platform port for Focus, Small Break, and Big Break;
- Todo changes closing and flushing intervals to the outgoing schedule;
- unmount closing and flushing the current interval;
- Break time never producing records;
- intervals of at most 60,000 milliseconds being discarded;
- qualifying intervals preserving real start and end timestamps.

Contract and IPC tests cover validation and forwarding of notification requests without exposing Electron types to `src`.

## Out of scope

- Legacy watch artwork or pixel-identical 1.2 layout
- Continuing a Pomodoro session after leaving the concentrate page
- Persisting timer state across application restarts
- Configurable Focus counts or stage ordering
- Adding TanStack Query
