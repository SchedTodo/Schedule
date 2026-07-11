# Schedule v2 UI Continuation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current placeholder page with a usable Schedule v2 interface for listing, creating, viewing, filtering, and completing schedules, while keeping all Vue code independent of Electron.

**Architecture:** Vue features consume only `PlatformGateway`; they never read `window.scheduleHost` directly. A browser in-memory gateway supports Web development and deterministic UI tests, while a small host-gateway adapter translates the validated preload API into the same `PlatformGateway`. Page components own presentation only; asynchronous behavior lives in feature composables and client-only preferences live in Pinia.

**Tech Stack:** Vue 3.5, Vue Router 5 built-in file routing, Pinia 3, Naive UI 2, VueUse 14, Zod 4, Temporal, Vitest, Vue Test Utils, Playwright, native CSS, Vite 8.

## Current Baseline

- `main` currently ends at `92af9da`; Tasks 1–7 are implemented.
- `pnpm start:electron` builds `dist-web` and `dist-electron`, then starts Electron.
- Electron startup E2E proves one isolated window, no renderer Node globals, and three named preload methods.
- `src/pages/index.vue` is only a placeholder; no v2 feature UI exists yet.
- `.npmrc` has uncommitted user changes adding Electron mirrors. Preserve it unless the user explicitly decides to commit or discard it.
- `electron-builder` is not installed because its dependency download stalls locally. It is not required for this UI plan.
- Do not introduce TanStack Query, Tailwind, Electron imports under `src`, or direct database access from Vue.

## Target File Map

```text
src/
├─ app/bootstrap.ts
├─ assets/styles/tokens.css
├─ features/schedule/
│  ├─ components/ScheduleComposer.vue
│  ├─ components/ScheduleList.vue
│  ├─ components/ScheduleListItem.vue
│  ├─ use-schedule-detail.ts
│  ├─ use-schedule-list.ts
│  └─ use-schedule-mutations.ts
├─ pages/
│  ├─ index.vue
│  ├─ schedule/[id].vue
│  └─ settings.vue
├─ platform/
│  ├─ browser/in-memory-gateway.ts
│  ├─ host/host-api.ts
│  └─ host/host-gateway.ts
└─ stores/preferences.ts
```

## Global Constraints

- Run all behavior changes through RED → GREEN → REFACTOR.
- Keep `src` browser-runnable and free of `electron`, `node:*`, Drizzle, SQLite, and `src-electron` imports.
- Use `PlatformGateway` and stable DTOs at the UI boundary.
- Keep server/database data in composables; Pinia stores client preferences only.
- Validate unknown host objects before use and preserve Zod validation at IPC boundaries.
- All new commit subjects use a Conventional Commit type followed by a concise Chinese description.
- Ask the user to run dependency installation commands. This plan requires no new dependency before Task 4.

---

### Task 1: Add testable gateway bootstrap and in-memory Web data

**Files:**
- Create: `src/app/bootstrap.ts`
- Create: `src/platform/browser/in-memory-gateway.ts`
- Modify: `src/main.ts`
- Modify: `src/contracts/platform.contract.ts`
- Test: `tests/unit/platform/in-memory-gateway.test.ts`

**Interfaces:**
- Produces: `createInMemoryGateway(seed?: readonly ScheduleDto[]): PlatformGateway`.
- Produces: `bootstrapApplication(gateway: PlatformGateway): App<Element>`.
- `ScheduleGateway` continues to expose `create`, `findById`, and `list`; do not add UI-only methods here.

- [ ] **Step 1: Write the failing in-memory gateway test**

Cover normalized create defaults, deterministic list filtering, pagination, lookup, and immutable returned arrays. Inject `Clock` and `IdGenerator` rather than using real time or random UUIDs.

```ts
const gateway = createInMemoryGateway([], {
  clock: new FixedClock('2026-07-11T08:00:00Z'),
  idGenerator: { next: () => '0198f0de-8f7f-7000-8000-000000000001' }
})
const result = await gateway.schedules.create({
  title: '周会',
  recurrenceCode: '2026-07-12 10:00',
  exclusionCode: '',
  comment: ''
})
expect(result.ok && result.value.createdAt).toBe('2026-07-11T08:00:00Z')
```

- [ ] **Step 2: Verify RED**

Run: `pnpm vitest run tests/unit/platform/in-memory-gateway.test.ts`

Expected: FAIL because `createInMemoryGateway` does not exist.

- [ ] **Step 3: Implement the minimum gateway and bootstrap**

Move Vue/Pinia/router setup from `src/main.ts` into `bootstrapApplication(gateway)`. Provide the gateway with `platformGatewayKey`. Keep `src/main.ts` as the Web entry that calls `createInMemoryGateway()` and then mounts.

- [ ] **Step 4: Verify GREEN**

Run:

```powershell
pnpm vitest run tests/unit/platform/in-memory-gateway.test.ts tests/unit/app-shell.test.ts
pnpm build:web
```

Expected: tests pass and Web output remains `dist-web`.

- [ ] **Step 5: Commit**

```powershell
git add src/app/bootstrap.ts src/platform/browser src/main.ts src/contracts/platform.contract.ts tests/unit/platform
git commit -m "feat(web): 增加可测试的内存平台网关"
```

### Task 2: Build schedule list composables before page components

**Files:**
- Create: `src/features/schedule/use-schedule-list.ts`
- Create: `src/features/schedule/use-schedule-detail.ts`
- Create: `src/features/schedule/use-schedule-mutations.ts`
- Test: `tests/unit/features/schedule-composables.test.ts`

**Interfaces:**
- Produces: `useScheduleList(gateway, initialQuery)` with readonly `items`, `loading`, `error`, `query`, and `refresh()`.
- Produces: `useScheduleDetail(gateway, id)` with readonly `schedule`, `loading`, `error`, and `refresh()`.
- Produces: `useScheduleMutations(gateway, afterMutation)` with `createSchedule(input)` and readonly mutation state.

- [ ] **Step 1: Write failing composable tests**

Test initial loading, success, empty result, stable application error, refresh after create, and stale-response suppression. Use deferred promises to prove an older request cannot overwrite a newer result.

```ts
const state = useScheduleList(gateway, { offset: 0, limit: 50 })
await state.refresh()
expect(state.items.value).toEqual([schedule])
expect(state.loading.value).toBe(false)
```

- [ ] **Step 2: Verify RED**

Run: `pnpm vitest run tests/unit/features/schedule-composables.test.ts`

Expected: FAIL because the composables do not exist.

- [ ] **Step 3: Implement minimal composables**

Use Vue refs and an incrementing request token. Do not put schedule DTO arrays in Pinia and do not access Electron globals.

- [ ] **Step 4: Verify GREEN and architecture boundaries**

Run:

```powershell
pnpm vitest run tests/unit/features/schedule-composables.test.ts
pnpm lint
pnpm typecheck
```

- [ ] **Step 5: Commit**

```powershell
git add src/features/schedule tests/unit/features
git commit -m "feat(schedule): 增加日程异步组合式逻辑"
```

### Task 3: Replace the placeholder with the first usable UI vertical slice

**Files:**
- Create: `src/features/schedule/components/ScheduleComposer.vue`
- Create: `src/features/schedule/components/ScheduleList.vue`
- Create: `src/features/schedule/components/ScheduleListItem.vue`
- Modify: `src/pages/index.vue`
- Create: `src/pages/schedule/[id].vue`
- Test: `tests/unit/features/schedule-ui.test.ts`

**Interfaces:**
- `ScheduleComposer` emits `submit` with `CreateScheduleInput` and exposes accessible labels for title, recurrence, comment, and submit.
- `ScheduleList` receives `readonly ScheduleDto[]`; it emits `select` with a schedule ID.
- The home page composes list and create behavior through the Task 2 composables.

- [ ] **Step 1: Write failing component tests**

Cover empty state, list rows, event/todo kind label, create form validation, submit-disabled loading state, application error rendering, and keyboard-accessible navigation.

```ts
expect(wrapper.get('[role="heading"][name="今日日程"]'))
expect(wrapper.get('label[for="schedule-title"]'))
await wrapper.get('#schedule-title').setValue('周会')
await wrapper.get('form').trigger('submit')
expect(wrapper.emitted('submit')?.[0]).toEqual([{ title: '周会', recurrenceCode: '', exclusionCode: '', comment: '' }])
```

- [ ] **Step 2: Verify RED**

Run: `pnpm vitest run tests/unit/features/schedule-ui.test.ts`

Expected: FAIL because the feature components do not exist.

- [ ] **Step 3: Implement the accessible Naive UI components**

Use `NForm`, `NInput`, `NButton`, `NList`, `NEmpty`, and `NAlert`. Keep Chinese UI copy in components; do not copy legacy EventBus or Axios code.

- [ ] **Step 4: Implement list and detail pages**

Home layout contains a compact navigation header, filter controls, schedule list, and composer. Detail page uses the typed route ID and shows title, kind, recurrence source, comment, starred state, and ISO timestamps formatted for display only.

- [ ] **Step 5: Verify GREEN**

Run:

```powershell
pnpm vitest run tests/unit/features/schedule-ui.test.ts
pnpm build:web
pnpm build:electron
```

- [ ] **Step 6: Commit**

```powershell
git add src/features/schedule/components src/pages tests/unit/features/schedule-ui.test.ts
git commit -m "feat(ui): 实现日程列表与创建界面"
```

### Task 4: Add design tokens, preferences, and responsive application shell

**Files:**
- Create: `src/assets/styles/tokens.css`
- Modify: `src/assets/styles/main.css`
- Create: `src/app/naive-theme.ts`
- Create: `src/stores/preferences.ts`
- Create: `src/pages/settings.vue`
- Modify: `src/App.vue`
- Test: `tests/unit/stores/preferences.test.ts`

**Interfaces:**
- Produces: `usePreferencesStore()` containing only theme mode, calendar mode, week start, and compact-density preferences.
- Produces: one typed Naive UI theme override consumed at the application shell.

- [ ] **Step 1: Write failing preference tests**

Test defaults, explicit updates, and localStorage round trip with an injected storage adapter. Do not persist schedule DTOs in Pinia.

- [ ] **Step 2: Verify RED**

Run: `pnpm vitest run tests/unit/stores/preferences.test.ts`

- [ ] **Step 3: Implement tokens and preferences**

Define semantic custom properties for canvas, surfaces, text, accent, danger, border, radius, spacing, and elevation. Use native CSS layers and logical properties; do not add Tailwind or Less.

- [ ] **Step 4: Add settings UI and responsive shell**

The shell must remain usable at 360px width and desktop widths. Settings controls must use labels and native/Naive UI focus states.

- [ ] **Step 5: Verify**

Run:

```powershell
pnpm vitest run tests/unit/stores/preferences.test.ts tests/unit/features
pnpm check
```

- [ ] **Step 6: Commit**

```powershell
git add src/assets/styles src/app/naive-theme.ts src/stores src/pages/settings.vue src/App.vue tests/unit/stores
git commit -m "style(ui): 建立响应式主题与偏好设置"
```

### Task 5: Connect the UI to the Electron host without coupling Vue to Electron

**Files:**
- Create: `src/platform/host/host-api.ts`
- Create: `src/platform/host/host-gateway.ts`
- Modify: `src/main.ts`
- Modify: `src-electron/preload/schedule-api.ts`
- Modify: `src-electron/main/index.ts`
- Test: `tests/contracts/host-api.test.ts`
- Test: `tests/e2e/electron/schedule-ui.spec.ts`

**Interfaces:**
- Produces: `HostScheduleApiSchema` that checks the presence of exactly the named schedule methods without importing Electron types.
- Produces: `createHostGateway(host: unknown): PlatformGateway`.
- Main process must instantiate `DrizzleScheduleRepository`, an application schedule service, and register typed IPC handlers before creating the window.

- [ ] **Step 1: Write failing host adapter tests**

Reject absent host APIs, raw `invoke`, and missing named methods. Prove the adapter delegates only `createSchedule`, `findScheduleById`, and `listSchedules`.

- [ ] **Step 2: Verify RED**

Run: `pnpm vitest run tests/contracts/host-api.test.ts`

- [ ] **Step 3: Implement host discovery and gateway adaptation**

Use `Reflect.get(globalThis, 'scheduleHost')` as `unknown`, validate its shape, then adapt it. Browser startup falls back to `createInMemoryGateway`; Electron startup receives the validated host gateway. Do not import `src-electron` from `src`.

- [ ] **Step 4: Wire repository and application service in Electron composition root**

Keep construction in `src-electron/main/index.ts`; move business behavior into `src/application/schedule-service.ts`. The service produces DTOs and consumes `ScheduleRepository`, `Clock`, and `IdGenerator`.

- [ ] **Step 5: Write and run Electron UI E2E**

Create through the visible form, assert the row appears, restart Electron with a temporary database path, and assert persistence. Also assert `typeof process === 'undefined'` in renderer.

Run:

```powershell
pnpm vitest run tests/contracts/host-api.test.ts tests/integration/ipc tests/integration/database
pnpm test:e2e:electron
```

- [ ] **Step 6: Commit**

```powershell
git add src/application src/platform/host src/main.ts src-electron tests/contracts/host-api.test.ts tests/e2e/electron package.json
git commit -m "feat(electron): 接通日程界面与本地持久化"
```

## Deferred After This Plan

- Month/week calendar visualization, todo completion, concentration records, sync, alarms, tray, autostart, Iconify consolidation, packaging, signing, and legacy deletion remain owned by Tasks 9–12 of the main rebuild plan.
- Do not start these until the schedule list/create/detail vertical slice works in both Web and Electron.
- Before visual regression work, ask the user to install the selected Iconify package and Playwright Chromium using project-level download scripts.

## Final Verification

Run from a clean working tree except for the explicitly preserved `.npmrc` decision:

```powershell
pnpm check
pnpm parser:check-generated
pnpm vitest run tests/integration
pnpm test:e2e:electron
pnpm build:web
pnpm build:electron
```

Expected: all commands exit zero; the Web build runs with the in-memory gateway; Electron shows the same UI through the typed host gateway; no file under `src` imports Electron or Node.

## Plan Self-Review

- Spec coverage: gateway bootstrap, async composables, usable list/create/detail UI, responsive styling, settings, and Electron persistence each have an owning task.
- Scope: calendar, sync, alarms, packaging, and legacy deletion are explicitly deferred to the main rebuild plan.
- Type consistency: every UI path consumes `PlatformGateway`; preload method names match the implemented IPC API.
- Dependency consistency: no new dependency is required until the later Iconify/Playwright visual phase.
