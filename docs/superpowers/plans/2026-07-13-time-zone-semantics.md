# Time-Zone Semantics Correction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore explicit time zones in saved rules, UTC occurrence persistence, and selected-zone presentation and day boundaries.

**Architecture:** The parser exposes a normalization function that serializes evaluated statements with explicit IANA zones; schedule creation and update save that normalized code while expanding the same evaluated values to UTC instants. A Temporal-based presentation helper supplies selected-zone calendar fields, and Todo queries carry the selected zone so UTC repository filters use the correct logical-day boundaries.

**Tech Stack:** Node.js 24 LTS, pnpm 11.11.0, TypeScript 6, Vue 3, Temporal polyfill, Zod, Drizzle, Vitest.

## Global Constraints

- Keep `src` browser-runnable and platform-independent.
- Persist occurrence `start` and `end` as instants; Electron returns UTC ISO strings.
- Save full IANA identifiers in normalized recurrence and exclusion rules.
- Do not add Moment, Luxon, TanStack Query, or another dependency.
- Do not migrate or regenerate unpublished v2 data.
- Preserve the unrelated user edit in `AGENTS.md`.
- Use failing tests before every production behavior change.

---

### Task 1: Normalize Saved Rules and Preserve UTC Occurrences

**Files:**
- Create: `src/parser/serialize-schedule.ts`
- Modify: `src/parser/parse-schedule.ts`
- Modify: `src/application/schedule-service.ts`
- Modify: `src/platform/browser/in-memory-gateway.ts`
- Test: `tests/parser/normalization.test.ts`
- Test: `tests/unit/application/schedule-service.test.ts`
- Test: `tests/unit/platform/in-memory-gateway.test.ts`

**Interfaces:**
- Produces: `normalizeSchedule(source: string, context: EvaluationContext): ParseResult<{ code: string; spec: ScheduleSpec }>`.
- Produces: `serializeScheduleSpec(spec: ScheduleSpec): string`.
- Guarantees: normalized rules include resolved IANA zones; expanded values remain ISO instants.

- [ ] **Step 1: Write parser normalization tests**

Create tests that call `normalizeSchedule('tdy 10:00-11:00;', context)` with an `Asia/Shanghai` context and assert:

```ts
expect(result).toMatchObject({ ok: true })
if (!result.ok) return
expect(result.value.code).toBe('2026/7/13 10:00-11:00 Asia/Shanghai;')
expect(expandScheduleSpec(result.value.spec)[0]).toMatchObject({
  start: '2026-07-13T02:00:00Z',
  end: '2026-07-13T03:00:00Z'
})
```

Also prove an explicit `America/Chicago` rule stays in that zone and an abbreviation resolved by the context is saved as the full identifier.

- [ ] **Step 2: Run the parser test and verify RED**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/parser/normalization.test.ts
```

Expected: FAIL because `normalizeSchedule` and `serializeScheduleSpec` do not exist.

- [ ] **Step 3: Implement statement serialization and normalization**

Serialize evaluated fields using these stable forms:

```ts
function serializeTime(time: EvaluatedTime): string {
  if (time.hour === null) return time.minute === null ? '?' : `?:${time.minute}`
  return `${time.hour}:${time.minute === null ? '?' : String(time.minute).padStart(2, '0')}`
}

function serializeStatement(statement: EvaluatedStatement): string {
  const dates = statement.endDate === undefined
    ? formatDate(statement.startDate)
    : `${formatDate(statement.startDate)}-${formatDate(statement.endDate)}`
  const times = statement.startTime === null
    ? serializeTime(statement.endTime)
    : `${serializeTime(statement.startTime)}-${serializeTime(statement.endTime)}`
  const frequency = serializeNonDefaultFrequency(statement.frequency)
  const by = serializeBy(statement.by)
  return [dates, times, statement.timeZone, frequency, by].filter(Boolean).join(' ')
}
```

`serializeScheduleSpec` joins statements with `;` and includes one trailing semicolon. `normalizeSchedule` calls `parseSchedule` once and returns its evaluated spec plus serialized code.

- [ ] **Step 4: Run the parser test and verify GREEN**

Run the command from Step 2. Expected: PASS.

- [ ] **Step 5: Write service and browser-gateway persistence tests**

For both create and update, submit rules without a time zone under `Asia/Shanghai`; assert the returned and subsequently read schedule contains `Asia/Shanghai`, and assert listed occurrences contain the expected UTC `Z` timestamp. Include an exclusion rule assertion.

- [ ] **Step 6: Run service and gateway tests and verify RED**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/unit/application/schedule-service.test.ts tests/unit/platform/in-memory-gateway.test.ts
```

Expected: FAIL because both implementations currently save raw input rules.

- [ ] **Step 7: Save normalized rule code in both implementations**

In `ScheduleService.create/update` and the browser gateway `create/update`, normalize recurrence and non-empty exclusion rules with the current evaluation context, expand their returned specs, and assign:

```ts
recurrenceCode: normalizedRecurrence.value.code,
exclusionCode: normalizedExclusionCode
```

Keep the existing transactional `saveWithOccurrences` boundary and occurrence-state matching.

- [ ] **Step 8: Run Task 1 tests GREEN and commit**

Run the parser, service, and gateway commands above. Expected: PASS.

Commit:

```powershell
git add src/parser/serialize-schedule.ts src/parser/parse-schedule.ts src/application/schedule-service.ts src/platform/browser/in-memory-gateway.ts tests/parser/normalization.test.ts tests/unit/application/schedule-service.test.ts tests/unit/platform/in-memory-gateway.test.ts
git commit -m "fix(schedule): 固化规则时区并保持 UTC 实例"
```

### Task 2: Render Occurrences in the Selected Time Zone

**Files:**
- Create: `src/features/schedule/occurrence-time.ts`
- Modify: `src/features/schedule/components/MonthScheduleView.vue`
- Modify: `src/features/schedule/components/WeekScheduleView.vue`
- Modify: `src/features/schedule/components/TodoSidebar.vue`
- Modify: `src/pages/index.vue`
- Modify: `src/pages/schedule/[id].vue`
- Test: `tests/unit/features/occurrence-time.test.ts`
- Test: `tests/unit/features/occurrence-calendar.test.ts`
- Test: `tests/unit/features/home-workspace.test.ts`

**Interfaces:**
- Produces: `occurrenceWallTime(instant: string, timeZone: string)` returning `{ date: string; hour: number; minute: number }`.
- Produces: `todayInTimeZone(timeZone: string, now?: Temporal.Instant): string`.
- Consumes: `SettingsDto.timeZone` from the platform gateway.

- [ ] **Step 1: Write helper and component tests**

Assert that `2026-07-13T23:30:00Z` maps to `2026-07-13 23:30` in UTC and `2026-07-14 07:30` in Asia/Shanghai. Mount month and week views with both zones and assert the card moves to the correct date and displays the correct wall time.

- [ ] **Step 2: Run focused tests and verify RED**

```powershell
.\node_modules\.bin\vitest.cmd run tests/unit/features/occurrence-time.test.ts tests/unit/features/occurrence-calendar.test.ts tests/unit/features/home-workspace.test.ts
```

Expected: FAIL because views slice UTC strings and have no `timeZone` prop.

- [ ] **Step 3: Implement Temporal presentation helpers**

```ts
export function occurrenceWallTime(instant: string, timeZone: string) {
  const value = Temporal.Instant.from(instant).toZonedDateTimeISO(timeZone)
  return {
    date: value.toPlainDate().toString(),
    hour: value.hour,
    minute: value.minute
  }
}
```

Use the helper for month grouping/time labels and week grouping/positioning. Add a required `timeZone` prop to Month, Week, and Todo components; format Todo and schedule-detail values with `Intl.DateTimeFormat` using the explicit `timeZone` option. Pass `appSettings.timeZone` from the home page and use `todayInTimeZone` for the week start date.

- [ ] **Step 4: Run Task 2 tests GREEN and commit**

Run the command from Step 2. Expected: PASS.

Commit:

```powershell
git add src/features/schedule/occurrence-time.ts src/features/schedule/components/MonthScheduleView.vue src/features/schedule/components/WeekScheduleView.vue src/features/schedule/components/TodoSidebar.vue src/pages/index.vue src/pages/schedule/[id].vue tests/unit/features/occurrence-time.test.ts tests/unit/features/occurrence-calendar.test.ts tests/unit/features/home-workspace.test.ts
git commit -m "fix(calendar): 按设置时区展示日程实例"
```

### Task 3: Use Selected-Zone Query and Todo Day Boundaries

**Files:**
- Modify: `src/contracts/occurrence.contract.ts`
- Modify: `src/pages/index.vue`
- Modify: `src/platform/browser/in-memory-gateway.ts`
- Modify: `src-electron/adapters/db/occurrence-repository.ts`
- Test: `tests/contracts/occurrence.contract.test.ts`
- Test: `tests/unit/platform/in-memory-gateway.test.ts`
- Test: `tests/integration/database/occurrence-repository.test.ts`

**Interfaces:**
- Extends: `TodoOccurrenceQuery` with `timeZone: string`.
- Produces: `calendarRange(timeZone: string, now?: Temporal.Instant): OccurrenceRangeQuery`.
- Guarantees: repositories compare UTC database timestamps against selected-zone logical-day instants.

- [ ] **Step 1: Write contract and boundary tests**

Add `timeZone: 'Asia/Shanghai'` to valid Todo queries and assert omission is rejected. Seed occurrences around `16:00Z` and prove a Shanghai midnight/logical-start query includes the selected-zone day while the equivalent UTC query differs.

- [ ] **Step 2: Run boundary tests and verify RED**

```powershell
.\node_modules\.bin\vitest.cmd run tests/contracts/occurrence.contract.test.ts tests/unit/platform/in-memory-gateway.test.ts tests/integration/database/occurrence-repository.test.ts
```

Expected: FAIL because the contract rejects `timeZone` and repositories use `Date.UTC` calendar fields.

- [ ] **Step 3: Convert selected-zone logical dates to UTC instants**

Extend the Zod query with `timeZone: z.string().min(1).max(100)`. In both repositories derive boundaries from:

```ts
const zonedNow = Temporal.Instant.from(query.now).toZonedDateTimeISO(query.timeZone)
const logicalStartToday = zonedNow.toPlainDate().toZonedDateTime({
  timeZone: query.timeZone,
  plainTime: Temporal.PlainTime.from({
    hour: query.logicalDayStartHour,
    minute: query.logicalDayStartMinute
  })
})
```

Use `logicalStartToday.subtract({ days: 1 }).toInstant()` and `logicalStartToday.add({ days: 1 }).toInstant()` for filtering. Make the home page pass `appSettings.timeZone` and refresh its occurrence range after settings load using selected-zone month endpoints converted to instants.

- [ ] **Step 4: Run Task 3 tests GREEN and commit**

Run the command from Step 2. Expected: PASS.

Commit:

```powershell
git add src/contracts/occurrence.contract.ts src/pages/index.vue src/platform/browser/in-memory-gateway.ts src-electron/adapters/db/occurrence-repository.ts tests/contracts/occurrence.contract.test.ts tests/unit/platform/in-memory-gateway.test.ts tests/integration/database/occurrence-repository.test.ts
git commit -m "fix(timezone): 修正日历查询与逻辑日边界"
```

### Task 4: Full Verification

**Files:**
- Verify only.

**Interfaces:**
- Consumes: Tasks 1 through 3.
- Produces: fresh evidence that browser and Electron behavior remain valid.

- [ ] **Step 1: Run required checks**

```powershell
.\node_modules\.bin\eslint.cmd .
.\node_modules\.bin\vue-tsc.cmd --noEmit -p tsconfig.app.json
.\node_modules\.bin\tsc.cmd --noEmit -p tsconfig.electron.json
.\node_modules\.bin\vitest.cmd run tests/unit tests/contracts tests/parser
.\node_modules\.bin\vite.cmd build
.\node_modules\.bin\vitest.cmd run tests/integration/database tests/integration/ipc
```

Expected: every command exits `0` with no failed test.

- [ ] **Step 2: Audit scope and working tree**

```powershell
git -c safe.directory=D:/project/Schedule status --short
git -c safe.directory=D:/project/Schedule diff HEAD~3 -- src src-electron tests
```

Expected: only the unrelated user-owned `AGENTS.md` edit remains unstaged, and every implementation change traces to the approved design.
