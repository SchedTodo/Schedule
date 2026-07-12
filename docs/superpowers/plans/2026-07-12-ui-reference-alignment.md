# Schedule v2 UI Reference Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the current v2 interface with supplied reference screenshots, restore the collapsible Todo sidebar, fix theme contrast, remove migration-oriented UI naming, and document feature gaps.

**Architecture:** Continue using Naive UI and the existing v2 gateway/store boundaries. Rename UI units by product responsibility, use `NLayoutSider` for native collapse behavior, and keep fixed navigation colors outside content theme variables.

**Tech Stack:** Vue 3.5, Naive UI 2, Pinia 3, Vitest, Vue Test Utils, Playwright, native CSS.

## Global Constraints

- Do not add a third-party layout dependency; Naive UI already supplies the required sider.
- Do not rename database migration identifiers that truthfully describe v1 compatibility.
- Current UI source and UI tests must not use `Legacy` or `legacy`.
- Preserve browser-runnable `src` and `PlatformGateway` boundaries.
- Use RED → GREEN → REFACTOR and Chinese Conventional Commit subjects.

---

### Task 1: Remove migration-oriented naming from current UI

**Files:**
- Rename: `src/app/components/LegacyAppShell.vue` → `src/app/components/AppShell.vue`
- Rename: `src/features/schedule/components/LegacyScheduleModal.vue` → `src/features/schedule/components/ScheduleModal.vue`
- Rename: `tests/unit/features/legacy-home-ui.test.ts` → `tests/unit/features/home-workspace.test.ts`
- Rename: `tests/unit/features/legacy-secondary-pages.test.ts` → `tests/unit/features/secondary-pages.test.ts`
- Modify: `src/App.vue`, `src/pages/index.vue`, current UI CSS classes, and UI test descriptions
- Test: `tests/unit/ui-source-conventions.test.ts`

**Interfaces:**
- Produces `AppShell` and `ScheduleModal` component names with unchanged public behavior.

- [ ] Write a failing source convention test that scans current UI source/test paths and rejects `/legacy/i`, excluding `src-electron/adapters/db/migrate-v1.ts` and database migration tests.
- [ ] Run `.\node_modules\.bin\vitest.cmd run tests/unit/ui-source-conventions.test.ts`; expect failure listing current UI names.
- [ ] Rename files/imports/classes/descriptions with `Move-Item` and surgical edits.
- [ ] Run the convention test and existing UI tests; expect all pass.
- [ ] Commit with `refactor(ui): 移除界面迁移命名`.

### Task 2: Fix navigation theme contrast and screenshot spacing

**Files:**
- Modify: `src/app/components/AppShell.vue`
- Modify: `src/assets/styles/main.css`
- Modify: `src/assets/styles/tokens.css`
- Test: `tests/unit/app-shell.test.ts`

**Interfaces:**
- Header/footer background is always `#001428`; navigation foreground remains light in every theme.

- [ ] Add failing assertions for explicit header background/foreground classes and active navigation contrast under light and dark preference states.
- [ ] Run the focused shell test and confirm RED.
- [ ] Move fixed navigation colors to dedicated custom properties and prevent Naive Layout theme styles from overriding header/footer.
- [ ] Add compact product icons and match screenshot gaps without introducing icon dependencies.
- [ ] Run shell tests, lint, and typecheck; expect pass.
- [ ] Commit with `fix(ui): 修复导航主题对比度`.

### Task 3: Restore collapsible Todo sider and screenshot proportions

**Files:**
- Modify: `src/pages/index.vue`
- Modify: `src/features/schedule/components/TodoSidebar.vue`
- Modify: `src/features/schedule/components/WeekScheduleView.vue`
- Modify: `src/features/schedule/components/MonthScheduleView.vue`
- Modify: `src/pages/database.vue`, `src/pages/settings.vue`, `src/pages/schedule/[id].vue`, `src/pages/help.vue`
- Test: `tests/unit/features/home-workspace.test.ts`
- Test: `tests/unit/features/secondary-pages.test.ts`

**Interfaces:**
- Home uses `NLayoutSider` with `width="30vw"`, `collapsed-width="0"`, `collapse-mode="width"`, and `show-trigger="arrow-circle"`.

- [ ] Add failing tests for the sider configuration, trigger/collapse behavior, empty Todo state, five week columns, and reference page frames.
- [ ] Run focused tests and confirm RED.
- [ ] Replace CSS grid shell with `NLayout`/`NLayoutSider`/`NLayoutContent`; retain responsive behavior.
- [ ] Match Todo table/empty state, week/month full-height behavior, centered cards, filters, settings spacing, footer, and Idea position to screenshots.
- [ ] Run all UI tests and Web build; expect pass.
- [ ] Commit with `style(ui): 对齐参考界面布局`.

### Task 4: Document gaps and run full regression

**Files:**
- Create: `docs/development/v2-feature-gaps.md`
- Modify only if needed: `tests/e2e/electron/startup.spec.ts`, `tests/e2e/electron/schedule-ui.spec.ts`

**Interfaces:**
- The gap report separates gateway/backend, UI, platform, and deferred product capabilities.

- [ ] Write the factual gap report from current interfaces and old API usage; include current `create/findById/list` boundary.
- [ ] Run `pnpm check`, parser generated check, all integration tests, Web/Electron builds, and `pnpm test:e2e:electron`.
- [ ] Run `rg -n "Legacy|legacy" src tests/unit` and confirm only database migration compatibility occurrences remain.
- [ ] Confirm Git diff contains no unrelated changes.
- [ ] Commit with `docs: 记录 v2 功能缺口`.
