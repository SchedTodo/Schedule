# 首页与日历旧版行为对齐实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Schedule v2 中恢复首页 Todo、月视图、周视图、新增表单和图标的旧版行为，并修复月末工作日与逻辑日归属错误。

**Architecture:** 保留现有 PlatformGateway、Occurrence DTO、Vue 页面和 Naive UI 边界。解析层在 recurrence period 内应用 `setpos`；展示层用纯函数计算 Todo 状态、逻辑日和稳定色板，Vue 组件只渲染并发出既有事件。

**Tech Stack:** Node.js 24 LTS、pnpm 11.11.0、TypeScript 6 strict、Vue 3、Naive UI、Temporal、ANTLR、Vitest、Vue Test Utils、Playwright。

## Global Constraints

- `release/1.2.0` 仅作为不可修改的旧版参考。
- `main` 是 Schedule v2 开发线。
- `src` 必须保持浏览器可运行且平台无关。
- 不引入 TanStack Query、Luxon、旧 Store/EventBus 或 Electron 类型。
- 行为修改严格执行 RED → GREEN → REFACTOR。
- 不修改或提交当前用户的 `AGENTS.md` 变更。
- 新提交使用 Conventional Commit 类型和简体中文描述。

---

### Task 1: 正确应用 recurrence `setpos`

**Files:**
- Modify: `tests/parser/occurrence-compatibility.test.ts`
- Modify: `src/domain/schedule/occurrence.ts`

**Interfaces:**
- Consumes: `EvaluatedStatement.frequency`、`EvaluatedStatement.by`、起止 `Temporal.PlainDate`。
- Produces: `expandScheduleSpec(spec): readonly ScheduleOccurrenceDraft[]`；公开签名不变。

- [ ] **Step 1: 写入失败的月频率位置测试**

在 `tests/parser/occurrence-compatibility.test.ts` 增加：

```ts
it('applies setpos after collecting each monthly weekday candidate set', () => {
  const values = expand(
    '2026/7/1-8/31 17:00-18:00 monthly by[day[1,2,3,4,5],setpos[-1]];'
  )

  expect(values.map(({ start }) => start)).toEqual([
    '2026-07-31T09:00:00Z',
    '2026-08-31T09:00:00Z'
  ])
})

it('supports positive setpos values without duplicating candidates', () => {
  const values = expand(
    '2026/7/1-8/31 17:00-18:00 monthly by[day[1,2,3,4,5],setpos[1,1]];'
  )

  expect(values.map(({ start }) => start)).toEqual([
    '2026-07-01T09:00:00Z',
    '2026-08-03T09:00:00Z'
  ])
})
```

- [ ] **Step 2: 运行测试并确认 RED**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/parser/occurrence-compatibility.test.ts
```

Expected: 两个新增测试失败；第一个返回每个工作日，第二个不按每月候选集选取。

- [ ] **Step 3: 在月候选集上应用位置选择**

在 `src/domain/schedule/occurrence.ts` 中让普通 `matchesBy` 跳过 `setpos`，并加入：

```ts
function selectPositions(
  values: readonly Temporal.PlainDate[],
  positions: readonly number[] | undefined
): readonly Temporal.PlainDate[] {
  if (positions === undefined) return values
  const selected = new Map<string, Temporal.PlainDate>()
  for (const position of positions) {
    const index = position > 0 ? position - 1 : values.length + position
    const value = values[index]
    if (value !== undefined) selected.set(value.toString(), value)
  }
  return [...selected.values()].sort(Temporal.PlainDate.compare)
}

function monthlyDates(
  statement: EvaluatedStatement,
  start: Temporal.PlainDate,
  end: Temporal.PlainDate
): readonly Temporal.PlainDate[] {
  const values: Temporal.PlainDate[] = []
  let month = start.with({ day: 1 })
  const lastMonth = end.with({ day: 1 })

  while (Temporal.PlainDate.compare(month, lastMonth) <= 0) {
    const monthOffset = (month.year - start.year) * 12 + month.month - start.month
    if (monthOffset % statement.frequency.interval === 0) {
      const candidates: Temporal.PlainDate[] = []
      for (let day = 1; day <= month.daysInMonth; day += 1) {
        const candidate = month.with({ day })
        if (matchesBy(candidate, statement.by)) candidates.push(candidate)
      }
      for (const candidate of selectPositions(candidates, statement.by.setpos)) {
        if (
          Temporal.PlainDate.compare(candidate, start) >= 0 &&
          Temporal.PlainDate.compare(candidate, end) <= 0
        ) {
          values.push(candidate)
          if (statement.frequency.count !== undefined && values.length >= statement.frequency.count) {
            return values
          }
        }
      }
    }
    month = month.add({ months: 1 })
  }
  return values
}
```

在 `dates()` 中，当 frequency 为 `monthly` 且存在 `by.setpos` 时返回 `monthlyDates(statement, start, end)`；其他规则继续使用现有逐日路径。不要修改 AST、evaluator 或 serializer。

- [ ] **Step 4: 运行 focused 与 parser 回归测试**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/parser/occurrence-compatibility.test.ts tests/parser/normalization.test.ts tests/parser/semantic.test.ts
```

Expected: PASS，且用例 15 仅产生 2026-07-31 和 2026-08-31。

- [ ] **Step 5: 提交解析修复**

```powershell
git add src/domain/schedule/occurrence.ts tests/parser/occurrence-compatibility.test.ts
git commit -m "fix(parser): 正确应用月频率位置筛选"
```

---

### Task 2: 恢复旧版矢量图标、工具栏和内容高度骨架

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `tests/unit/ui-source-conventions.test.ts`
- Modify: `tests/unit/app-shell.test.ts`
- Modify: `tests/unit/features/home-workspace.test.ts`
- Modify: `src/app/components/AppShell.vue`
- Modify: `src/features/ideas/IdeaPane.vue`
- Modify: `src/features/schedule/components/TodoSidebar.vue`
- Modify: `src/pages/index.vue`
- Modify: `src/assets/styles/main.css`

**Interfaces:**
- Produces: 导航、用户、Play、灯泡的 Naive UI `NIcon` 图标。
- Produces: `.segmented-control` 与 `.active` 共用按下态；`.workspace-content` 占满内容区。

- [ ] **Step 1: 写入 Emoji 与工具栏失败测试**

在 `tests/unit/ui-source-conventions.test.ts` 增加：

```ts
it('does not use text or emoji glyphs as application icons', () => {
  const forbidden = ['⌂', '◉', '⚙', '💡', '▶', '↻']
  const violations = Object.entries(currentUiModules)
    .filter(([, source]) => forbidden.some((glyph) => source.includes(glyph)))
    .map(([path]) => path)

  expect(violations).toEqual([])
})
```

在 `tests/unit/app-shell.test.ts` 的首个测试增加：

```ts
expect(wrapper.findAll('.navigation-icon.n-icon')).toHaveLength(4)
expect(wrapper.get('[aria-label="Idea"]').find('.n-icon').exists()).toBe(true)
```

在 `tests/unit/features/home-workspace.test.ts` 的首页测试增加：

```ts
expect(wrapper.find('[aria-label="Sync"]').exists()).toBe(false)
expect(wrapper.get('.workspace-content').classes()).toContain('workspace-content')
```

- [ ] **Step 2: 运行三个 focused 测试并确认 RED**

```powershell
.\node_modules\.bin\vitest.cmd run tests/unit/ui-source-conventions.test.ts tests/unit/app-shell.test.ts tests/unit/features/home-workspace.test.ts
```

Expected: FAIL，列出当前文本/Emoji 图标、Sync 按钮及缺少的高度容器。

- [ ] **Step 3: 安装旧版对应图标组件**

```powershell
pnpm add @vicons/ionicons5@latest @vicons/tabler@latest @vicons/antd@latest
```

在 `AppShell.vue` 使用 `HomeOutline`、`SettingsOutline`、`HelpCircleOutline`、Tabler `Database` 和 Ant Design `UserOutlined`；navigation 的 `icon` 字段改为 Vue component，并用：

```vue
<NIcon class="navigation-icon" aria-hidden="true">
  <component :is="item.icon" />
</NIcon>
```

Guest avatar 内使用 `UserOutlined`。`IdeaPane.vue` 使用 Ionicons `Bulb`：

```vue
<NButton text color="#ffe21e" class="idea-trigger" aria-label="Idea" @click="show = !show">
  <NIcon><Bulb /></NIcon>
</NButton>
```

`TodoSidebar.vue` 暂时只把文本 Play 替换为 `NIcon` + `Play`，其余 Todo 重构留给 Task 3。

- [ ] **Step 4: 统一首页工具栏和高度容器**

在 `src/pages/index.vue`：

- 用 `NButtonGroup class="segmented-control"` 和两个 `NButton` 渲染 month/week。
- 删除 `.sync-placeholder` 按钮。
- 在 `NLayoutContent` 内新增 `<div class="workspace-content">` 包住 toolbar 和当前视图。

对应 scoped CSS 使用：

```css
.schedule-workspace { block-size: 100%; overflow: hidden; }
.workspace-content { display: flex; flex-direction: column; block-size: 100%; padding: 2vh 3vw; overflow: hidden; }
.home-toolbar { display: flex; flex: none; gap: 1vw; padding-block-end: 1vh; }
```

在 `main.css` 保证 `.application-content` 和它的 scroll container 都有 `block-size: 100%`、`min-block-size: 0`，并加入可被首页与 Todo 共同使用的非 scoped 样式：

```css
.segmented-control .n-button.active {
  background: rgb(0 14 28 / 10%);
  box-shadow: 1px 1px 1px 1px rgb(0 14 28 / 60%) inset;
}
```

- [ ] **Step 5: 运行 focused 测试和类型检查**

```powershell
.\node_modules\.bin\vitest.cmd run tests/unit/ui-source-conventions.test.ts tests/unit/app-shell.test.ts tests/unit/features/home-workspace.test.ts
.\node_modules\.bin\vue-tsc.cmd --noEmit -p tsconfig.app.json
```

Expected: PASS；当前 UI 不含被禁止的图标字符，Sync 不再存在。

- [ ] **Step 6: 提交图标与骨架修复**

```powershell
git add package.json pnpm-lock.yaml src/app/components/AppShell.vue src/features/ideas/IdeaPane.vue src/features/schedule/components/TodoSidebar.vue src/pages/index.vue src/assets/styles/main.css tests/unit/ui-source-conventions.test.ts tests/unit/app-shell.test.ts tests/unit/features/home-workspace.test.ts
git commit -m "style(ui): 恢复旧版图标与首页工具栏"
```

---

### Task 3: 恢复 Todo 状态、格式和交互

**Files:**
- Create: `src/features/schedule/todo-presentation.ts`
- Create: `tests/unit/features/todo-presentation.test.ts`
- Create: `tests/unit/features/todo-sidebar.test.ts`
- Modify: `src/features/schedule/components/TodoSidebar.vue`

**Interfaces:**
- Produces: `todoTone(end: string, done: boolean, timeZone: string, now?: Temporal.Instant): 'expired' | 'done' | 'today' | 'tomorrow' | 'future'`。
- Produces: `formatTodoDeadline(end: string, timeZone: string): string`。
- `TodoSidebar` 新增可选 `now?: string` prop；既有 emits 不变。

- [ ] **Step 1: 写入纯函数失败测试**

创建 `tests/unit/features/todo-presentation.test.ts`：

```ts
import { Temporal } from '../../../src/domain/shared/temporal'
import { formatTodoDeadline, todoTone } from '../../../src/features/schedule/todo-presentation'

const now = Temporal.Instant.from('2026-07-13T04:00:00Z') // Asia/Shanghai 12:00

it.each([
  ['2026-07-13T03:59:00Z', false, 'expired'],
  ['2026-07-13T14:00:00Z', false, 'today'],
  ['2026-07-14T04:00:00Z', false, 'tomorrow'],
  ['2026-07-15T04:00:00Z', false, 'future'],
  ['2026-07-13T14:00:00Z', true, 'done'],
  ['2026-07-13T03:59:00Z', true, 'expired']
] as const)('classifies %s as %s', (end, done, expected) => {
  expect(todoTone(end, done, 'Asia/Shanghai', now)).toBe(expected)
})

it('formats the legacy deadline without seconds or locale punctuation', () => {
  expect(formatTodoDeadline('2026-07-13T15:30:00Z', 'Asia/Shanghai')).toBe('07-13 23:30')
})
```

- [ ] **Step 2: 运行纯函数测试并确认 RED**

```powershell
.\node_modules\.bin\vitest.cmd run tests/unit/features/todo-presentation.test.ts
```

Expected: FAIL，因为模块尚不存在。

- [ ] **Step 3: 实现最小 Todo 展示函数**

创建 `src/features/schedule/todo-presentation.ts`：

```ts
import { Temporal } from '../../domain/shared/temporal'

export type TodoTone = 'expired' | 'done' | 'today' | 'tomorrow' | 'future'

export function todoTone(
  end: string,
  done: boolean,
  timeZone: string,
  now: Temporal.Instant = Temporal.Now.instant()
): TodoTone {
  const deadline = Temporal.Instant.from(end)
  if (Temporal.Instant.compare(deadline, now) < 0) return 'expired'
  if (done) return 'done'
  const today = now.toZonedDateTimeISO(timeZone).toPlainDate()
  const deadlineDate = deadline.toZonedDateTimeISO(timeZone).toPlainDate()
  const days = today.until(deadlineDate, { largestUnit: 'days' }).days
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  return 'future'
}

export function formatTodoDeadline(end: string, timeZone: string): string {
  const value = Temporal.Instant.from(end).toZonedDateTimeISO(timeZone)
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${pad(value.month)}-${pad(value.day)} ${pad(value.hour)}:${pad(value.minute)}`
}
```

- [ ] **Step 4: 写入侧栏渲染与双入口失败测试**

创建 `tests/unit/features/todo-sidebar.test.ts`，构造过期、今天、明天、未来和完成的 occurrence DTO，并断言：

```ts
const wrapper = mount(TodoSidebar, {
  props: {
    items,
    timeZone: 'Asia/Shanghai',
    now: '2026-07-13T04:00:00Z'
  }
})

expect(wrapper.get('[data-todo-tone="expired"]').classes()).toContain('todo-expired')
expect(wrapper.get('[data-todo-tone="today"]').text()).toContain('07-13 23:30')
expect(wrapper.get('[data-todo-tone="tomorrow"]').classes()).toContain('todo-tomorrow')
expect(wrapper.get('[data-todo-tone="future"]').classes()).toContain('todo-future')
expect(wrapper.get('[data-todo-tone="done"]').classes()).toContain('todo-done')

await wrapper.get('[data-action="name"]').trigger('click')
await wrapper.get('[data-action="deadline"]').trigger('click')
expect(wrapper.emitted('select')).toEqual([[items[0]!.scheduleId], [items[0]!.scheduleId]])
expect(wrapper.get('[aria-label="Concentrate"]').find('.n-icon').exists()).toBe(true)
```

再点击 `Not Expired` 与 `Not Done`，断言 `.active` 与过滤结果；点击 checkbox，断言 `done` emit。

- [ ] **Step 5: 运行侧栏测试并确认 RED**

```powershell
.\node_modules\.bin\vitest.cmd run tests/unit/features/todo-sidebar.test.ts
```

Expected: FAIL，因为旧版 tone class、格式、Deadline 点击入口和 Naive UI 表格结构尚未实现。

- [ ] **Step 6: 用 Naive UI 组件重写侧栏模板**

`TodoSidebar.vue` 使用 `NButtonGroup`、`NButton`、`NTable`、`NIcon`、`NCheckbox` 和 `NEmpty`。每行计算：

```ts
const nowInstant = computed(() => props.now === undefined
  ? Temporal.Now.instant()
  : Temporal.Instant.from(props.now))

function tone(item: ScheduleOccurrenceDto) {
  return todoTone(item.end, item.done, props.timeZone, nowInstant.value)
}
```

行模板必须包含 `:data-todo-tone="tone(item)"` 和 `:class="`todo-${tone(item)}`"`。Name、Deadline 使用 text `NButton`；Action 使用 `Play`；Done 使用 `NCheckbox`。样式为：

```css
.todo-name { min-inline-size: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.todo-deadline { white-space: nowrap; }
.todo-expired :deep(.todo-content) { color: red !important; }
.todo-today :deep(.todo-content) { color: #f90; }
.todo-tomorrow :deep(.todo-content) { color: #000; }
.todo-future :deep(.todo-content),
.todo-done :deep(.todo-content) { color: #999; }
```

筛选按钮复用 `segmented-control` 与 `active` 类。

- [ ] **Step 7: 运行 Todo、首页和类型测试**

```powershell
.\node_modules\.bin\vitest.cmd run tests/unit/features/todo-presentation.test.ts tests/unit/features/todo-sidebar.test.ts tests/unit/features/home-workspace.test.ts
.\node_modules\.bin\vue-tsc.cmd --noEmit -p tsconfig.app.json
```

Expected: PASS。

- [ ] **Step 8: 提交 Todo 修复**

```powershell
git add src/features/schedule/todo-presentation.ts src/features/schedule/components/TodoSidebar.vue tests/unit/features/todo-presentation.test.ts tests/unit/features/todo-sidebar.test.ts
git commit -m "fix(todo): 恢复旧版截止状态与交互"
```

---

### Task 4: 使用 Naive UI 表单规则标记并校验必填项

**Files:**
- Modify: `tests/unit/features/home-workspace.test.ts`
- Modify: `src/features/schedule/components/ScheduleModal.vue`

**Interfaces:**
- Existing emit: `submit: [CreateScheduleInput]` 不变。
- Name 与 recurrenceCode 必填；exclusionCode 与 comment 可选。

- [ ] **Step 1: 写入必填状态失败测试**

在 modal 测试中打开弹窗并增加：

```ts
await wrapper.get('button').trigger('click')
await wrapper.get('button[type="button"]:last-of-type').trigger('click')
await vi.waitFor(() => {
  expect(wrapper.text()).toContain('Please input name')
  expect(wrapper.text()).toContain('Please input rTime')
})
expect(wrapper.findAll('.n-input--error-status')).toHaveLength(2)
expect(wrapper.emitted('submit')).toBeUndefined()
expect(wrapper.findAll('.n-form-item-label__asterisk')).toHaveLength(2)
```

保留现有成功提交断言，并确认空 exTime、Comment 仍可提交。

- [ ] **Step 2: 运行 modal 测试并确认 RED**

```powershell
.\node_modules\.bin\vitest.cmd run tests/unit/features/home-workspace.test.ts
```

Expected: FAIL；当前只有统一 alert，没有两个字段的错误状态和必填标记。

- [ ] **Step 3: 接入 `NForm` rules 与 form ref**

`ScheduleModal.vue` 改用：

```ts
import type { FormInst, FormRules } from 'naive-ui'
import { reactive, ref } from 'vue'

const formRef = ref<FormInst | null>(null)
const model = reactive({ title: '', recurrenceCode: '', exclusionCode: '', comment: '' })
const rules: FormRules = {
  title: [{ required: true, message: 'Please input name', trigger: ['input', 'blur'] }],
  recurrenceCode: [{ required: true, message: 'Please input rTime', trigger: ['input', 'blur'] }]
}

async function submit() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  emit('submit', {
    title: model.title.trim(),
    recurrenceCode: model.recurrenceCode,
    exclusionCode: model.exclusionCode,
    comment: model.comment
  })
  show.value = false
}
```

`NForm` 设置 `ref="formRef" :model="model" :rules="rules"`；四个 `NFormItem` 分别设置 `path`，前两个保留 required rule。Confirm 明确 `attr-type="button"`，Ctrl+Enter 调用相同 async `submit()`。

- [ ] **Step 4: 运行 focused 测试与类型检查**

```powershell
.\node_modules\.bin\vitest.cmd run tests/unit/features/home-workspace.test.ts
.\node_modules\.bin\vue-tsc.cmd --noEmit -p tsconfig.app.json
```

Expected: PASS。

- [ ] **Step 5: 提交表单校验**

```powershell
git add src/features/schedule/components/ScheduleModal.vue tests/unit/features/home-workspace.test.ts
git commit -m "fix(schedule): 标记并校验新增必填项"
```

---

### Task 5: 恢复月卡片单行与旧版 Tooltip

**Files:**
- Create: `src/features/schedule/components/OccurrenceTooltip.vue`
- Create: `tests/unit/features/occurrence-tooltip.test.ts`
- Modify: `src/features/schedule/occurrence-time.ts`
- Modify: `src/features/schedule/components/MonthScheduleView.vue`
- Modify: `tests/unit/features/occurrence-calendar.test.ts`

**Interfaces:**
- Produces: `formatMarkedWallClock(instant, mark, timeZone): string`。
- Produces: `formatOccurrenceRange(item, timeZone): string`。
- Produces: `OccurrenceTooltip` props `{ item, timeZone }` 与默认 trigger slot。

- [ ] **Step 1: 写入格式与 Tooltip 失败测试**

在 occurrence time 测试中断言未知分钟：

```ts
expect(formatMarkedWallClock('2026-07-15T02:00:00Z', '10', 'Asia/Shanghai')).toBe('10:?')
```

创建 `occurrence-tooltip.test.ts`，stub `NTooltip` 以同时渲染 default/header/footer slots，断言标题、`7/13 09:30–11:30` 和长备注均出现。

在 `occurrence-calendar.test.ts` 增加：

```ts
const month = mount(MonthScheduleView, { props: { items: occurrences, timeZone: 'UTC' } })
expect(month.get('.schedule-name').classes()).toContain('schedule-name')
expect(month.get('.schedule-time').text()).toBe('10:00')
expect(month.get('[data-testid="month-view"]').classes()).toContain('month-view')
```

- [ ] **Step 2: 运行测试并确认 RED**

```powershell
.\node_modules\.bin\vitest.cmd run tests/unit/features/occurrence-time.test.ts tests/unit/features/occurrence-tooltip.test.ts tests/unit/features/occurrence-calendar.test.ts
```

Expected: FAIL，因为共享格式函数与 Tooltip 组件不存在。

- [ ] **Step 3: 实现共享时间文本与 Tooltip**

在 `occurrence-time.ts` 增加：

```ts
import type { KnownTimeMark, ScheduleOccurrenceDto } from '../../contracts/occurrence.contract'

export function formatMarkedWallClock(instant: string, mark: KnownTimeMark, timeZone: string): string {
  const value = occurrenceWallTime(instant, timeZone)
  const [hour, minute] = formatWallClock(value).split(':')
  return `${mark[0] === '1' ? hour : '?'}:${mark[1] === '1' ? minute : '?'}`
}

export function formatOccurrenceRange(item: ScheduleOccurrenceDto, timeZone: string): string {
  if (item.start === null) return formatMarkedWallClock(item.end, item.endMark, timeZone)
  return `${formatMarkedWallClock(item.start, item.startMark, timeZone)}–${formatMarkedWallClock(item.end, item.endMark, timeZone)}`
}
```

`OccurrenceTooltip.vue` 使用 `NTooltip trigger="hover"`，header 为 title，default 为本地 `M/D` 加 range，footer 为保留换行的 comment，并将默认 slot 放入 trigger。

- [ ] **Step 4: 月视图使用 Tooltip 并填满容器**

`MonthScheduleView.vue` 用 `OccurrenceTooltip` 包裹每个 button，并将内容改为：

```vue
<span class="schedule-name">{{ item.title }}</span>
<span class="schedule-time">{{ timeLabel(item) }}</span>
```

CSS：

```css
.month-view { flex: 1; block-size: 100%; min-block-size: 0; overflow: hidden; }
.month-view :deep(.n-calendar) { block-size: 100%; }
.schedule-card { flex-wrap: nowrap; overflow: hidden; box-shadow: 0 0 4px #eee; }
.schedule-name { min-inline-size: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.schedule-time { flex: none; white-space: nowrap; }
.schedule-card:hover { inline-size: auto; border-color: #18a058; background: var(--color-surface); transition: all 0.2s ease-in-out; }
```

- [ ] **Step 5: 运行 focused 测试与 Web build**

```powershell
.\node_modules\.bin\vitest.cmd run tests/unit/features/occurrence-time.test.ts tests/unit/features/occurrence-tooltip.test.ts tests/unit/features/occurrence-calendar.test.ts
.\node_modules\.bin\vite.cmd build
```

Expected: PASS；空月视图仍有完整容器高度。

- [ ] **Step 6: 提交月视图修复**

```powershell
git add src/features/schedule/occurrence-time.ts src/features/schedule/components/OccurrenceTooltip.vue src/features/schedule/components/MonthScheduleView.vue tests/unit/features/occurrence-time.test.ts tests/unit/features/occurrence-tooltip.test.ts tests/unit/features/occurrence-calendar.test.ts
git commit -m "style(calendar): 恢复月卡片与悬浮详情"
```

---

### Task 6: 恢复周视图逻辑日、色板和悬浮效果

**Files:**
- Create: `src/features/schedule/week-presentation.ts`
- Create: `tests/unit/features/week-presentation.test.ts`
- Modify: `src/features/schedule/components/WeekScheduleView.vue`
- Modify: `src/pages/index.vue`
- Modify: `tests/unit/features/occurrence-calendar.test.ts`
- Modify: `tests/unit/features/home-workspace.test.ts`

**Interfaces:**
- Produces: `logicalDateForInstant(instant, timeZone, startHour, startMinute): string`。
- Produces: `scheduleColor(scheduleId): string`，返回旧版色板中的稳定 hex 色。
- `WeekScheduleView` 新增 `startMinute?: number`，默认 0；既有 props/emits 保持兼容。

- [ ] **Step 1: 写入逻辑日与稳定色板失败测试**

创建 `tests/unit/features/week-presentation.test.ts`：

```ts
expect(logicalDateForInstant('2026-07-17T16:00:00Z', 'Asia/Shanghai', 6, 0))
  .toBe('2026-07-17') // 当地 7/18 00:00 属于前一个逻辑日
expect(logicalDateForInstant('2026-07-17T22:00:00Z', 'Asia/Shanghai', 6, 0))
  .toBe('2026-07-18')
expect(scheduleColor('10000000-0000-4000-8000-000000000001'))
  .toBe(scheduleColor('10000000-0000-4000-8000-000000000001'))
expect(scheduleColor('10000000-0000-4000-8000-000000000001')).toMatch(/^#[0-9A-Fa-f]{6}$/)
```

在 `occurrence-calendar.test.ts` 构造 `start: '2026-07-17T16:00:00Z'`、`end: '2026-07-18T15:59:00Z'` 的全天实例，使用 `startDate="2026-07-17" dayCount=1 startHour=6`，断言卡片存在于该列。

- [ ] **Step 2: 运行测试并确认 RED**

```powershell
.\node_modules\.bin\vitest.cmd run tests/unit/features/week-presentation.test.ts tests/unit/features/occurrence-calendar.test.ts
```

Expected: FAIL；当前仅按墙钟日分列且全部卡片固定绿色。

- [ ] **Step 3: 实现逻辑日与稳定色板纯函数**

创建 `week-presentation.ts`：

```ts
import { Temporal } from '../../domain/shared/temporal'

const colors = [
  '#f56c6c', '#e6a23c', '#409eff', '#67c23a', '#909399',
  '#FFC0CB', '#E6E6FA', '#00BFFF', '#FF7F50', '#98FB98',
  '#87CEEB', '#FFFF00', '#800080', '#FFB6C1', '#808000'
] as const

export function logicalDateForInstant(
  instant: string,
  timeZone: string,
  startHour: number,
  startMinute: number
): string {
  const wall = Temporal.Instant.from(instant).toZonedDateTimeISO(timeZone)
  const beforeStart = wall.hour < startHour || (wall.hour === startHour && wall.minute < startMinute)
  return wall.toPlainDate().subtract({ days: beforeStart ? 1 : 0 }).toString()
}

export function scheduleColor(scheduleId: string): string {
  let hash = 0
  for (const character of scheduleId) hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  return colors[hash % colors.length]!
}
```

- [ ] **Step 4: 周组件应用逻辑日、位置、色板和 Tooltip**

在 `WeekScheduleView.vue`：

- `occursOn` 改用 `logicalDateForInstant`。
- 位置分钟改为 `((wallMinutes - logicalStartMinutes) + 1440) % 1440`。
- 颜色使用 `scheduleColor(item.scheduleId)`；默认 `backgroundColor: `${color}65``、`border: `1.5px solid ${color}``。
- 用 reactive `hovered` set/map 记录 hover；hover 时背景后缀 `90`、`zIndex: 999`、`boxShadow: '5px 5px 10px #eee'`。
- 使用 `OccurrenceTooltip` 包住每张卡片。
- 保留原有 drag start/end map 和 click emit。
- `.week-view` 使用 `flex: 1; block-size: 100%; min-block-size: 0`，列设置 `overflow: hidden`。
- grid columns 改为 `:style="{ gridTemplateColumns: `repeat(${dayCount}, minmax(0, 1fr))` }"`。

`src/pages/index.vue` 传入 `:start-minute="appSettings.logicalDayStartMinute"`。

- [ ] **Step 5: 写入 hover 与透明度断言**

在 `occurrence-calendar.test.ts`：

```ts
const card = wrapper.get('[data-occurrence-id]')
expect(card.attributes('style')).toMatch(/background-color: #[0-9a-f]{6}65/i)
expect(card.attributes('style')).toMatch(/border: 1\.5px solid #[0-9a-f]{6}/i)
await card.trigger('mouseenter')
expect(card.attributes('style')).toMatch(/background-color: #[0-9a-f]{6}90/i)
expect(card.attributes('style')).toContain('z-index: 999')
await card.trigger('mouseleave')
expect(card.attributes('style')).not.toContain('z-index: 999')
```

- [ ] **Step 6: 运行周视图、拖动和类型测试**

```powershell
.\node_modules\.bin\vitest.cmd run tests/unit/features/week-presentation.test.ts tests/unit/features/occurrence-calendar.test.ts tests/unit/features/home-workspace.test.ts tests/unit/features/occurrence-tooltip.test.ts
.\node_modules\.bin\vue-tsc.cmd --noEmit -p tsconfig.app.json
```

Expected: PASS；全天实例显示在 7/17，原有拖动测试仍通过。

- [ ] **Step 7: 提交周视图修复**

```powershell
git add src/features/schedule/week-presentation.ts src/features/schedule/components/WeekScheduleView.vue src/pages/index.vue tests/unit/features/week-presentation.test.ts tests/unit/features/occurrence-calendar.test.ts tests/unit/features/home-workspace.test.ts
git commit -m "fix(calendar): 恢复周视图逻辑日与悬浮色板"
```

---

### Task 7: 完整回归与 Electron 首页验收

**Files:**
- Modify only if a locator must follow the approved accessible UI: `tests/e2e/electron/schedule-ui.spec.ts`
- No production changes unless a failing verification reveals a root cause covered by this design。

**Interfaces:**
- Produces: 可重复的 parser、unit、contract、Web build 与 Electron UI 验证证据。

- [ ] **Step 1: 运行项目规定的 Web 基线**

```powershell
.\node_modules\.bin\eslint.cmd .
.\node_modules\.bin\vue-tsc.cmd --noEmit -p tsconfig.app.json
.\node_modules\.bin\vitest.cmd run tests/unit tests/contracts tests/parser
.\node_modules\.bin\vite.cmd build
```

Expected: 四条命令均 exit 0，无 lint、类型、测试或构建错误。

- [ ] **Step 2: 验证生成 parser 未漂移**

```powershell
pnpm parser:check-generated
```

Expected: exit 0，`src/parser/generated` 无 diff。

- [ ] **Step 3: 运行首页 Electron UI 测试**

```powershell
pnpm electron:rebuild-native
pnpm build:web
pnpm build:electron
.\node_modules\.bin\playwright.cmd test tests/e2e/electron/schedule-ui.spec.ts
```

Expected: Electron 启动、Add 创建和重启持久化场景通过；renderer 仍无 Node `process`。

- [ ] **Step 4: 检查需求与 diff 范围**

```powershell
git status --short
git diff --check HEAD~6..HEAD
git diff --stat HEAD~6..HEAD
```

逐项确认：Todo 五种状态、旧时间格式、双详情入口、Play/导航/灯泡图标、筛选按下态、月/周满高、无 Sync、Add 两个必填红框、用例 15、月/周 Tooltip、周色板透明度、全天逻辑日。确认 `AGENTS.md` 未被任何任务提交。

- [ ] **Step 5: 仅在 E2E locator 必须同步时提交测试调整**

```powershell
git add tests/e2e/electron/schedule-ui.spec.ts
git commit -m "test(electron): 覆盖首页旧版行为对齐"
```

若 E2E 文件无需修改，不创建空提交。

## Plan Self-Review

- Spec coverage: Todo 颜色/格式/交互、图标、筛选按下态、满高、移除刷新、表单必填、`setpos`、月/周 Tooltip、周色板和逻辑日均有对应任务与测试。
- Placeholder scan: 计划没有占位内容、含糊处理语句或未定义接口；每个生产行为步骤都给出了目标代码、命令和预期结果。
- Type consistency: `TodoSidebar.now` 使用 ISO string prop 并在内部转为 `Temporal.Instant`；`WeekScheduleView.startMinute` 与 settings 字段一致；Tooltip 只消费现有 DTO。
- Scope control: 解析、图标骨架、Todo、表单、月视图、周视图各自独立提交和验证；不提交用户的 `AGENTS.md`。
