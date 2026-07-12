# Persisted Schedule Occurrences Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist legacy-compatible concrete schedule occurrences and use range queries to render all month and week events.

**Architecture:** ANTLR/Temporal evaluation produces platform-neutral occurrence drafts. The schedule application service atomically stores schedules and drafts through a unit-of-work port; browser and Drizzle adapters implement the same gateway contract. Vue calendar components consume occurrence DTOs and never parse recurrence source.

**Tech Stack:** TypeScript 6, Temporal polyfill, Zod 4, Vue 3, Drizzle SQLite, Vitest, Vue Test Utils.

## Global Constraints

- Preserve user-visible `release/1.2.0` occurrence generation and exclusion behavior.
- Do not migrate legacy database data.
- Keep `src` browser-runnable and free of Electron, Drizzle, SQLite driver, and ANTLR context types.
- Validate IPC and persistence DTO boundaries with Zod.
- Use RED → GREEN → REFACTOR and Chinese Conventional Commit subjects.

---

### Task 1: Define occurrence contracts and gateway interfaces

**Files:**
- Create: `src/contracts/occurrence.contract.ts`
- Modify: `src/contracts/platform.contract.ts`
- Modify: `src/platform/ports.ts`
- Test: `tests/contracts/occurrence.contract.test.ts`

**Interfaces:**
- Produces: `ScheduleOccurrenceDto`, `ScheduleOccurrenceDraft`, `OccurrenceRangeQuery`, and `OccurrenceGateway.listRange`.
- Consumes: ISO instants and legacy two-character known-time marks.

- [ ] **Step 1: Write failing schema tests**

Test an event with start/end, a Todo with null start, strict unknown-field rejection, invalid ranges, and invalid marks:

```ts
expect(ScheduleOccurrenceDtoSchema.parse({
  id, scheduleId, kind: 'event', title: 'Review', excluded: false,
  start: '2026-07-13T01:00:00Z', end: '2026-07-13T02:00:00Z',
  startMark: '11', endMark: '11', comment: '', done: false
})).toBeDefined()
expect(ScheduleOccurrenceDtoSchema.safeParse({ /* same values */, startMark: '1?' }).success).toBe(false)
```

- [ ] **Step 2: Verify RED**

Run: `.\node_modules\.bin\vitest.cmd run tests/contracts/occurrence.contract.test.ts`

Expected: FAIL because `occurrence.contract.ts` does not exist.

- [ ] **Step 3: Implement strict contracts**

Use `z.iso.datetime({ offset: true })`, `z.enum(['00', '01', '10', '11'])`, a refinement requiring `start <= end`, and a range schema with `start < end` and maximum `limit` 5000. Add:

```ts
export interface OccurrenceGateway {
  listRange(query: OccurrenceRangeQuery): Promise<AppResult<readonly ScheduleOccurrenceDto[]>>
}
export interface PlatformGateway {
  readonly schedules: ScheduleGateway
  readonly occurrences: OccurrenceGateway
}
```

- [ ] **Step 4: Verify GREEN**

Run: `.\node_modules\.bin\vitest.cmd run tests/contracts/occurrence.contract.test.ts tests/contracts/schedule.contract.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/contracts src/platform/ports.ts tests/contracts/occurrence.contract.test.ts
git commit -m "feat(occurrence): 定义时间实例契约"
```

### Task 2: Expand evaluated schedules into legacy-compatible occurrence drafts

**Files:**
- Create: `src/domain/schedule/occurrence.ts`
- Modify: `src/parser/evaluator.ts`
- Modify: `src/parser/parse-schedule.ts`
- Test: `tests/parser/occurrence-compatibility.test.ts`
- Reference: `release/1.2.0:src/main/service/timeCodeParser.ts`

**Interfaces:**
- Consumes: `ScheduleSpec`, `EvaluationContext`, recurrence code, and exclusion code.
- Produces: `expandScheduleOccurrences(recurrenceCode, exclusionCode, context): ParseResult<readonly ScheduleOccurrenceDraft[]>`.

- [ ] **Step 1: Add failing legacy compatibility fixtures**

Cover one event, one Todo, overnight range, `tdy`/`tmr`, omitted year rollover, daily/weekly/monthly/yearly count, `by[day]`, multiple statements, timezone conversion, unknown marks, and recurrence/exclusion intersection. Assert exact UTC instants and marks.

- [ ] **Step 2: Verify RED**

Run: `.\node_modules\.bin\vitest.cmd run tests/parser/occurrence-compatibility.test.ts`

Expected: FAIL because occurrence expansion is absent.

- [ ] **Step 3: Implement deterministic expansion**

Extend evaluated statements with a finite recurrence boundary and original marks. Iterate Temporal dates for the supported frequency/interval/count and filter `by` values. Convert local date/time through the statement timezone, advance overnight event ends by one day, and emit Todo `start: null`. Expand exclusions with the same function and partition recurrence drafts by legacy equality `(start, end, startMark, endMark)`.

- [ ] **Step 4: Verify parser regression**

Run: `.\node_modules\.bin\vitest.cmd run tests/parser`

Expected: all compatibility, golden, grammar, semantic, and property tests pass.

- [ ] **Step 5: Commit**

```powershell
git add src/domain/schedule/occurrence.ts src/parser tests/parser
git commit -m "feat(parser): 生成兼容旧版的时间实例"
```

### Task 3: Persist schedules and occurrences transactionally

**Files:**
- Modify: `src-electron/adapters/db/schema.ts`
- Create: `src-electron/adapters/db/migrations/0002_occurrence.sql`
- Create: `src-electron/adapters/db/occurrence-mapper.ts`
- Create: `src-electron/adapters/db/occurrence-repository.ts`
- Modify: `src-electron/adapters/db/schedule-repository.ts`
- Modify: `src/application/schedule-service.ts`
- Test: `tests/integration/database/occurrence-repository.test.ts`
- Test: `tests/unit/application/schedule-service.test.ts`

**Interfaces:**
- Produces: `OccurrenceRepository.replaceForSchedule` and `listRange`.
- Consumes: occurrence drafts with generated IDs and schedule DTOs.

- [ ] **Step 1: Write failing transaction tests**

Assert create stores schedule and all occurrences, rollback leaves neither on failure, range queries hide excluded/done/deleted rows and sort by start, and a v2 database containing schedules survives migration 0002.

- [ ] **Step 2: Verify RED**

Run: `.\node_modules\.bin\vitest.cmd run tests/integration/database/occurrence-repository.test.ts tests/unit/application/schedule-service.test.ts`

Expected: FAIL because the table/repository and transactional create do not exist.

- [ ] **Step 3: Add the occurrence table**

Create columns matching the design and indexes on `(start, end)` and `(schedule_id, deleted_at)`, with a foreign key to schedule. Register schema and migration version 2. Do not read legacy Prisma data.

- [ ] **Step 4: Implement repositories and service orchestration**

Map instants to epoch milliseconds. Implement a transaction callback that saves the schedule and generated occurrences together. Return `PERSISTENCE_FAILED` without exposing SQL to the renderer.

- [ ] **Step 5: Verify GREEN**

Run: `.\node_modules\.bin\vitest.cmd run tests/integration/database tests/unit/application`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/application src-electron/adapters/db tests/integration/database tests/unit/application
git commit -m "feat(db): 持久化日程时间实例"
```

### Task 4: Expose occurrence range queries through browser and Electron gateways

**Files:**
- Modify: `src/platform/browser/in-memory-gateway.ts`
- Modify: `src/platform/host/host-api.ts`
- Modify: `src/platform/host/host-gateway.ts`
- Modify: `src-electron/ipc/schedule-ipc.ts`
- Modify: `src-electron/main/ipc/register-handlers.ts`
- Modify: `src-electron/preload/schedule-api.ts`
- Test: `tests/unit/platform/in-memory-gateway.test.ts`
- Test: `tests/contracts/host-api.test.ts`
- Test: `tests/integration/ipc/schedule-ipc.test.ts`

**Interfaces:**
- Consumes/produces: `OccurrenceRangeQuery` and `readonly ScheduleOccurrenceDto[]`.

- [ ] **Step 1: Write failing gateway and IPC tests**

Assert browser create generates range-queryable occurrences, range boundaries are honored, malformed IPC input is rejected, and malformed output is rejected in preload.

- [ ] **Step 2: Verify RED**

Run: `.\node_modules\.bin\vitest.cmd run tests/unit/platform/in-memory-gateway.test.ts tests/contracts/host-api.test.ts tests/integration/ipc/schedule-ipc.test.ts`

Expected: FAIL because `occurrences.listRange` and its IPC channel are absent.

- [ ] **Step 3: Implement adapters**

Add the named `occurrence:list-range` channel. Validate both directions. The browser gateway uses the same expansion service as Electron and stores occurrences in memory.

- [ ] **Step 4: Verify GREEN**

Run the focused command from Step 2.

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/platform src-electron/ipc src-electron/main/ipc src-electron/preload tests/unit/platform tests/contracts tests/integration/ipc
git commit -m "feat(ipc): 接通时间实例范围查询"
```

### Task 5: Render all queried occurrences in month and week views

**Files:**
- Create: `src/features/schedule/use-occurrence-range.ts`
- Modify: `src/features/schedule/components/MonthScheduleView.vue`
- Modify: `src/features/schedule/components/WeekScheduleView.vue`
- Modify: `src/pages/index.vue`
- Delete: `src/features/schedule/recurrence-presentation.ts` after its final consumer is removed
- Test: `tests/unit/features/occurrence-calendar.test.ts`
- Modify: `tests/unit/features/home-workspace.test.ts`

**Interfaces:**
- Consumes: `ScheduleOccurrenceDto[]` returned by `PlatformGateway.occurrences.listRange`.
- Produces: visible-range requests from month/week panels and selection by `scheduleId`.

- [ ] **Step 1: Write failing component tests**

Mount with two occurrences from one recurring schedule and assert both dates render. Assert month range includes surrounding calendar days, week cards use occurrence IDs as keys, titles/times come from occurrence DTOs, and recurrence source is never parsed in Vue.

- [ ] **Step 2: Verify RED**

Run: `.\node_modules\.bin\vitest.cmd run tests/unit/features/occurrence-calendar.test.ts tests/unit/features/home-workspace.test.ts`

Expected: FAIL because components still derive only the first date from recurrence code.

- [ ] **Step 3: Implement range composable and views**

The composable tracks loading/error/stale requests. Month and week components emit visible ISO range changes and index DTOs by configured local date. Cards emit `scheduleId`. Remove `recurrence-presentation.ts` only when `rg` confirms no consumers.

- [ ] **Step 4: Verify focused and full checks**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/unit/features
.\node_modules\.bin\eslint.cmd .
.\node_modules\.bin\vue-tsc.cmd --noEmit -p tsconfig.app.json
.\node_modules\.bin\vitest.cmd run tests/unit tests/contracts tests/parser
.\node_modules\.bin\vite.cmd build
```

Expected: all commands exit 0 with no new warnings.

- [ ] **Step 5: Update the gap report and commit**

Mark recurrence expansion, occurrence range query, and month/week multi-occurrence display as implemented, citing the owning tests.

```powershell
git add src tests docs/development/v2-feature-gaps.md
git commit -m "feat(calendar): 展示完整日程时间实例"
```

## Plan self-review

- Spec coverage: persisted model, deterministic generation, exclusion difference, browser/Electron parity, range queries, and calendar consumers each have an owning task.
- No legacy database migration is included.
- Type flow is consistent: parser emits drafts, repositories store DTO fields, gateways return `ScheduleOccurrenceDto`, and Vue consumes only DTOs.
- Later edit/Todo/alarm/sync behavior is intentionally deferred to its own vertical slice while the occurrence fields required by those slices are stored now.
