# Settings and Application Layout Corrections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore complete time-zone and WKST choices, remove the unused density preference, correct settings control sizing, and keep the application header and footer visible around a scrollbar-free content scroller.

**Architecture:** Settings use one ISO weekday representation (`1` through `7`) across contracts, Pinia, browser, Electron, and the parser context. A small platform-neutral helper derives time-zone select options from `Intl`, while the application shell uses a viewport grid whose middle row is the only scroll container.

**Tech Stack:** Node.js 24 LTS, pnpm 11.11.0, TypeScript 6, Vue 3, Pinia, Naive UI, Zod, Vitest, CSS.

## Global Constraints

- Use Node.js 24 LTS and `pnpm@11.11.0` exactly as pinned by `packageManager`.
- Keep `src` browser-runnable and platform-independent; Electron-only wiring remains in `src-electron`.
- Do not add Moment, Luxon, TanStack Query, a time-zone package, or any other dependency.
- Use ISO weekday values `1 | 2 | 3 | 4 | 5 | 6 | 7` everywhere; do not migrate or accept unpublished value `0`.
- Keep Alarm and Pomodoro duration inputs minute-only.
- Hide scrollbar visuals without disabling wheel, touch, or keyboard scrolling.
- Touch only files listed in this plan and preserve unrelated changes.

---

### Task 1: Unify ISO WKST and remove Compact Density

**Files:**
- Modify: `src/contracts/settings.contract.ts:1-29`
- Modify: `src/stores/preferences.ts:1-65`
- Modify: `src/App.vue:1-30`
- Modify: `src/platform/browser/in-memory-gateway.ts:49,76,103,153,163`
- Modify: `src-electron/main/index.ts:68-78`
- Modify: `tests/contracts/settings.contract.test.ts:1-27`
- Modify: `tests/unit/stores/preferences.test.ts:1-57`
- Modify: `tests/integration/database/settings-repository.test.ts:20-29`

**Interfaces:**
- Produces: `WeekStartSchema` and `WeekStart` from `src/contracts/settings.contract.ts`.
- Produces: `SettingsDto.weekStart` and `Preferences.weekStart` as `1 | 2 | 3 | 4 | 5 | 6 | 7`.
- Removes: `Preferences.compactDensity` and the root `density-compact` class binding.
- Supplies: `settings.weekStart` directly to every `EvaluationContext.weekStartsOn` boundary.

- [ ] **Step 1: Write failing contract, preference, and repository tests**

Replace the settings contract invalid-value test and update the preference/repository expectations with these assertions:

```ts
// tests/contracts/settings.contract.test.ts
it('accepts exactly the seven ISO week starts', () => {
  for (const weekStart of [1, 2, 3, 4, 5, 6, 7]) {
    expect(SettingsDtoSchema.safeParse({ ...defaultSettings, weekStart }).success).toBe(true)
  }
  for (const weekStart of [0, 8]) {
    expect(SettingsDtoSchema.safeParse({ ...defaultSettings, weekStart }).success).toBe(false)
  }
})

// tests/unit/stores/preferences.test.ts
it('uses stable client preference defaults', () => {
  expect(usePreferencesStore().$state).toEqual({
    themeMode: 'system',
    calendarMode: 'month',
    weekStart: 1
  })
})

it('updates ISO week starts and round trips them through storage', () => {
  const storage = memoryStorage()
  const first = usePreferencesStore()
  first.update({ themeMode: 'light', calendarMode: 'week', weekStart: 7 }, storage)

  setActivePinia(createPinia())
  const restored = usePreferencesStore()
  restored.hydrate(storage)

  expect(restored.$state).toEqual({
    themeMode: 'light',
    calendarMode: 'week',
    weekStart: 7
  })
})

// tests/integration/database/settings-repository.test.ts, inside the existing test
await repository.update({ timeZone: 'Asia/Shanghai', weekStart: 7, openAtLogin: true })
await expect(repository.get()).resolves.toMatchObject({
  ok: true,
  value: { timeZone: 'Asia/Shanghai', weekStart: 7, openAtLogin: true }
})
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/contracts/settings.contract.test.ts tests/unit/stores/preferences.test.ts tests/integration/database/settings-repository.test.ts
```

Expected: FAIL because `weekStart: 7` is rejected and `compactDensity` still exists in preference state.

- [ ] **Step 3: Implement the shared ISO weekday contract and simplified preferences**

Add the shared schema and use it in both settings and preferences:

```ts
// src/contracts/settings.contract.ts
export const WeekStartSchema = z.union([
  z.literal(1), z.literal(2), z.literal(3), z.literal(4),
  z.literal(5), z.literal(6), z.literal(7)
])
export type WeekStart = z.infer<typeof WeekStartSchema>

export const SettingsDtoSchema = z.object({
  timeZone: z.string().min(1).max(100),
  weekStart: WeekStartSchema,
  todoAlarmEnabled: z.boolean(),
  todoAlarmBeforeMinutes: z.number().int().min(0).max(1440),
  eventAlarmEnabled: z.boolean(),
  eventAlarmBeforeMinutes: z.number().int().min(0).max(1440),
  calendarMode: z.enum(['month', 'week']),
  weekViewDays: z.number().int().min(1).max(7),
  logicalDayStartHour: z.number().int().min(0).max(23),
  logicalDayStartMinute: z.number().int().min(0).max(59),
  openAtLogin: z.boolean(),
  focusMinutes: z.number().int().positive().max(1440),
  smallBreakMinutes: z.number().int().positive().max(1440),
  bigBreakMinutes: z.number().int().positive().max(1440)
}).strict()
```

```ts
// src/stores/preferences.ts
import { WeekStartSchema } from '../contracts/settings.contract'

const PreferencesSchema = z.object({
  themeMode: z.enum(['system', 'light', 'dark']),
  calendarMode: z.enum(['month', 'week']),
  weekStart: WeekStartSchema
}).strict()

const defaults: Preferences = {
  themeMode: 'system',
  calendarMode: 'month',
  weekStart: 1
}
```

Delete the `compactDensity` branch from `update()`. In `src/App.vue`, replace the root class binding with:

```vue
<main
  data-testid="app-shell"
  :class="{ 'theme-dark': usesDarkTheme }"
>
```

- [ ] **Step 4: Pass ISO weekdays directly to parser contexts**

Replace all five browser gateway ternaries:

```ts
weekStartsOn: settings.weekStart,
```

Replace the Electron configured service mapping:

```ts
weekStartsOn: settings?.weekStart ?? 1,
```

- [ ] **Step 5: Run focused and required foundation checks GREEN**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/contracts/settings.contract.test.ts tests/unit/stores/preferences.test.ts tests/integration/database/settings-repository.test.ts
.\node_modules\.bin\eslint.cmd .
.\node_modules\.bin\vue-tsc.cmd --noEmit -p tsconfig.app.json
.\node_modules\.bin\vitest.cmd run tests/unit tests/contracts tests/parser
.\node_modules\.bin\vite.cmd build
.\node_modules\.bin\tsc.cmd --noEmit -p tsconfig.electron.json
```

Expected: all six commands exit `0`.

- [ ] **Step 6: Commit Task 1**

```powershell
git add src/contracts/settings.contract.ts src/stores/preferences.ts src/App.vue src/platform/browser/in-memory-gateway.ts src-electron/main/index.ts tests/contracts/settings.contract.test.ts tests/unit/stores/preferences.test.ts tests/integration/database/settings-repository.test.ts
git commit -m "refactor(settings): 统一周起始日并移除紧凑密度"
```

### Task 2: Restore complete time zones, WKST controls, and settings spacing

**Files:**
- Create: `src/features/settings/time-zone-options.ts`
- Create: `tests/unit/features/time-zone-options.test.ts`
- Modify: `src/pages/settings.vue:1-163`
- Modify: `tests/unit/features/secondary-pages.test.ts:1-88`

**Interfaces:**
- Consumes: `WeekStart` values from Task 1.
- Produces: `createTimeZoneOptions(currentTimeZone, supportedTimeZones?, systemTimeZone?)` returning `{ label: string; value: string }[]`.
- Produces: seven `NRadio` controls with values `1` through `7` and labels `MO` through `SU`.
- Produces: one `.setting-field` wrapper for each of the 12 remaining settings rows.

- [ ] **Step 1: Write the failing time-zone helper tests**

Create `tests/unit/features/time-zone-options.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { createTimeZoneOptions } from '../../../src/features/settings/time-zone-options'

describe('createTimeZoneOptions', () => {
  it('sorts and deduplicates UTC, supported, system, and current zones', () => {
    expect(
      createTimeZoneOptions(
        'Asia/Shanghai',
        ['Europe/London', 'Asia/Shanghai', 'Europe/London'],
        'America/Chicago'
      )
    ).toEqual([
      { label: 'America/Chicago', value: 'America/Chicago' },
      { label: 'Asia/Shanghai', value: 'Asia/Shanghai' },
      { label: 'Europe/London', value: 'Europe/London' },
      { label: 'UTC', value: 'UTC' }
    ])
  })

  it('contains every runtime-supported canonical time zone', () => {
    const values = new Set(createTimeZoneOptions('UTC').map(({ value }) => value))
    expect(values.has('UTC')).toBe(true)
    for (const timeZone of Intl.supportedValuesOf('timeZone')) {
      expect(values.has(timeZone)).toBe(true)
    }
  })

  it('falls back to UTC, system, and current zones without a supported list', () => {
    expect(createTimeZoneOptions('Asia/Shanghai', [], 'America/Chicago')).toEqual([
      { label: 'America/Chicago', value: 'America/Chicago' },
      { label: 'Asia/Shanghai', value: 'Asia/Shanghai' },
      { label: 'UTC', value: 'UTC' }
    ])
  })
})
```

- [ ] **Step 2: Extend the settings page test and verify RED**

Import `NRadio`, `NSelect`, and `NSwitch` from Naive UI, then replace the settings test body with:

```ts
it('restores complete settings choices and aligned controls', async () => {
  const router = await routerAt('/settings')
  const wrapper = mount(SettingsPage, { global: { plugins: [createPinia(), router] } })

  for (const text of ['Appearance', 'RRule', 'Alarm', 'Preferences', 'Pomodoro', 'Theme']) {
    expect(wrapper.text()).toContain(text)
  }
  expect(wrapper.text()).not.toContain('Compact Density')

  const weekStartRadios = wrapper.findAllComponents(NRadio).filter(({ text }) =>
    ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'].includes(text())
  )
  expect(weekStartRadios.map((radio) => radio.props('value'))).toEqual([1, 2, 3, 4, 5, 6, 7])

  const timeZoneSelect = wrapper.findAllComponents(NSelect)[0]!
  expect(timeZoneSelect.props('filterable')).toBe(true)
  expect(timeZoneSelect.props('options').length).toBeGreaterThan(100)
  expect(wrapper.findAll('.setting-field')).toHaveLength(12)
  expect(wrapper.findAllComponents(NSwitch).every(
    (component) => component.element.parentElement?.classList.contains('setting-field') === true
  )).toBe(true)
})
```

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/unit/features/time-zone-options.test.ts tests/unit/features/secondary-pages.test.ts
```

Expected: FAIL because the helper does not exist, only two WKST radios render, the select is not filterable, and setting wrappers are absent.

- [ ] **Step 3: Implement the platform-neutral time-zone option helper**

Create `src/features/settings/time-zone-options.ts`:

```ts
export interface TimeZoneOption {
  readonly label: string
  readonly value: string
}

function runtimeTimeZones(): readonly string[] {
  return typeof Intl.supportedValuesOf === 'function'
    ? Intl.supportedValuesOf('timeZone')
    : []
}

export function createTimeZoneOptions(
  currentTimeZone: string,
  supportedTimeZones: readonly string[] = runtimeTimeZones(),
  systemTimeZone: string = Intl.DateTimeFormat().resolvedOptions().timeZone
): TimeZoneOption[] {
  const values = new Set(['UTC', ...supportedTimeZones])
  if (systemTimeZone !== '') values.add(systemTimeZone)
  if (currentTimeZone !== '') values.add(currentTimeZone)
  return [...values]
    .sort((left, right) => left.localeCompare(right))
    .map((value) => ({ label: value, value }))
}
```

- [ ] **Step 4: Wire complete time zones and seven WKST values into the page**

Add `computed` and the helper import:

```ts
import { computed, inject, ref } from 'vue'
import { createTimeZoneOptions } from '../features/settings/time-zone-options'

const timeZoneOptions = computed(() => createTimeZoneOptions(settings.value.timeZone))
const weekStarts = [
  { label: 'MO', value: 1 }, { label: 'TU', value: 2 },
  { label: 'WE', value: 3 }, { label: 'TH', value: 4 },
  { label: 'FR', value: 5 }, { label: 'SA', value: 6 },
  { label: 'SU', value: 7 }
] as const
```

Replace the complete `<template>` block with:

```vue
<template>
  <div class="settings-page">
    <NCard segmented>
      <template #header><b>RRule</b></template>
      <div class="settings-group">
        <label>Time Zone</label>
        <div class="setting-field setting-field--select">
          <NSelect
            :value="settings.timeZone"
            :options="timeZoneOptions"
            filterable
            @update:value="updateSetting('timeZone', $event)"
          />
        </div>
        <label>WKST</label>
        <div class="setting-field">
          <NRadioGroup
            :value="settings.weekStart"
            @update:value="updateSetting('weekStart', $event); update('weekStart', $event)"
          >
            <NRadio v-for="day in weekStarts" :key="day.value" :value="day.value">
              {{ day.label }}
            </NRadio>
          </NRadioGroup>
        </div>
      </div>
    </NCard>

    <NCard segmented>
      <template #header><b>Alarm</b></template>
      <div class="settings-group">
        <label>Todo</label>
        <div class="setting-field">
          <NSwitch
            :value="settings.todoAlarmEnabled"
            @update:value="updateSetting('todoAlarmEnabled', $event)"
          />
          <NInputNumber
            :value="settings.todoAlarmBeforeMinutes"
            @update:value="updateSetting('todoAlarmBeforeMinutes', $event ?? 0)"
          />
          minutes
        </div>
        <label>Event</label>
        <div class="setting-field">
          <NSwitch
            :value="settings.eventAlarmEnabled"
            @update:value="updateSetting('eventAlarmEnabled', $event)"
          />
          <NInputNumber
            :value="settings.eventAlarmBeforeMinutes"
            @update:value="updateSetting('eventAlarmBeforeMinutes', $event ?? 0)"
          />
          minutes
        </div>
      </div>
    </NCard>

    <NCard segmented>
      <template #header><b>Preferences</b></template>
      <div class="settings-group">
        <label>Priority</label>
        <div class="setting-field">
          <NRadioGroup
            :value="settings.calendarMode"
            @update:value="updateSetting('calendarMode', $event); update('calendarMode', $event)"
          >
            <NRadio value="month">MonthView</NRadio>
            <NRadio value="week">WeekView</NRadio>
          </NRadioGroup>
        </div>
        <label>Week View Days</label>
        <div class="setting-field">
          <NInputNumber
            :value="settings.weekViewDays"
            @update:value="updateSetting('weekViewDays', $event ?? 5)"
          />
        </div>
        <label>Week View Start Time</label>
        <div class="setting-field setting-field--time">
          <NInputNumber
            :value="settings.logicalDayStartHour"
            @update:value="updateSetting('logicalDayStartHour', $event ?? 0)"
          />
          :
          <NInputNumber
            :value="settings.logicalDayStartMinute"
            @update:value="updateSetting('logicalDayStartMinute', $event ?? 0)"
          />
        </div>
        <label>Open At Login</label>
        <div class="setting-field">
          <NSwitch
            :value="settings.openAtLogin"
            @update:value="updateSetting('openAtLogin', $event)"
          />
        </div>
      </div>
    </NCard>

    <NCard segmented>
      <template #header><b>Pomodoro</b></template>
      <div class="settings-group">
        <label>Focus Time</label>
        <div class="setting-field">
          <NInputNumber
            :value="settings.focusMinutes"
            @update:value="updateSetting('focusMinutes', $event ?? 25)"
          />
          minutes
        </div>
        <label>Small Break</label>
        <div class="setting-field">
          <NInputNumber
            :value="settings.smallBreakMinutes"
            @update:value="updateSetting('smallBreakMinutes', $event ?? 5)"
          />
          minutes
        </div>
        <label>Big Break</label>
        <div class="setting-field">
          <NInputNumber
            :value="settings.bigBreakMinutes"
            @update:value="updateSetting('bigBreakMinutes', $event ?? 20)"
          />
          minutes
        </div>
      </div>
    </NCard>

    <NCard segmented>
      <template #header><b>Appearance</b></template>
      <div class="settings-group">
        <label>Theme</label>
        <div class="setting-field setting-field--select">
          <NSelect
            :value="preferences.themeMode"
            :options="[
              { label: 'System', value: 'system' },
              { label: 'Light', value: 'light' },
              { label: 'Dark', value: 'dark' }
            ]"
            @update:value="update('themeMode', $event)"
          />
        </div>
      </div>
    </NCard>
  </div>
</template>
```

- [ ] **Step 5: Replace settings page spacing and control widths**

Replace the scoped styles with:

```css
.settings-page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 6vh 8vw;
}

.settings-group {
  display: grid;
  grid-template-columns: 12rem minmax(0, 1fr);
  align-items: center;
  gap: 1rem 2rem;
}

.settings-group > label { font-weight: 700; }

.setting-field {
  display: flex;
  align-items: center;
  justify-self: start;
  gap: 1rem;
  min-inline-size: 0;
}

.setting-field--select { inline-size: 15rem; }
.setting-field :deep(.n-input-number) { inline-size: 8rem; }
.setting-field--time :deep(.n-input-number) { inline-size: 6rem; }
```

- [ ] **Step 6: Run focused settings and required foundation checks GREEN**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/unit/features/time-zone-options.test.ts tests/unit/features/secondary-pages.test.ts
.\node_modules\.bin\eslint.cmd .
.\node_modules\.bin\vue-tsc.cmd --noEmit -p tsconfig.app.json
.\node_modules\.bin\vitest.cmd run tests/unit tests/contracts tests/parser
.\node_modules\.bin\vite.cmd build
```

Expected: all five commands exit `0`.

- [ ] **Step 7: Commit Task 2**

```powershell
git add src/features/settings/time-zone-options.ts src/pages/settings.vue tests/unit/features/time-zone-options.test.ts tests/unit/features/secondary-pages.test.ts
git commit -m "fix(settings): 补全时区选项并修正控件布局"
```

### Task 3: Make content the only scroll container

**Files:**
- Modify: `src/app/components/AppShell.vue:1-92`
- Modify: `src/assets/styles/main.css:9-105`
- Modify: `tests/unit/app-shell.test.ts:1-66`

**Interfaces:**
- Produces: `.application-layout` as a three-row viewport grid.
- Produces: `.application-content > .n-layout-scroll-container` as the sole scroll container.
- Preserves: `.application-header`, `.application-footer`, navigation behavior, and `IdeaPane` behavior.

- [ ] **Step 1: Write the failing shell structure and stylesheet test**

Import the stylesheet source and add this test:

```ts
import { NLayoutContent } from 'naive-ui'
import applicationStyles from '../../src/assets/styles/main.css?raw'

it('keeps chrome outside the only scrollable content row', async () => {
  const router = createRouter({ history: createMemoryHistory(), routes })
  await router.push('/settings')
  const wrapper = mount(App, { global: { plugins: [createPinia(), router] } })

  expect(wrapper.get('.application-layout').element.tagName).toBe('DIV')
  expect(wrapper.findComponent(NLayoutContent).props('nativeScrollbar')).toBe(true)
  expect(applicationStyles).toContain('grid-template-rows: 53px minmax(0, 1fr) 48px')
  expect(applicationStyles).toContain('.application-content > .n-layout-scroll-container')
  expect(applicationStyles).toContain('scrollbar-width: none')
  expect(applicationStyles).toContain('::-webkit-scrollbar')
  expect(applicationStyles).not.toContain('inset-block: 53px 5vh')
})
```

- [ ] **Step 2: Run the shell test and verify RED**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/unit/app-shell.test.ts
```

Expected: FAIL because the root is an `NLayout`, the content uses the custom scrollbar, and the stylesheet uses absolute insets.

- [ ] **Step 3: Change the shell to a plain viewport grid root**

Remove `NLayout` from the import. Replace the complete `<template>` block with:

```vue
<template>
  <div class="application-layout">
    <NLayoutHeader
      class="application-header"
      bordered
      :style="{
        backgroundColor: 'var(--color-navigation)',
        color: 'var(--color-navigation-text)'
      }"
    >
      <nav aria-label="Main navigation">
        <RouterLink
          v-for="item in navigation"
          :key="item.path"
          :to="item.path"
          :class="['navigation-item', { active: activePath === item.path }]"
        >
          <span class="navigation-icon" aria-hidden="true">{{ item.icon }}</span>
          {{ item.label }}
        </RouterLink>
      </nav>
      <div class="guest-identity">
        <NAvatar round size="small">G</NAvatar>
        <span>Guest</span>
      </div>
    </NLayoutHeader>

    <NLayoutContent class="application-content" :native-scrollbar="true">
      <RouterView />
    </NLayoutContent>

    <NLayoutFooter
      class="application-footer"
      bordered
      :style="{
        backgroundColor: 'var(--color-navigation)',
        color: 'var(--color-navigation-text)'
      }"
    >
      © 2023
    </NLayoutFooter>
  </div>
  <IdeaPane />
</template>
```

- [ ] **Step 4: Replace absolute layout rules with a viewport grid and hidden native scrollbar**

Update the reset and application rules to:

```css
html,
body,
#app {
  block-size: 100%;
  min-block-size: 100%;
  margin: 0;
  overflow: hidden;
}

[data-testid='app-shell'] {
  block-size: 100vh;
  min-block-size: 100vh;
  overflow: hidden;
  background: var(--color-canvas);
  color: var(--color-text);
}

.application-layout {
  display: grid;
  grid-template-rows: 53px minmax(0, 1fr) 48px;
  block-size: 100vh;
  overflow: hidden;
}

.application-header {
  position: relative;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  block-size: 53px;
  padding-inline: 1rem;
}

.application-content { min-block-size: 0; }

.application-content > .n-layout-scroll-container {
  block-size: 100%;
  overflow: auto;
  scrollbar-width: none;
}

.application-content > .n-layout-scroll-container::-webkit-scrollbar {
  display: none;
}

.application-footer {
  position: relative;
  z-index: 10;
  block-size: 48px;
  padding-block: 0.75rem;
  text-align: center;
}
```

Delete these exact obsolete declarations and no others:

```css
.application-layout { min-block-size: 100vh; }
.application-content {
  position: absolute;
  inset-block: 53px 5vh;
  inset-inline: 0;
}
.application-footer {
  position: absolute;
  inset-block-end: 0;
  block-size: 5vh;
}
```

- [ ] **Step 5: Run shell, settings, and required foundation checks GREEN**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/unit/app-shell.test.ts tests/unit/features/secondary-pages.test.ts
.\node_modules\.bin\eslint.cmd .
.\node_modules\.bin\vue-tsc.cmd --noEmit -p tsconfig.app.json
.\node_modules\.bin\vitest.cmd run tests/unit tests/contracts tests/parser
.\node_modules\.bin\vite.cmd build
```

Expected: all five commands exit `0`.

- [ ] **Step 6: Commit Task 3**

```powershell
git add src/app/components/AppShell.vue src/assets/styles/main.css tests/unit/app-shell.test.ts
git commit -m "fix(layout): 固定应用顶栏和底栏"
```

### Task 4: Full verification

**Files:**
- Verify only; modify a task-owned file only if its corresponding check exposes a regression.

**Interfaces:**
- Consumes: Tasks 1 through 3.
- Produces: fresh evidence that the Web foundation remains valid.

- [ ] **Step 1: Audit the final diff against the specification**

Run:

```powershell
git status --short
git diff HEAD~3 -- src src-electron tests
rg -n "compactDensity|Compact Density|weekStart === 0|weekStart === 1 \? 1 : 7" src src-electron tests
```

Expected: only planned files differ across the three implementation commits, and `rg` returns no matches.

- [ ] **Step 2: Run the required Web foundation checks**

Run:

```powershell
.\node_modules\.bin\eslint.cmd .
.\node_modules\.bin\vue-tsc.cmd --noEmit -p tsconfig.app.json
.\node_modules\.bin\vitest.cmd run tests/unit tests/contracts tests/parser
.\node_modules\.bin\vite.cmd build
```

Expected: all commands exit `0`; Vitest reports zero failed files and tests.

- [ ] **Step 3: Run Electron type and settings persistence checks**

Run:

```powershell
.\node_modules\.bin\tsc.cmd --noEmit -p tsconfig.electron.json
.\node_modules\.bin\vitest.cmd run tests/integration/database/settings-repository.test.ts tests/integration/ipc/schedule-ipc.test.ts
```

Expected: both commands exit `0`.

- [ ] **Step 4: Confirm implementation files are clean while preserving the user's AGENTS.md edit**

Run:

```powershell
git status --short
```

Expected: the only output is ` M AGENTS.md`, the pre-existing user change that corrects the legacy branch name; no implementation file remains modified or untracked.
