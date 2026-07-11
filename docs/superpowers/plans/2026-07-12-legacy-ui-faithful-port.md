# Schedule v2 Legacy UI Faithful Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the divergent v2 presentation with a faithful, browser-runnable port of the release/1.2.0 UI and its supported interactions.

**Architecture:** Vue pages and components reproduce the legacy information architecture while consuming only `PlatformGateway`, schedule composables, and the client-only preferences store. A small recurrence presentation helper extracts the first concrete date/time for calendar placement without pretending to implement the legacy occurrence engine.

**Tech Stack:** Vue 3.5, Vue Router 5, Pinia 3, Naive UI 2, Zod 4, Vitest, Vue Test Utils, Playwright, native CSS.

## Global Constraints

- `src` remains browser-runnable and must not import Electron, Node, Drizzle, SQLite, Prisma, Axios, EventBus, Luxon, or `src-electron`.
- `src/renderer/src` is a read-only UI reference; do not modify it.
- Preserve `PlatformGateway`, DTO, IPC, and database boundaries.
- Use RED → GREEN → REFACTOR for every behavior change.
- Do not fake unsupported completion, sync, login, occurrence, record, edit, star, or delete mutations.
- All new commit subjects use a Conventional Commit type followed by concise Chinese text.

---

### Task 1: Restore the legacy application shell

**Files:**
- Create: `src/app/components/LegacyAppShell.vue`
- Create: `src/features/ideas/IdeaPane.vue`
- Modify: `src/App.vue`
- Modify: `src/router.ts`
- Modify: `src/assets/styles/main.css`
- Test: `tests/unit/app-shell.test.ts`

**Interfaces:**
- Produces: a shell with `Home`, `Database`, `Settings`, `Help`, Guest avatar, footer, Idea pane, and `Ctrl+ArrowLeft/Right` navigation.

- [ ] **Step 1: Write the failing shell test**

Mount `App` with Pinia/router and assert the four navigation labels, Guest, `© 2023`, Idea button, active route content, and keyboard route cycling.

- [ ] **Step 2: Verify RED**

Run: `.\node_modules\.bin\vitest.cmd run tests/unit/app-shell.test.ts`

Expected: FAIL because the legacy shell is absent.

- [ ] **Step 3: Implement the minimum shell**

Use Naive `NLayout`, `NMenu`, `NAvatar`, `NPopover`, and `NInput`. Persist Idea text under `schedule-v2-ideas`. Keep theme provider in `App.vue`.

- [ ] **Step 4: Verify GREEN**

Run: `.\node_modules\.bin\vitest.cmd run tests/unit/app-shell.test.ts && pnpm typecheck`

- [ ] **Step 5: Commit**

```powershell
git add src/app src/features/ideas src/App.vue src/router.ts src/assets/styles/main.css tests/unit/app-shell.test.ts
git commit -m "feat(ui): 恢复旧版应用外壳"
```

### Task 2: Restore the legacy home workspace and Add modal

**Files:**
- Create: `src/features/schedule/components/LegacyScheduleModal.vue`
- Create: `src/features/schedule/components/TodoSidebar.vue`
- Create: `src/features/schedule/components/MonthScheduleView.vue`
- Create: `src/features/schedule/components/WeekScheduleView.vue`
- Create: `src/features/schedule/recurrence-presentation.ts`
- Modify: `src/features/schedule/components/ScheduleListItem.vue`
- Modify: `src/pages/index.vue`
- Test: `tests/unit/features/legacy-home-ui.test.ts`
- Test: `tests/unit/features/recurrence-presentation.test.ts`

**Interfaces:**
- Produces: `parseFirstScheduleDate(code: string): { dateKey: string; timeLabel: string } | null`.
- Produces: old-style Todo sider, month/week toolbar, calendar views, and modal emitting `CreateScheduleInput`.

- [ ] **Step 1: Write failing helper and component tests**

Cover ISO and slash dates, invalid recurrence text, Todo table headings, month/week switching, Add modal labels, submit validation, and `Ctrl+ArrowUp/Down/Enter`.

- [ ] **Step 2: Verify RED**

Run: `.\node_modules\.bin\vitest.cmd run tests/unit/features/recurrence-presentation.test.ts tests/unit/features/legacy-home-ui.test.ts`

- [ ] **Step 3: Implement recurrence presentation and old-style components**

Parse only the first `YYYY-MM-DD HH:mm` or `YYYY/MM/DD HH:mm` token. Use `NCalendar` for month and five CSS-grid day columns for week. Route cards to `schedule-detail`.

- [ ] **Step 4: Integrate real list/create behavior**

Use `useScheduleList` and `useScheduleMutations`; filter todos/events from the same readonly list. Refresh after create and close the modal only on a successful result.

- [ ] **Step 5: Verify GREEN**

Run: `.\node_modules\.bin\vitest.cmd run tests/unit/features && pnpm build:web`

- [ ] **Step 6: Commit**

```powershell
git add src/features/schedule src/pages/index.vue tests/unit/features
git commit -m "feat(ui): 恢复旧版首页与新增交互"
```

### Task 3: Restore Database, detail, Settings, and Help pages

**Files:**
- Create: `src/pages/database.vue`
- Create: `src/pages/help.vue`
- Modify: `src/pages/schedule/[id].vue`
- Modify: `src/pages/settings.vue`
- Modify: `src/router.ts`
- Test: `tests/unit/features/legacy-secondary-pages.test.ts`

**Interfaces:**
- Database consumes `PlatformGateway` through `useScheduleList` and routes rows by ID.
- Settings updates `themeMode`, `calendarMode`, `weekStart`, and `compactDensity` through `usePreferencesStore.update`.

- [ ] **Step 1: Write failing page tests**

Assert Database card/filter/table structure, detail PageHeader/Info/Times cards, Settings `Appearance` and `Preferences` cards, and Help shortcut text.

- [ ] **Step 2: Verify RED**

Run: `.\node_modules\.bin\vitest.cmd run tests/unit/features/legacy-secondary-pages.test.ts`

- [ ] **Step 3: Implement the pages and routes**

Match old padding, cards, labels, and English UI copy. Use explicit disabled actions for unsupported mutations and an empty Times state.

- [ ] **Step 4: Verify GREEN**

Run: `.\node_modules\.bin\vitest.cmd run tests/unit/features/legacy-secondary-pages.test.ts tests/unit/stores/preferences.test.ts && pnpm check`

- [ ] **Step 5: Commit**

```powershell
git add src/pages src/router.ts tests/unit/features/legacy-secondary-pages.test.ts
git commit -m "feat(ui): 恢复旧版次级页面"
```

### Task 4: Verify Web and Electron parity

**Files:**
- Modify: `tests/e2e/electron/schedule-ui.spec.ts`
- Modify: `tests/e2e/electron/startup.spec.ts`

**Interfaces:**
- Electron E2E creates through the old-style Add modal and verifies the schedule card after restart.

- [ ] **Step 1: Update E2E expectations before implementation verification**

Expect Home navigation, month/week toolbar, Add modal, Guest shell, and persisted schedule card.

- [ ] **Step 2: Run focused verification**

Run: `pnpm check && pnpm build:electron`

- [ ] **Step 3: Run Electron E2E**

Run: `pnpm test:e2e:electron`

- [ ] **Step 4: Final architecture checks**

Run: `rg "electron|node:|drizzle|better-sqlite3|@prisma|axios|EventBus|luxon" src -g "*.ts" -g "*.vue"` and confirm no matches outside excluded legacy directories.

- [ ] **Step 5: Commit**

```powershell
git add tests/e2e/electron
git commit -m "test(electron): 验证旧版界面持久化流程"
```
