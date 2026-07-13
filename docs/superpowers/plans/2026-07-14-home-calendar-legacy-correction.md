# 首页日历旧版对齐纠偏 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 恢复旧版 Todo/DataTable 与按钮样式，让日历 Tooltip 展示 Schedule Comment，并修复保留 Grid 的 WeekView 可见性和旧版视觉效果。

**Architecture:** 为日历范围查询增加独立的 `CalendarOccurrenceDto`，显式区分 Schedule Comment 与 Occurrence Comment；Todo 使用旧版 `NDataTable` 渲染模型；WeekView 保留 Grid，但通过 Electron 可见性测试先确认布局根因，再恢复旧版日列和卡片尺寸。所有生产修改均从失败测试开始。

**Tech Stack:** Vue 3、TypeScript strict、Naive UI、Zod、Drizzle SQLite、Vitest、Vue Test Utils、Playwright Electron。

## Global Constraints

- `release/1.2.0` 的 Todo、按钮、MonthView 与 WeekView 是视觉和交互基准。
- 保留 Schedule v2 的 PlatformGateway、浏览器/Electron 双宿主边界和 CSS Grid WeekView。
- Schedule Comment 与 Occurrence Comment 必须保持独立；不得用一个字段覆盖另一个字段。
- 不引入旧 Store、EventBus、Luxon、Electron 类型或 TanStack Query。
- 保留用户未提交的 `AGENTS.md` 修改。

---

### Task 1: 为日历范围建立 Schedule Comment 投影

**Files:**
- Modify: `src/contracts/occurrence.contract.ts`
- Modify: `src/contracts/platform.contract.ts`
- Modify: `src/platform/ports.ts`
- Modify: `src-electron/ipc/schedule-ipc.ts`
- Modify: `src-electron/adapters/db/occurrence-repository.ts`
- Modify: `src/platform/browser/in-memory-gateway.ts`
- Modify: `src/features/schedule/use-occurrence-range.ts`
- Modify: `src/features/schedule/components/OccurrenceTooltip.vue`
- Modify: `src/features/schedule/components/MonthScheduleView.vue`
- Modify: `src/features/schedule/components/WeekScheduleView.vue`
- Test: `tests/contracts/occurrence.contract.test.ts`
- Test: `tests/unit/platform/in-memory-gateway.test.ts`
- Test: `tests/integration/database/occurrence-repository.test.ts`
- Test: `tests/unit/features/occurrence-tooltip.test.ts`

**Interfaces:**
- Produces: `CalendarOccurrenceDtoSchema` and `CalendarOccurrenceDto`, extending a normal occurrence with `scheduleComment: string`.
- Changes: `OccurrenceGateway.listRange` and `OccurrenceRepository.listRange` return `readonly CalendarOccurrenceDto[]`.
- Preserves: `listBySchedule`, `updateComment`, `listTodos`, and `setDone` continue using `ScheduleOccurrenceDto` whose `comment` is the Occurrence Comment.

- [ ] **Step 1: Write failing contract and gateway tests**

Add assertions equivalent to:

```ts
expect(CalendarOccurrenceDtoSchema.safeParse({
  ...baseOccurrence,
  comment: '单次时间片备注',
  scheduleComment: '整个日程备注'
}).success).toBe(true)

const range = await gateway.occurrences.listRange(query)
expect(range.ok && range.value[0]?.scheduleComment).toBe('整个日程备注')
const details = await gateway.occurrences.listBySchedule(scheduleId)
expect(details.ok && details.value[0]?.comment).toBe('')
```

In the Electron repository test, store a schedule whose `comment` is `整个日程备注` and an occurrence whose `comment` is `单次时间片备注`; assert `listRange()[0].scheduleComment` and `listBySchedule()[0].comment` retain the two distinct values.

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/contracts/occurrence.contract.test.ts tests/unit/platform/in-memory-gateway.test.ts tests/integration/database/occurrence-repository.test.ts
```

Expected: FAIL because `CalendarOccurrenceDtoSchema`/`scheduleComment` do not exist and range queries only return occurrence comments.

- [ ] **Step 3: Implement the calendar projection**

Add the explicit contract:

```ts
export const CalendarOccurrenceDtoSchema = ScheduleOccurrenceDtoSchema.safeExtend({
  scheduleComment: z.string().max(20_000)
})

export type CalendarOccurrenceDto = z.infer<typeof CalendarOccurrenceDtoSchema>
```

Change only range-return signatures to `CalendarOccurrenceDto[]`. In the Electron join mapper return both fields:

```ts
comment: occurrence.comment,
scheduleComment: schedule.comment,
```

In the browser gateway, find the owning schedule while mapping range values:

```ts
.map((value) => ({
  ...value,
  scheduleComment: schedules.find(({ id }) => id === value.scheduleId)?.comment ?? ''
}))
```

Update the IPC range output to `z.array(CalendarOccurrenceDtoSchema)`. Type `useOccurrenceRange`, Month/Week props, and `OccurrenceTooltip.item` as `CalendarOccurrenceDto`; render `item.scheduleComment` in the Tooltip footer. Do not change occurrence detail endpoints.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the Task 1 command plus:

```powershell
.\node_modules\.bin\vitest.cmd run tests/unit/features/occurrence-tooltip.test.ts tests/unit/features/occurrence-calendar.test.ts
.\node_modules\.bin\vue-tsc.cmd --noEmit -p tsconfig.app.json
```

Expected: all pass; Tooltip assertion reads `scheduleComment`, while occurrence detail tests still read `comment`.

- [ ] **Step 5: Commit**

```powershell
git add src/contracts/occurrence.contract.ts src/contracts/platform.contract.ts src/platform/ports.ts src-electron/ipc/schedule-ipc.ts src-electron/adapters/db/occurrence-repository.ts src/platform/browser/in-memory-gateway.ts src/features/schedule/use-occurrence-range.ts src/features/schedule/components/OccurrenceTooltip.vue src/features/schedule/components/MonthScheduleView.vue src/features/schedule/components/WeekScheduleView.vue tests/contracts/occurrence.contract.test.ts tests/unit/platform/in-memory-gateway.test.ts tests/integration/database/occurrence-repository.test.ts tests/unit/features/occurrence-tooltip.test.ts tests/unit/features/occurrence-calendar.test.ts
git commit -m "fix(calendar): 区分日程与时间片备注"
```

### Task 2: 恢复旧版 Naive UI Todo DataTable

**Files:**
- Modify: `src/features/schedule/components/TodoSidebar.vue`
- Modify: `tests/unit/features/todo-sidebar.test.ts`
- Modify: `tests/unit/features/home-workspace.test.ts`

**Interfaces:**
- Consumes: existing `formatTodoDeadline()` and `todoTone()`.
- Preserves: `select(scheduleId)`, `done(occurrenceId, done)`, and `concentrate(occurrenceId)` emits.

- [ ] **Step 1: Write failing component tests**

Replace structural expectations for hand-written `NTable` with old DataTable behavior:

```ts
const table = wrapper.findComponent(NDataTable)
expect(table.exists()).toBe(true)
expect(table.props('maxHeight')).toBe('76vh')
expect(table.props('minHeight')).toBe('76vh')
expect(table.props('columns').map((column: { key: string }) => column.key))
  .toEqual(['name', 'end', 'action', 'done'])
expect(table.props('rowClassName')(expiredItem)).toContain('row-expired')
```

Mount the rendered table and keep assertions that Name/Deadline emit `select`, Play emits `concentrate`, and Checkbox emits `done`.

- [ ] **Step 2: Run Todo tests and verify RED**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/unit/features/todo-sidebar.test.ts tests/unit/features/home-workspace.test.ts
```

Expected: FAIL because the component currently renders `NTable` and has no DataTable columns or `rowClassName` prop.

- [ ] **Step 3: Implement the old DataTable structure**

Import `h`, `NDataTable`, and DataTable column types. Build the four columns with render functions, using actual Naive UI components:

```ts
const columns: DataTableColumns<ScheduleOccurrenceDto> = [
  { key: 'name', title: () => title('Name'), render: row => h('span', {
    class: 'todo-link', onClick: () => emit('select', row.scheduleId)
  }, row.title) },
  { key: 'end', title: () => title('Deadline'), render: row => h('span', {
    class: 'todo-link', onClick: () => emit('select', row.scheduleId)
  }, formatTodoDeadline(row.end, props.timeZone)) },
  { key: 'action', title: () => title('Action'), width: '100px', render: row => h(NButton, {
    text: true, style: { fontSize: '20px', padding: '5px 0 0 0' },
    onClick: () => emit('concentrate', row.id)
  }, { default: () => h(NIcon, null, { default: () => h(Play) }) }) },
  { key: 'done', title: () => title('Done'), width: '100px', render: row => h(NCheckbox, {
    checked: row.done, onUpdateChecked: checked => emit('done', row.id, checked)
  }) }
]
```

Render:

```vue
<NDataTable
  :columns="columns"
  :data="visibleItems"
  :row-class-name="rowClassName"
  max-height="76vh"
  min-height="76vh"
/>
```

Restore the old scoped selectors exactly around DataTable rows:

```css
:deep(.row-done span) { color: #ccc; }
:deep(.row-expired span) { color: red !important; }
:deep(.row-tdy span) { color: #f90; }
:deep(.row-tmr span) { color: #000; }
:deep(.row-after-tmr span) { color: #999; }
```

- [ ] **Step 4: Run Todo tests and verify GREEN**

Run the Task 2 command and `vue-tsc`. Expected: all pass and no hand-written `<table>` remains.

- [ ] **Step 5: Commit**

```powershell
git add src/features/schedule/components/TodoSidebar.vue tests/unit/features/todo-sidebar.test.ts tests/unit/features/home-workspace.test.ts
git commit -m "style(todo): 恢复旧版数据表格"
```

### Task 3: 统一恢复四个旧版按钮按下状态

**Files:**
- Modify: `src/features/schedule/components/TodoSidebar.vue`
- Modify: `src/pages/index.vue`
- Modify: `src/assets/styles/main.css`
- Modify: `tests/unit/features/todo-sidebar.test.ts`
- Modify: `tests/unit/features/home-workspace.test.ts`

**Interfaces:**
- Produces: local `activeButtonStyle` objects used through `:style`, matching `release/1.2.0`.

- [ ] **Step 1: Write failing style tests**

After activating each button, assert its inline style contains both legacy declarations:

```ts
expect(button.attributes('style')).toContain('background-color: rgba(0, 14, 28, 0.1)')
expect(button.attributes('style')).toContain('box-shadow: inset 1px 1px 1px 1px rgba(0, 14, 28, 0.6)')
```

Cover one Todo filter and both month/week states. Assert the global `.segmented-control .n-button.active` rule is absent from `main.css`.

- [ ] **Step 2: Run tests and verify RED**

Run the two Task 2 test files. Expected: FAIL because current buttons depend on the global `active` class.

- [ ] **Step 3: Implement old inline state**

Use the same value in both components:

```ts
const activeButtonStyle = {
  backgroundColor: 'rgba(0, 14, 28, 0.1)',
  boxShadow: '1px 1px 1px 1px rgba(0, 14, 28, 0.6) inset'
}
```

Bind `:style="condition ? activeButtonStyle : undefined"` to each button and remove the global active rule. Do not add new button wrappers or custom borders.

- [ ] **Step 4: Run tests and verify GREEN**

Run the Task 3 tests and `vue-tsc`. Expected: all pass.

- [ ] **Step 5: Commit**

```powershell
git add src/features/schedule/components/TodoSidebar.vue src/pages/index.vue src/assets/styles/main.css tests/unit/features/todo-sidebar.test.ts tests/unit/features/home-workspace.test.ts
git commit -m "style(ui): 恢复旧版按钮按下状态"
```

### Task 4: 复现并修复 Grid WeekView 空白

**Files:**
- Modify: `tests/e2e/electron/schedule-ui.spec.ts`
- Modify: `src/pages/index.vue`
- Modify: `src/features/schedule/components/WeekScheduleView.vue`
- Modify: `tests/unit/features/home-workspace.test.ts`
- Modify: `tests/unit/features/occurrence-calendar.test.ts`

**Interfaces:**
- Consumes: Task 1 `CalendarOccurrenceDto.scheduleComment`.
- Preserves: Grid day columns, logical-day assignment, stable palette, local drag offsets, and `select(scheduleId)`.

- [ ] **Step 1: Add an Electron visibility and Tooltip regression test**

In the isolated Electron test, create a dated event with `Comment = '周视图备注'`, click `week`, then assert real layout boxes:

```ts
const week = window.getByTestId('week-view')
await expect(week).toBeVisible()
const weekBox = await week.boundingBox()
expect(weekBox?.height).toBeGreaterThan(400)

const columns = week.locator('.day-card')
expect(await columns.count()).toBe(5)
for (const column of await columns.all()) {
  expect((await column.boundingBox())?.height).toBeGreaterThan(400)
}

const card = week.getByRole('button', { name: /周视图回归/ })
await expect(card).toBeVisible()
expect((await card.boundingBox())?.height).toBeGreaterThan(0)
await card.hover()
await expect(window.getByText('周视图备注')).toBeVisible()
```

Use the current UTC date in the recurrence string so the test remains valid across months.

- [ ] **Step 2: Build and run the Electron test to verify RED**

Run:

```powershell
pnpm build:web
pnpm build:electron
.\node_modules\.bin\playwright.cmd test tests/e2e/electron/schedule-ui.spec.ts
```

Expected: FAIL at the first zero/short WeekView, day-column, card, or Tooltip visibility assertion. Record actual bounding boxes in the failure before changing production CSS.

- [ ] **Step 3: Write focused unit expectations for the confirmed root cause**

Add the smallest structural/style assertion matching the Electron evidence—for example, if the nested layout scroll container has no definite height:

```ts
expect(wrapper.get('.workspace-content').attributes('style')).toContain('height: 100%')
expect(wrapper.get('[data-testid="week-view"]').classes()).toContain('week-view')
```

If the event positioning containing block is wrong, assert every `.day-card` is positioned and every event card is its absolute child. The unit test must fail for the exact observed cause, not a guessed CSS property.

- [ ] **Step 4: Implement the minimal Grid layout correction and legacy visual rules**

Keep `display: grid` and restore the old visual measurements:

```css
.week-view {
  display: grid;
  flex: 1 1 0;
  min-block-size: 0;
}
.day-card {
  position: relative;
  min-block-size: 0;
  overflow: hidden;
  border: 1px solid #eee;
  border-radius: 4px;
  text-align: center;
}
.day-card header {
  block-size: 4.8vh;
  line-height: 4.8vh;
  padding: 0;
  border-block-end: 1px solid #eee;
  background: #fafafc;
}
.event-card {
  position: absolute;
  inset-inline: 0;
  display: flex;
  justify-content: space-between;
  inline-size: 100%;
  padding-inline: 10px;
  overflow: hidden;
  border-radius: 4px;
  box-sizing: border-box;
}
```

Adjust the parent height or event `insetBlockStart` calculation only according to the Step 2 evidence. Preserve logical day and color helpers.

- [ ] **Step 5: Verify focused unit and Electron tests GREEN**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/unit/features/home-workspace.test.ts tests/unit/features/occurrence-calendar.test.ts tests/unit/features/week-presentation.test.ts
pnpm build:web
pnpm build:electron
.\node_modules\.bin\playwright.cmd test tests/e2e/electron/schedule-ui.spec.ts
```

Expected: all pass; real Electron boxes are non-zero and Tooltip shows Schedule Comment.

- [ ] **Step 6: Commit**

```powershell
git add tests/e2e/electron/schedule-ui.spec.ts src/pages/index.vue src/features/schedule/components/WeekScheduleView.vue tests/unit/features/home-workspace.test.ts tests/unit/features/occurrence-calendar.test.ts
git commit -m "fix(calendar): 恢复周视图可见布局"
```

### Task 5: 完整回归与工作区审计

**Files:**
- Verify only; modify no production files unless a test exposes an in-scope regression.

- [ ] **Step 1: Run Web quality gates**

```powershell
.\node_modules\.bin\eslint.cmd .
.\node_modules\.bin\vue-tsc.cmd --noEmit -p tsconfig.app.json
.\node_modules\.bin\vitest.cmd run tests/unit tests/contracts tests/parser
.\node_modules\.bin\vite.cmd build
```

Expected: all exit 0; only the existing Vite chunk-size warning is acceptable.

- [ ] **Step 2: Run Electron quality gates**

```powershell
pnpm electron:rebuild-native
pnpm build:electron
.\node_modules\.bin\playwright.cmd test tests/e2e/electron/schedule-ui.spec.ts
```

Expected: native rebuild, Electron build, and all target E2E tests pass.

- [ ] **Step 3: Audit Git state**

```powershell
git diff --check
git status --short
```

Expected: no whitespace errors; only the user's pre-existing `M AGENTS.md` remains uncommitted.
