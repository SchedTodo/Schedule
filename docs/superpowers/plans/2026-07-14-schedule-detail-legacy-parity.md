# Schedule Detail Legacy Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore Schedule detail, editing, Time management, and deletion behavior to `release/1.2.0` parity while preserving browser/Electron boundaries.

**Architecture:** Preserve parser source intent through normalization, separate visible occurrence queries from all-state reconciliation queries, and make SQLite reconciliation update rows instead of replacing them. Reuse one modal for Add/Edit and keep detail presentation helpers pure so ordering and formatting are deterministic in tests.

**Tech Stack:** Node.js 24 LTS, pnpm 11.11.0, TypeScript 6 strict mode, Vue 3, Naive UI, Zod 4, Temporal, Drizzle ORM, better-sqlite3, Vitest, Vue Test Utils.

## Global Constraints

- `release/1.2.0` is immutable and is used only as a behavioral/source reference.
- `main` remains the Schedule v2 development line.
- Keep `src` browser-runnable and platform-independent; keep Drizzle and SQLite types in `src-electron`.
- Do not introduce TanStack Query or another UI/persistence library.
- Validate IPC, persistence, and process-boundary inputs with Zod.
- Use RED → GREEN → REFACTOR for every behavior change.
- Preserve unrelated changes, including the existing user modification to `AGENTS.md`.
- New commit subjects use a Conventional Commit type followed by a concise Chinese description.
- Manual Time deletion means `excluded=true` plus an appended concrete `exclusionCode`; it does not set that Time's `deleted_at`.
- An omitted frequency remains omitted in normalized rTime; only an explicitly entered `daily` is preserved.
- `SyncAt` and `Version` remain out of scope.

---

### Task 1: Preserve explicit `daily` through parser normalization

**Files:**
- Modify: `src/parser/evaluator.ts`
- Modify: `src/parser/serialize-schedule.ts`
- Modify: `tests/parser/normalization.test.ts`

**Interfaces:**
- Produces: `EvaluatedStatement.frequency.explicit: boolean`.
- Preserves: `serializeScheduleSpec(spec): string`.

- [ ] **Step 1: Write failing normalization tests**

Add these cases to `tests/parser/normalization.test.ts`:

```ts
it('preserves explicit daily without inserting implicit daily', () => {
  const implicit = normalizeSchedule('2026/7/13-17 13:00-14:00;', context)
  const explicit = normalizeSchedule('2026/7/13-17 13:00-14:00 daily;', context)

  expect(implicit.ok && implicit.value.code)
    .toBe('2026/7/13-2026/7/17 13:00-14:00 Asia/Shanghai;')
  expect(explicit.ok && explicit.value.code)
    .toBe('2026/7/13-2026/7/17 13:00-14:00 Asia/Shanghai daily;')
})

it('preserves explicit daily options', () => {
  const result = normalizeSchedule('2026/7/13-17 13:00-14:00 daily,i2,c2;', context)
  expect(result.ok && result.value.code)
    .toBe('2026/7/13-2026/7/17 13:00-14:00 Asia/Shanghai daily,i2,c2;')
})
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `.\node_modules\.bin\vitest.cmd run tests/parser/normalization.test.ts`

Expected: the explicit default `daily` case fails because the serializer omits it.

- [ ] **Step 3: Retain source explicitness and serialize it**

Change the evaluated frequency type and construction:

```ts
readonly frequency: {
  readonly unit: 'daily' | 'weekly' | 'monthly' | 'yearly'
  readonly interval: number
  readonly count?: number
  readonly explicit: boolean
}

frequency: {
  unit: statement.frequency?.unit ?? 'daily',
  interval: statement.frequency?.interval ?? 1,
  ...(statement.frequency?.count === undefined ? {} : { count: statement.frequency.count }),
  explicit: statement.frequency !== undefined
}
```

Update `formatFrequency`:

```ts
function formatFrequency(value: EvaluatedStatement['frequency']): string {
  if (!value.explicit && value.unit === 'daily' && value.interval === 1 && value.count === undefined) {
    return ''
  }
  const options = [
    value.interval === 1 ? '' : `i${value.interval}`,
    value.count === undefined ? '' : `c${value.count}`
  ].filter(Boolean)
  return [value.unit, ...options].join(',')
}
```

- [ ] **Step 4: Verify GREEN and parser compatibility**

Run: `.\node_modules\.bin\vitest.cmd run tests/parser`

Expected: all parser tests pass; no omitted-frequency normalization gains `daily`.

- [ ] **Step 5: Commit**

```powershell
git add src/parser/evaluator.ts src/parser/serialize-schedule.ts tests/parser/normalization.test.ts
git commit -m "fix(parser): 保留显式 daily 频率"
```

### Task 2: Make detail and occurrence query semantics explicit

**Files:**
- Modify: `src/contracts/schedule.contract.ts`
- Modify: `src/contracts/occurrence.contract.ts`
- Modify: `src/contracts/platform.contract.ts`
- Modify: `src/platform/ports.ts`
- Modify: `tests/contracts/schedule-management.contract.test.ts`
- Modify: `tests/contracts/occurrence.contract.test.ts`
- Modify: `tests/contracts/host-api.test.ts`
- Modify: `tests/integration/ipc/schedule-ipc.test.ts`
- Modify: `tests/integration/database/occurrence-repository.test.ts`
- Modify: `tests/unit/application/schedule-service.test.ts`
- Modify: `tests/unit/features/schedule-composables.test.ts`
- Modify: `tests/unit/features/secondary-pages.test.ts`
- Modify: `tests/unit/platform/in-memory-gateway.test.ts`

**Interfaces:**
- Produces: `ScheduleDetailDtoSchema = ScheduleDtoSchema.extend({ deleted: z.boolean() }).strict()`.
- Produces: `StoredScheduleOccurrenceDto = ScheduleOccurrenceDto & { deleted: boolean }`.
- Renames public query to `OccurrenceGateway.listVisibleBySchedule(scheduleId)`.
- Adds repository query `OccurrenceRepository.listAllBySchedule(scheduleId)`.

- [ ] **Step 1: Write failing contract tests**

Add assertions:

```ts
expect(ScheduleDetailDtoSchema.parse({ ...schedule, deleted: false }).deleted).toBe(false)
expect(StoredScheduleOccurrenceDtoSchema.parse({ ...occurrence, deleted: true }).deleted).toBe(true)
```

Add an occurrence repository test that seeds active, excluded, and soft-deleted rows. Assert `listVisibleBySchedule` returns only the active row while `listAllBySchedule` returns all three with the correct `deleted` flags.

- [ ] **Step 2: Run contract tests and verify RED**

Run: `.\node_modules\.bin\vitest.cmd run tests/contracts/schedule-management.contract.test.ts tests/contracts/occurrence.contract.test.ts`

Expected: imports fail because the new schemas/types do not exist.

- [ ] **Step 3: Define strict contracts**

Add:

```ts
export const ScheduleDetailDtoSchema = ScheduleDtoSchema.extend({ deleted: z.boolean() }).strict()
export type ScheduleDetailDto = z.infer<typeof ScheduleDetailDtoSchema>

export const StoredScheduleOccurrenceDtoSchema = ScheduleOccurrenceDtoSchema.extend({
  deleted: z.boolean()
}).strict()
export type StoredScheduleOccurrenceDto = z.infer<typeof StoredScheduleOccurrenceDtoSchema>
```

Update interfaces exactly:

```ts
findById(id: string): Promise<AppResult<ScheduleDetailDto | null>>

listVisibleBySchedule(scheduleId: string): Promise<AppResult<readonly ScheduleOccurrenceDto[]>>

listAllBySchedule(scheduleId: string): Promise<AppResult<readonly StoredScheduleOccurrenceDto[]>>
```

Keep `ScheduleDto` for active list/create/update results.

- [ ] **Step 4: Implement the two query semantics and update call sites**

Rename existing gateway calls and implementations from `listBySchedule` to `listVisibleBySchedule`. In SQLite, retain the current excluded/deleted filters only in the visible query; implement the repository-only all-state query without either filter and map `deleted: occurrence.deletedAt !== null`. In the browser gateway, keep the public visible query filtered by `!excluded`; its update path continues to reconcile against the private complete occurrence array and is tested in Task 3. Update every `findById` mock fixture to return `{ ...schedule, deleted: false }` through the new detail contract.

- [ ] **Step 5: Verify contracts and typecheck**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/contracts
.\node_modules\.bin\vitest.cmd run tests/integration/database/occurrence-repository.test.ts
.\node_modules\.bin\vue-tsc.cmd --noEmit -p tsconfig.app.json
```

Expected: both commands pass.

- [ ] **Step 6: Commit**

```powershell
git add src/contracts src/platform src-electron tests/contracts tests/unit tests/integration
git commit -m "refactor(contracts): 区分可见与历史时间查询"
```

### Task 3: Restore matching occurrence rows during rule updates

**Files:**
- Modify: `src/application/schedule-service.ts`
- Modify: `src-electron/adapters/db/occurrence-repository.ts`
- Modify: `src-electron/adapters/db/schedule-repository.ts`
- Modify: `src/platform/browser/in-memory-gateway.ts`
- Modify: `tests/unit/application/schedule-service.test.ts`
- Modify: `tests/unit/platform/schedule-management.test.ts`
- Modify: `tests/integration/database/schedule-management.test.ts`

**Interfaces:**
- Consumes: `OccurrenceRepository.listAllBySchedule`.
- Preserves: occurrence identity key `JSON.stringify([start, end, startMark, endMark])`.
- Changes: `saveWithOccurrences` upserts desired rows and soft-deletes missing rows instead of deleting all rows.

- [ ] **Step 1: Write failing service and browser tests**

Create a historical occurrence with `excluded: true`, `deleted: false`, comment `keep`, done `true`; update the schedule so the same Time is included again. Assert:

```ts
expect(occurrenceRepository.listAllBySchedule).toHaveBeenCalledWith(schedule.id)
expect(repository.saveWithOccurrences).toHaveBeenCalledWith(
  expect.anything(),
  expect.arrayContaining([
    expect.objectContaining({ id: historical.id, excluded: false, comment: 'keep', done: true })
  ])
)
```

For the browser gateway, assert the visible result after update uses the original ID.

- [ ] **Step 2: Write a failing SQLite reconciliation test**

Seed one active, one excluded, and one no-longer-generated row. Update desired occurrences and query raw SQLite rows. Assert:

```ts
expect(restored.id).toBe(originalExcludedId)
expect(restored.deleted_at).toBeNull()
expect(restored.comment).toBe('keep')
expect(restored.done).toBe(1)
expect(removed.deleted_at).not.toBeNull()
expect(rowCountAfter).toBe(rowCountBefore)
```

- [ ] **Step 3: Run focused tests and verify RED**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/unit/application/schedule-service.test.ts tests/unit/platform/schedule-management.test.ts
.\node_modules\.bin\vitest.cmd run tests/integration/database/schedule-management.test.ts
```

Expected: service uses the visible query and SQLite physically replaces rows.

- [ ] **Step 4: Reconcile against all history**

In `ScheduleService.update`, replace the visible query with `listAllBySchedule`. Build the key map from every returned row. For each generated value, reuse `id`, `comment`, and `done` from the matching row; generated `excluded` remains authoritative.

In `DrizzleOccurrenceRepository.listAllBySchedule`, omit excluded/deleted filters and map `deleted: occurrence.deletedAt !== null`.

In `DrizzleScheduleRepository.saveWithOccurrences`, within one transaction:

```ts
const desiredIds = new Set(occurrences.map(({ id }) => id))
const existing = transaction.select({ id: scheduleOccurrences.id })
  .from(scheduleOccurrences)
  .where(eq(scheduleOccurrences.scheduleId, schedule.id))
  .all()

for (const occurrence of occurrences) {
  transaction.insert(scheduleOccurrences).values(toOccurrenceRow(occurrence))
    .onConflictDoUpdate({
      target: scheduleOccurrences.id,
      set: {
        excluded: occurrence.excluded,
        start: occurrence.start === null ? null : new Date(occurrence.start),
        end: new Date(occurrence.end),
        startMark: occurrence.startMark,
        endMark: occurrence.endMark,
        comment: occurrence.comment,
        done: occurrence.done,
        deletedAt: null,
        updatedAt: row.updatedAt
      }
    }).run()
}
for (const { id } of existing) {
  if (!desiredIds.has(id)) {
    transaction.update(scheduleOccurrences)
      .set({ deletedAt: row.updatedAt, updatedAt: row.updatedAt })
      .where(eq(scheduleOccurrences.id, id)).run()
  }
}
```

Keep `createdAt` unchanged on conflict.

- [ ] **Step 5: Verify GREEN**

Run the two focused commands from Step 3.

Expected: all focused tests pass and raw row count/IDs remain stable.

- [ ] **Step 6: Commit**

```powershell
git add src/application/schedule-service.ts src/platform/browser/in-memory-gateway.ts src-electron/adapters/db tests/unit/application tests/unit/platform tests/integration/database/schedule-management.test.ts
git commit -m "fix(database): 恢复匹配的历史时间实例"
```

### Task 4: Implement transactional batch Time exclusion across boundaries

**Files:**
- Modify: `src/features/schedule/occurrence-time.ts`
- Modify: `src/platform/browser/in-memory-gateway.ts`
- Modify: `src-electron/adapters/db/occurrence-repository.ts`
- Modify: `src/platform/host/host-api.ts`
- Modify: `src/platform/host/host-gateway.ts`
- Modify: `src-electron/ipc/schedule-ipc.ts`
- Modify: `src-electron/preload/schedule-api.ts`
- Modify: `src-electron/main/ipc/register-handlers.ts`
- Modify: `src-electron/main/index.ts`
- Modify: `tests/unit/features/occurrence-time.test.ts`
- Modify: `tests/unit/platform/schedule-management.test.ts`
- Modify: `tests/integration/database/schedule-management.test.ts`
- Modify: `tests/contracts/host-api.test.ts`
- Modify: `tests/integration/ipc/schedule-ipc.test.ts`

**Interfaces:**
- Produces: `ExcludeOccurrencesInputSchema` with `ids: z.array(z.uuid()).min(1).max(200)`.
- Produces: `serializeOccurrenceExclusion(item): string`.
- Produces: one `excludeMany({ ids })` operation from UI through IPC to repository.

- [ ] **Step 1: Write failing batch input contract tests**

Add:

```ts
expect(ExcludeOccurrencesInputSchema.safeParse({ ids: [occurrence.id] }).success).toBe(true)
expect(ExcludeOccurrencesInputSchema.safeParse({ ids: [] }).success).toBe(false)
expect(ExcludeOccurrencesInputSchema.safeParse({ ids: ['not-a-uuid'] }).success).toBe(false)
```

Define the intended strict shape in `src/contracts/occurrence.contract.ts` only after this test fails:

```ts
export const ExcludeOccurrencesInputSchema = z.object({
  ids: z.array(z.uuid()).min(1).max(200)
}).strict()
export type ExcludeOccurrencesInput = z.infer<typeof ExcludeOccurrencesInputSchema>
```

Add `excludeMany(input: ExcludeOccurrencesInput): Promise<AppResult<void>>` to the gateway and repository interfaces.

- [ ] **Step 2: Write failing exclusion serializer tests**

Add cases:

```ts
expect(serializeOccurrenceExclusion(event)).toBe('2026/7/14 13:00-14:00 UTC')
expect(serializeOccurrenceExclusion({ ...event, startMark: '10', endMark: '01' }))
  .toBe('2026/7/14 13:?-?:00 UTC')
expect(serializeOccurrenceExclusion(todo)).toBe('2026/7/14 14:00 UTC')
```

The helper must derive values in UTC because that is the legacy persistence format.

- [ ] **Step 3: Write failing browser and SQLite batch tests**

Exclude two IDs. Assert both become invisible, both remain stored with `deleted_at IS NULL`, and Schedule `exclusionCode` contains both concrete statements separated by `;`. Also submit one valid and one missing ID and assert neither row changes.

- [ ] **Step 4: Write failing IPC boundary tests**

Assert empty IDs and malformed UUIDs return `VALIDATION_FAILED`; valid IDs reach `gateway.occurrences.excludeMany({ ids })`; output is parsed as `AppResult<void>`.

- [ ] **Step 5: Run focused tests and verify RED**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/contracts/occurrence.contract.test.ts tests/unit/features/occurrence-time.test.ts tests/unit/platform/schedule-management.test.ts
.\node_modules\.bin\vitest.cmd run tests/integration/database/schedule-management.test.ts tests/integration/ipc/schedule-ipc.test.ts tests/contracts/host-api.test.ts
```

Expected: serializer and batch channel are missing; Electron exclusion does not append exTime.

- [ ] **Step 6: Implement concrete exclusion serialization**

Use `Temporal.Instant.from(value).toZonedDateTimeISO('UTC')` and mark characters to produce `yyyy/M/d H:mm-H:mm UTC` or the todo single-time form. Do not include seconds.

- [ ] **Step 7: Implement atomic adapter behavior**

Browser: validate all IDs before mutation, then set every match `excluded: true` and append serialized statements once.

SQLite: in one `database.transaction`, load all requested rows joined to schedules; reject missing IDs or multiple owning schedules; update selected occurrences to `excluded=true`; append statements to `schedules.exclusionCode`; update timestamps. Do not set `deletedAt`.

- [ ] **Step 8: Replace single exclusion IPC with batch exclusion**

Define channel `occurrence:exclude-many`, parse `ExcludeOccurrencesInputSchema` on preload and main sides, call `excludeMany`, and remove the obsolete public single-ID `exclude` method after all callers migrate.

- [ ] **Step 9: Verify GREEN**

Run the focused commands from Step 5.

Expected: all unit, database, contract, and IPC tests pass.

- [ ] **Step 10: Commit**

```powershell
git add src/features/schedule/occurrence-time.ts src/platform src-electron tests
git commit -m "fix(schedule): 批量排除所选时间实例"
```

### Task 5: Complete schedule deleted-state behavior

**Files:**
- Modify: `src-electron/adapters/db/schedule-mapper.ts`
- Modify: `src-electron/adapters/db/schedule-repository.ts`
- Modify: `src/application/schedule-service.ts`
- Modify: `src/platform/browser/in-memory-gateway.ts`
- Modify: `src/pages/database.vue`
- Modify: `tests/integration/database/schedule-management.test.ts`
- Modify: `tests/unit/platform/schedule-management.test.ts`
- Modify: `tests/unit/features/secondary-pages.test.ts`

**Interfaces:**
- Produces: detail lookup returns `ScheduleDetailDto` for active and deleted schedules.
- Preserves: active `list` filtering.
- Extends: schedule-wide deletion updates schedule occurrences and concentration records in the same transaction.

- [ ] **Step 1: Write failing persistence and browser tests**

Delete a schedule with one occurrence and one record. Assert detail lookup returns `{ deleted: true }`; active list omits it; occurrence and record `deleted_at` are non-null. Restore it and assert detail returns `{ deleted: false }` and related rows are restored.

- [ ] **Step 2: Write a failing Database navigation test**

Render a deleted search result, click it, and assert the router navigates to `schedule-detail`. The detail is read-only and shows `Deleted true`.

- [ ] **Step 3: Run tests and verify RED**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/unit/platform/schedule-management.test.ts tests/unit/features/secondary-pages.test.ts
.\node_modules\.bin\vitest.cmd run tests/integration/database/schedule-management.test.ts
```

Expected: deleted lookup returns null, Records are not cascaded, and Database blocks navigation.

- [ ] **Step 4: Implement detail mapping and cascade**

Add `scheduleRowToDetailDto(row)` returning `{ ...scheduleRowToDto(row), deleted: row.deletedAt !== null }`. Remove the deleted filter only from repository `findById`; keep it on active list queries. In `ScheduleService.update` and `setStarred`, reject a found detail with `deleted: true`.

Inside `setDeleted`, update `schedules`, `scheduleOccurrences`, and `concentrationRecords` with the same timestamp in one transaction. Restore by setting each `deletedAt` to null.

Update browser deleted storage so `findById` returns the schedule plus the flag instead of null. Allow Database rows to navigate regardless of deleted state.

- [ ] **Step 5: Verify GREEN**

Run the commands from Step 3.

Expected: all tests pass.

- [ ] **Step 6: Commit**

```powershell
git add src/application src/platform/browser src-electron/adapters/db src/pages/database.vue tests
git commit -m "fix(schedule): 补全日程软删除状态"
```

### Task 6: Reuse ScheduleModal for Add and Edit

**Files:**
- Modify: `src/features/schedule/components/ScheduleModal.vue`
- Modify: `src/pages/index.vue`
- Modify: `src/pages/schedule/[id].vue`
- Modify: `tests/unit/features/home-workspace.test.ts`
- Create: `tests/unit/features/schedule-detail.test.ts`

**Interfaces:**
- Produces props: `mode: 'add' | 'edit'`, `initialValue?: CreateScheduleInput`, `triggerLabel?: string`.
- Preserves emit: `submit: [input: CreateScheduleInput]`.

- [ ] **Step 1: Write failing shared-modal tests**

Mount in Edit mode with initial values. Open the trigger and assert title `Edit` and all four fields are populated. Change Name, submit, and assert the common payload. Close without submission, reopen, and assert the original initial values were restored.

Also assert Ctrl+ArrowUp opens Add mode but does not open an Edit modal.

- [ ] **Step 2: Run tests and verify RED**

Run: `.\node_modules\.bin\vitest.cmd run tests/unit/features/home-workspace.test.ts tests/unit/features/schedule-detail.test.ts`

Expected: current modal has no Edit mode or initial-value reset behavior.

- [ ] **Step 3: Implement the shared draft modal**

Use a `blankValue()` and `resetDraft()` function:

```ts
function resetDraft() {
  const value = props.initialValue ?? {
    title: '', recurrenceCode: '', exclusionCode: '', comment: ''
  }
  Object.assign(model, value)
}

function open() {
  resetDraft()
  show.value = true
}
```

Use `mode === 'edit' ? 'Edit' : 'Add'` for card/trigger defaults. Keep validation and submit payload unchanged. Register global Add keyboard shortcuts only when `mode === 'add'`.

- [ ] **Step 4: Replace the detail inline form**

Render `ScheduleModal` in Edit mode with current schedule fields and call `platform.schedules.update({ id: scheduleId, ...input })`. On success refresh schedule and Times. Remove the detail page's inline inputs and `editing` refs.

- [ ] **Step 5: Verify GREEN**

Run the command from Step 2.

Expected: Add and Edit tests pass.

- [ ] **Step 6: Commit**

```powershell
git add src/features/schedule/components/ScheduleModal.vue src/pages/index.vue src/pages/schedule/[id].vue tests/unit/features
git commit -m "refactor(schedule): 复用新增与编辑弹窗"
```

### Task 7: Rebuild the detail Info and Times presentation

**Files:**
- Create: `src/features/schedule/schedule-detail-presentation.ts`
- Create: `src/features/schedule/components/EditableOccurrenceComment.vue`
- Modify: `src/pages/schedule/[id].vue`
- Modify: `tests/unit/features/schedule-detail.test.ts`
- Create: `tests/unit/features/schedule-detail-presentation.test.ts`

**Interfaces:**
- Produces: `formatOccurrenceDateTime(instant, mark, timeZone): string`.
- Produces: `occurrenceWeekday(occurrence, timeZone, locale?): string`.
- Produces: `sortDetailOccurrences(values, timeZone, now): ScheduleOccurrenceDto[]`.
- Produces: comment component emit `commit: [value: string]`.

- [ ] **Step 1: Write failing pure presentation tests**

Use a fixed `now = Temporal.Instant.from('2026-07-14T04:00:00Z')` and `Asia/Shanghai`. Assert output has no seconds, weekdays use Start for events and End for todos, and ordering is July 14/15/16/17 followed by July 13.

```ts
expect(formatOccurrenceDateTime(start, '11', 'Asia/Shanghai')).toBe('2026/7/14 13:00')
expect(sorted.map(({ id }) => id)).toEqual(['14', '15', '16', '17', '13'])
```

- [ ] **Step 2: Write failing detail component tests**

Assert:

- one Ionicons `Star` inside the star button and no `Star` Info label;
- `Deleted false` is present;
- Type tag element is content-width;
- Edit/Delete use a compact action-group class and Delete has a popconfirm;
- event detail has no Records card; todo detail has one;
- Times uses `NDataTable`, has selection/Start/End/Weekday/Comment columns and page size 5;
- double-clicking a comment shows `NInput` and committing calls `updateComment`;
- selecting rows and confirming Delete calls one `excludeMany({ ids })` request;
- no mutation occurs before either confirmation.

- [ ] **Step 3: Run tests and verify RED**

Run: `.\node_modules\.bin\vitest.cmd run tests/unit/features/schedule-detail-presentation.test.ts tests/unit/features/schedule-detail.test.ts`

Expected: helpers/components are missing and the page still uses a plain table.

- [ ] **Step 4: Implement pure formatting and ordering**

Use Temporal in the configured zone. Compare each occurrence's effective plain date with `now.toZonedDateTimeISO(timeZone).toPlainDate()`. Sort by group (`current/future=0`, `past=1`) and then by effective instant ascending. Expose `isPastOccurrence` for row class computation.

- [ ] **Step 5: Implement inline comment editing**

`EditableOccurrenceComment` displays a full-width minimum-height div. On double click, render and focus `NInput`. Emit only when the changed value is committed; blur exits. The page awaits `updateComment`, refreshes on success, and displays an `NAlert` on failure.

- [ ] **Step 6: Implement Info and Times with Naive UI**

Import `Star` from `@vicons/ionicons5` and render it through `NIcon`. Use `NButtonGroup` or an equivalent `.schedule-actions` wrapper with joined inner edges. Add `align-self: start` to the Type tag.

Build `DataTableColumns<ScheduleOccurrenceDto>` with selection, formatted Start/End, weekday, and editable comment. Configure:

```ts
const pagination = reactive({
  page: 1,
  pageSize: 5,
  showSizePicker: true,
  pageSizes: [5, 10, 15, 20]
})
```

Place batch Delete in `#header-extra` inside `NPopconfirm`. Place schedule Delete in a separate `NPopconfirm`. Hide Edit/Delete/Times mutation controls for deleted schedules. Clear selected keys after refresh and successful exclusion.

- [ ] **Step 7: Verify GREEN**

Run the command from Step 3.

Expected: all detail presentation and component tests pass.

- [ ] **Step 8: Commit**

```powershell
git add src/features/schedule src/pages/schedule/[id].vue tests/unit/features
git commit -m "fix(ui): 恢复日程详情与时间列表"
```

### Task 8: Run boundary and full-project verification

**Files:**
- Modify if required by implemented status: `docs/development/v2-feature-gaps.md`
- Test only: all files changed in Tasks 1–7.

**Interfaces:**
- Verifies: parser, browser gateway, SQLite, IPC, Vue UI, lint, types, and Web build as one coherent result.

- [ ] **Step 1: Run focused persistence and IPC suites**

```powershell
.\node_modules\.bin\vitest.cmd run tests/integration/database tests/integration/ipc
```

Expected: all tests pass with zero failures.

- [ ] **Step 2: Run project minimum verification**

```powershell
.\node_modules\.bin\eslint.cmd .
.\node_modules\.bin\vue-tsc.cmd --noEmit -p tsconfig.app.json
.\node_modules\.bin\vitest.cmd run tests/unit tests/contracts tests/parser
.\node_modules\.bin\vite.cmd build
```

Expected: every command exits 0; Vitest reports zero failed tests; Vite emits `dist-web`.

- [ ] **Step 3: Run Electron type/build verification**

```powershell
.\node_modules\.bin\tsc.cmd --noEmit -p tsconfig.electron.json
.\node_modules\.bin\vite.cmd build --config vite.electron-main.config.ts
.\node_modules\.bin\vite.cmd build --config vite.electron-preload.config.ts
```

Expected: all commands exit 0.

- [ ] **Step 4: Review the final diff against all fourteen user findings**

Confirm the diff directly accounts for star icon, compact radii, Type tag width, explicit daily, Deleted, no Star row, omitted sync fields, event Records removal, shared Edit modal, Naive UI Times table, correct columns/minute formatting/comment editing, future-first ordering, both confirmations, and legacy deletion/reconciliation semantics.

- [ ] **Step 5: Commit any documentation status update**

If `docs/development/v2-feature-gaps.md` still lists these implemented behaviors as missing, update only those entries and commit:

```powershell
git add docs/development/v2-feature-gaps.md
git commit -m "docs(schedule): 更新详情页兼容状态"
```

If the file contains no stale entries, do not create an empty documentation commit.

## Plan Self-Review

- Spec coverage: Tasks 1–7 cover every UI, parser, contract, persistence, reconciliation, and boundary requirement; Task 8 covers mandated verification.
- Placeholder scan: every code-changing step names exact behavior, signatures, or code shape; no deferred implementation markers remain.
- Type consistency: `ScheduleDetailDto` is used only by detail lookup, `ScheduleDto` remains the create/list/update value, `listVisibleBySchedule` is public UI behavior, `listAllBySchedule` is repository reconciliation behavior, and `excludeMany` uses the same Zod input through Web and Electron.
- Scope control: no sync fields, dependency replacement, unrelated page refactor, or schema migration is added; existing `deleted_at` columns are reused.
