# Week View Visual Drag Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the legacy week-view interaction that lets users vertically offset overlapping cards without changing schedule data.

**Architecture:** Keep drag state local to `WeekScheduleView.vue`, keyed by occurrence ID. Add the accumulated vertical offset to the time-derived position and never emit a mutation or call the platform gateway.

**Tech Stack:** Vue 3, TypeScript, Vue Test Utils, Vitest, native HTML drag events.

## Global Constraints

- `release/1.2.0` is the behavioral reference.
- Dragging is vertical, presentation-only, non-persistent, and scoped to one occurrence card.
- Dragging must not change occurrence time, date, recurrence, exclusion, or persisted data.
- Clicking a card continues to emit its schedule ID.

---

### Task 1: Restore presentation-only vertical dragging

**Files:**
- Modify: `src/features/schedule/components/WeekScheduleView.vue`
- Modify: `tests/unit/features/home-workspace.test.ts`
- Modify: `docs/development/v2-feature-gaps.md`

**Interfaces:**
- Consumes: `ScheduleOccurrenceDto.id`, existing time-derived `eventStyle`, native `DragEvent.offsetY`.
- Produces: component-local accumulated offsets with no gateway or persistence interface.

- [ ] **Step 1: Write the failing component test**

Mount a week view with one occurrence, trigger `dragstart` at `offsetY: 5` and `dragend` at `offsetY: 35`, then assert its inline `insetBlockStart` contains an added `30px`. Assert no occurrence mutation is emitted and clicking still emits the schedule ID.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `.\node_modules\.bin\vitest.cmd run tests/unit/features/home-workspace.test.ts`

Expected: FAIL because the card is not draggable and its position has no drag offset.

- [ ] **Step 3: Implement the minimal local drag state**

In `WeekScheduleView.vue`, store drag start offsets and accumulated vertical offsets in reactive maps keyed by occurrence ID. Mark cards `draggable="true"`; on drag start remember `offsetY`; on drag end add `endOffsetY - startOffsetY`. Compose the accumulated pixels into `insetBlockStart` while leaving `item.start` and `item.end` untouched.

- [ ] **Step 4: Run focused and regression tests**

Run: `.\node_modules\.bin\vitest.cmd run tests/unit/features/home-workspace.test.ts tests/unit/features/schedule-composables.test.ts`

Expected: PASS.

- [ ] **Step 5: Update the gap inventory**

Remove the week-view drag gap and describe it as presentation-only legacy overlap handling.

- [ ] **Step 6: Run project verification**

Run ESLint, both TypeScript checks, unit/contract/parser/integration suites, Web/Electron builds, and Electron Playwright tests. Electron Playwright runs outside the Codex sandbox because the sandbox prevents its GPU child process from loading.

- [ ] **Step 7: Commit**

Commit the corrected spec, plan, tests, component, gap inventory, and the already completed local v2 work using a concise Chinese Conventional Commit subject.
