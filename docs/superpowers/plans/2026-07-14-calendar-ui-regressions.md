# 日历 UI 回归修复 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 MonthView 悬停宽度变化、暗色模式按钮按下效果、WeekView 浅色表头，并以老版 `runtimeStore.homepage.priority` 语义保持详情返回前的 month/week 模式。

**Architecture:** 新增一个只保存运行期 UI 状态的 Pinia `runtimeStore`，由应用启动时使用持久化默认值初始化，首页直接读写 `homepage.priority`。视觉修复限定在现有 CSS token 和三个日历/Todo 组件内，不改变路由、日历数据或平台边界。

**Tech Stack:** Vue 3、Pinia 3、Vue Router 5、Naive UI、TypeScript strict、Vitest、Vue Test Utils、Playwright Electron、原生 CSS。

## Global Constraints

- `release/1.2.0` is the immutable legacy reference; do not modify it.
- `src` must remain browser-runnable and platform-independent.
- Use Node.js 24 LTS and the exact pnpm version pinned by `packageManager`.
- Use test-driven development: every production behavior change starts with a failing test.
- Do not introduce TanStack Query, new dependencies, URL state, database state, or platform-gateway state.
- Preserve the existing `router.back()` behavior on the schedule detail page.
- Preserve the user's uncommitted `AGENTS.md` change.

---

## Target File Map

- Create `src/stores/runtime.ts`: application-lifetime UI state grouped by page.
- Create `tests/unit/stores/runtime.test.ts`: runtime Store initialization and lifetime behavior.
- Modify `src/App.vue`: initialize runtime state after preferences hydration.
- Modify `src/pages/index.vue`: read and write `runtimeStore.homepage.priority` directly.
- Modify `src/assets/styles/tokens.css`: light/dark pressed-control tokens.
- Modify `src/features/schedule/components/TodoSidebar.vue`: consume pressed-control tokens.
- Modify `src/features/schedule/components/MonthScheduleView.vue`: keep card width fixed on hover.
- Modify `src/features/schedule/components/WeekScheduleView.vue`: theme header and borders.
- Modify `tests/unit/features/home-workspace.test.ts`: runtime view and home pressed-state regression coverage.
- Modify `tests/unit/features/todo-sidebar.test.ts`: Todo pressed-state regression coverage.
- Modify `tests/unit/ui-source-conventions.test.ts`: CSS source invariants for month/week/dark theme.
- Modify `tests/e2e/electron/schedule-ui.spec.ts`: real detail-back navigation in both views.

---

### Task 1: Restore the page-grouped runtime Store

**Files:**
- Create: `src/stores/runtime.ts`
- Create: `tests/unit/stores/runtime.test.ts`
- Modify: `src/App.vue`

**Interfaces:**
- Consumes: `Preferences['calendarMode']` as the persisted default type.
- Produces: `useRuntimeStore()` with `homepage.priority: 'month' | 'week'` and `init(priority)`.

- [ ] **Step 1: Write the failing runtime Store tests**

Create `tests/unit/stores/runtime.test.ts`:

```ts
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useRuntimeStore } from '../../../src/stores/runtime'

describe('runtime store', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('initializes the homepage priority from the persisted default', () => {
    const store = useRuntimeStore()
    store.init('week')
    expect(store.homepage.priority).toBe('week')
  })

  it('keeps the selected homepage priority for the Pinia lifetime', () => {
    const first = useRuntimeStore()
    first.init('month')
    first.homepage.priority = 'week'

    const restored = useRuntimeStore()
    expect(restored.homepage.priority).toBe('week')
  })
})
```

- [ ] **Step 2: Run the Store test and verify RED**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/unit/stores/runtime.test.ts
```

Expected: FAIL because `src/stores/runtime.ts` does not exist.

- [ ] **Step 3: Implement the minimal runtime Store**

Create `src/stores/runtime.ts`:

```ts
import { defineStore } from 'pinia'

import type { Preferences } from './preferences'

type CalendarMode = Preferences['calendarMode']

export const useRuntimeStore = defineStore('runtime', {
  state: () => ({
    homepage: {
      priority: 'month' as CalendarMode
    }
  }),
  actions: {
    init(priority: CalendarMode) {
      this.homepage.priority = priority
    }
  }
})
```

In `src/App.vue`, initialize the runtime Store immediately after preferences hydration:

```ts
import { useRuntimeStore } from './stores/runtime'

const preferences = usePreferencesStore()
preferences.hydrate()
const runtime = useRuntimeStore()
runtime.init(preferences.calendarMode)
```

- [ ] **Step 4: Run the Store and app-shell tests and verify GREEN**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/unit/stores/runtime.test.ts tests/unit/app-shell.test.ts
.\node_modules\.bin\vue-tsc.cmd --noEmit -p tsconfig.app.json
```

Expected: all tests pass and TypeScript accepts only `month` or `week`.

- [ ] **Step 5: Commit the runtime Store**

```powershell
git add src/stores/runtime.ts src/App.vue tests/unit/stores/runtime.test.ts
git commit -m "fix(calendar): 恢复首页运行时视图状态"
```

---

### Task 2: Bind the homepage directly to runtime state

**Files:**
- Modify: `src/pages/index.vue`
- Modify: `tests/unit/features/home-workspace.test.ts`

**Interfaces:**
- Consumes: Task 1 `useRuntimeStore().homepage.priority`.
- Preserves: existing `select(scheduleId)` navigation and `router.back()` detail behavior.

- [ ] **Step 1: Write a failing remount regression test**

Update `mountHome` in `tests/unit/features/home-workspace.test.ts` to accept an optional Pinia instance, then add:

```ts
import { createPinia, type Pinia } from 'pinia'
import { useRuntimeStore } from '../../../src/stores/runtime'

async function mountHome(seed: readonly ScheduleDto[] = [], pinia: Pinia = createPinia()) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: HomePage }]
  })
  await router.push('/')
  return mount(HomePage, {
    global: {
      plugins: [pinia, router],
      provide: { [platformGatewayKey as symbol]: createInMemoryGateway(seed) }
    }
  })
}

it('restores the runtime calendar view after the homepage remounts', async () => {
  const pinia = createPinia()
  const first = await mountHome([], pinia)
  await first.get('button[data-view="week"]').trigger('click')
  expect(useRuntimeStore(pinia).homepage.priority).toBe('week')
  first.unmount()

  const restored = await mountHome([], pinia)
  expect(restored.find('[data-testid="week-view"]').exists()).toBe(true)
  await restored.get('button[data-view="month"]').trigger('click')
  expect(useRuntimeStore(pinia).homepage.priority).toBe('month')
})
```

- [ ] **Step 2: Run the home test and verify RED**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/unit/features/home-workspace.test.ts
```

Expected: FAIL because clicking week only updates the local `view` ref and the remounted page renders MonthView.

- [ ] **Step 3: Replace the local view copy with runtime state**

In `src/pages/index.vue`:

```ts
import { useRuntimeStore } from '../stores/runtime'

const runtimeStore = useRuntimeStore()
```

Delete `const view = ref(preferences.calendarMode)`. Change the two buttons and conditional views to use the Store directly:

```vue
<NButton
  data-view="month"
  :style="runtimeStore.homepage.priority === 'month' ? activeButtonStyle : undefined"
  @click="runtimeStore.homepage.priority = 'month'"
>
  month
</NButton>
<NButton
  data-view="week"
  :style="runtimeStore.homepage.priority === 'week' ? activeButtonStyle : undefined"
  @click="runtimeStore.homepage.priority = 'week'"
>
  week
</NButton>

<MonthScheduleView v-if="runtimeStore.homepage.priority === 'month'" />
<WeekScheduleView v-else />
```

Keep all existing props and emits on both view components unchanged.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/unit/features/home-workspace.test.ts tests/unit/stores/runtime.test.ts
.\node_modules\.bin\vue-tsc.cmd --noEmit -p tsconfig.app.json
```

Expected: remount retains week, switching back stores month, and all existing homepage behavior passes.

- [ ] **Step 5: Commit the homepage binding**

```powershell
git add src/pages/index.vue tests/unit/features/home-workspace.test.ts
git commit -m "fix(calendar): 保持详情返回前的首页视图"
```

---

### Task 3: Make pressed controls theme-aware

**Files:**
- Modify: `src/assets/styles/tokens.css`
- Modify: `src/pages/index.vue`
- Modify: `src/features/schedule/components/TodoSidebar.vue`
- Modify: `tests/unit/features/home-workspace.test.ts`
- Modify: `tests/unit/features/todo-sidebar.test.ts`
- Modify: `tests/unit/ui-source-conventions.test.ts`

**Interfaces:**
- Produces: `--color-control-pressed-background` and `--shadow-control-pressed` in light and dark themes.
- Consumes: the tokens through the existing inline `activeButtonStyle` bindings.

- [ ] **Step 1: Write failing component and token tests**

Change the active style assertions in both component test files to:

```ts
expect(style).toContain('background-color: var(--color-control-pressed-background)')
expect(style).toContain('box-shadow: var(--shadow-control-pressed)')
```

Add to `tests/unit/ui-source-conventions.test.ts`:

```ts
it('defines distinct light and dark pressed-control tokens', () => {
  const tokens = Object.entries(currentUiModules)
    .find(([path]) => path.endsWith('/src/assets/styles/tokens.css'))?.[1] ?? ''

  expect(tokens.match(/--color-control-pressed-background:/g)).toHaveLength(2)
  expect(tokens.match(/--shadow-control-pressed:/g)).toHaveLength(2)
  expect(tokens).toContain('inset 2px 2px 3px rgb(0 0 0 / 75%)')
  expect(tokens).toContain('inset -1px -1px 2px rgb(255 255 255 / 25%)')
})
```

Include `../../src/assets/styles/tokens.css` in `currentUiModules`.

- [ ] **Step 2: Run the pressed-state tests and verify RED**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/unit/features/home-workspace.test.ts tests/unit/features/todo-sidebar.test.ts tests/unit/ui-source-conventions.test.ts
```

Expected: FAIL because both components still emit fixed RGBA styles and the tokens do not exist.

- [ ] **Step 3: Add the theme tokens and consume them**

Add to the light `:root` block in `src/assets/styles/tokens.css`:

```css
--color-control-pressed-background: rgb(0 14 28 / 10%);
--shadow-control-pressed: inset 1px 1px 1px 1px rgb(0 14 28 / 60%);
```

Add to `.theme-dark`:

```css
--color-control-pressed-background: rgb(255 255 255 / 12%);
--shadow-control-pressed:
  inset 2px 2px 3px rgb(0 0 0 / 75%),
  inset -1px -1px 2px rgb(255 255 255 / 25%);
```

Replace `activeButtonStyle` in both `src/pages/index.vue` and `TodoSidebar.vue` with:

```ts
const activeButtonStyle = {
  backgroundColor: 'var(--color-control-pressed-background)',
  boxShadow: 'var(--shadow-control-pressed)'
}
```

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/unit/features/home-workspace.test.ts tests/unit/features/todo-sidebar.test.ts tests/unit/ui-source-conventions.test.ts
.\node_modules\.bin\vue-tsc.cmd --noEmit -p tsconfig.app.json
```

Expected: all focused tests pass and both button groups use the same theme tokens.

- [ ] **Step 5: Commit the theme-aware pressed state**

```powershell
git add src/assets/styles/tokens.css src/pages/index.vue src/features/schedule/components/TodoSidebar.vue tests/unit/features/home-workspace.test.ts tests/unit/features/todo-sidebar.test.ts tests/unit/ui-source-conventions.test.ts
git commit -m "style(ui): 增强暗色按钮按下效果"
```

---

### Task 4: Stabilize MonthView hover and theme WeekView headers

**Files:**
- Modify: `src/features/schedule/components/MonthScheduleView.vue`
- Modify: `src/features/schedule/components/WeekScheduleView.vue`
- Modify: `tests/unit/ui-source-conventions.test.ts`
- Test: `tests/unit/features/occurrence-calendar.test.ts`

**Interfaces:**
- Preserves: MonthView occurrence grouping, tooltip and select events.
- Preserves: WeekView Grid layout, logical-day mapping, drag offsets and event styling.

- [ ] **Step 1: Write failing CSS source regressions**

Add to `tests/unit/ui-source-conventions.test.ts`:

```ts
it('keeps month cards fixed-width while hovering', () => {
  const month = Object.entries(currentUiModules)
    .find(([path]) => path.endsWith('/MonthScheduleView.vue'))?.[1] ?? ''

  expect(month).toContain('.schedule-card {')
  expect(month).toContain('inline-size: 100%')
  expect(month).not.toContain('inline-size: auto')
})

it('uses theme colors for the week header and day borders', () => {
  const week = Object.entries(currentUiModules)
    .find(([path]) => path.endsWith('/WeekScheduleView.vue'))?.[1] ?? ''

  expect(week).not.toContain('#fafafc')
  expect(week).not.toContain('border: 1px solid #eee')
  expect(week).toContain('background: var(--color-surface)')
  expect(week).toContain('color: var(--color-text)')
  expect(week).toContain('border: 1px solid var(--color-border)')
  expect(week).toContain('border-block-end: 1px solid var(--color-border)')
})
```

- [ ] **Step 2: Run the source and calendar tests and verify RED**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/unit/ui-source-conventions.test.ts tests/unit/features/occurrence-calendar.test.ts
```

Expected: the new source tests FAIL on `inline-size: auto`, `#fafafc`, and `#eee`; existing behavior tests remain green.

- [ ] **Step 3: Apply the minimal CSS corrections**

In `MonthScheduleView.vue`, keep hover layout-neutral:

```css
.schedule-card:hover {
  border-color: #18a058;
  background: var(--color-surface);
  transition: border-color 0.2s ease-in-out;
}
```

In `WeekScheduleView.vue`, replace only the hard-coded day/header surfaces and borders:

```css
.day-card {
  position: relative;
  min-block-size: 0;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  text-align: center;
  word-break: break-word;
}
.day-card header {
  block-size: 4.8vh;
  line-height: 4.8vh;
  padding: 0;
  border-block-end: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
}
```

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/unit/ui-source-conventions.test.ts tests/unit/features/occurrence-calendar.test.ts tests/unit/features/home-workspace.test.ts
.\node_modules\.bin\vue-tsc.cmd --noEmit -p tsconfig.app.json
```

Expected: source regressions and all calendar behavior tests pass.

- [ ] **Step 5: Commit the calendar CSS fixes**

```powershell
git add src/features/schedule/components/MonthScheduleView.vue src/features/schedule/components/WeekScheduleView.vue tests/unit/ui-source-conventions.test.ts
git commit -m "fix(calendar): 修复日历暗色与悬停布局"
```

---

### Task 5: Prove real detail-back navigation and run full verification

**Files:**
- Modify: `tests/e2e/electron/schedule-ui.spec.ts`
- Verify only: all production and test files changed in Tasks 1-4.

**Interfaces:**
- Consumes: existing event-card navigation and detail-page `router.back()`.
- Proves: both MonthView and WeekView restore the runtime mode after using the visible detail back control.

- [ ] **Step 1: Extend the Electron regression with month and week return assertions**

After the existing WeekView tooltip assertion in `tests/e2e/electron/schedule-ui.spec.ts`, add:

```ts
await card.click()
await expect(window.getByText('Schedule', { exact: true })).toBeVisible()
await window.locator('.n-page-header__back').click()
await expect(window.getByTestId('week-view')).toBeVisible()

await window.getByRole('button', { name: 'month', exact: true }).click()
const monthCard = window.getByTestId('month-view').getByRole('button', { name: /周视图回归/ })
await monthCard.click()
await expect(window.getByText('Schedule', { exact: true })).toBeVisible()
await window.locator('.n-page-header__back').click()
await expect(window.getByTestId('month-view')).toBeVisible()
```

- [ ] **Step 2: Build and run the Electron test to verify the regression coverage**

Run:

```powershell
pnpm build:web
pnpm build:electron
.\node_modules\.bin\playwright.cmd test tests/e2e/electron/schedule-ui.spec.ts
```

Expected after Tasks 1-4: PASS; to prove the test detects the old bug, temporarily restore the local `view` ref behavior, rerun the focused Electron test and observe the WeekView return assertion fail, then restore the runtime implementation and rerun to PASS.

- [ ] **Step 3: Run the required Web quality gates**

Run:

```powershell
.\node_modules\.bin\eslint.cmd .
.\node_modules\.bin\vue-tsc.cmd --noEmit -p tsconfig.app.json
.\node_modules\.bin\vitest.cmd run tests/unit tests/contracts tests/parser
.\node_modules\.bin\vite.cmd build
```

Expected: all four commands exit 0; only the existing Vite chunk-size warning is acceptable.

- [ ] **Step 4: Check diff scope and whitespace**

Run:

```powershell
git diff --check
git status --short
```

Expected: no whitespace errors; changed lines map to this plan; the pre-existing `M AGENTS.md` remains outside the task commits.

- [ ] **Step 5: Commit the Electron regression**

```powershell
git add tests/e2e/electron/schedule-ui.spec.ts
git commit -m "test(calendar): 覆盖详情返回视图状态"
```

## Plan Self-Review

- Spec coverage: Task 1 owns runtime initialization, Task 2 owns page-grouped view retention, Task 3 owns dark pressed controls, Task 4 owns Month hover and Week header theming, and Task 5 owns real navigation plus full verification.
- Placeholder scan: every behavior change includes exact test code, implementation code, command, expected failure or success, and commit scope.
- Type consistency: every runtime interface uses `Preferences['calendarMode']`, while `homepage.priority` remains the exact `'month' | 'week'` union throughout tests and components.
- Scope control: no task changes calendar dates, sidebar state, drag persistence, router semantics, platform gateways, database code, or unrelated styling.
