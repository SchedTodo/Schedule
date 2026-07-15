# Schedule v2 Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild Schedule as a platform-independent Vue web application with isolated Electron adapters, an ANTLR-based schedule language, typed runtime contracts, and a fresh v2 database.

**Architecture:** `src` contains the browser-runnable Vue application, domain model, application services, platform ports, contracts, and parser. `src-electron` contains Electron lifecycle code, preload/IPC adapters, SQLite persistence, notifications, autostart, WebSocket integration, and packaging. Dependencies point inward: platform adapters depend on contracts and application ports, while `src` never imports Electron, Node database drivers, or generated database types.

**Tech Stack:** Node.js 24 LTS, pnpm 11+, ESM, TypeScript 6 strict mode, Vite 8, latest stable Vue 3, Pinia 3, Vue Router 5 typed file routes, Naive UI, VueUse, native modern CSS, Zod 4, official ANTLR TypeScript target, Temporal with a polyfill, Drizzle ORM with `better-sqlite3`, Vitest, Vue Test Utils, Playwright, fast-check, ESLint flat config, optional Oxlint, Prettier 3, Knip.

## Global Constraints

- `release-1.2.0` remains the read-only behavioral and source reference for the legacy application.
- `main` is the Schedule v2 development line; do not rewrite or force-update `release-1.2.0`.
- Use Node.js 24 LTS and pin an exact pnpm 11 version in `packageManager`; do not accept npm or yarn lockfiles.
- Use Vite 8 for the standalone Web build; Electron consumes the Web dev server or `dist-web` output.
- Use the latest stable Vue 3 release available when Task 1 is executed; prerelease, beta, RC, Vue Vapor, and Vue Router experimental data loaders are excluded.
- Keep Pinia 3 for client state. Do not introduce TanStack Query in this plan.
- `src` must run in a normal browser and must not import `electron`, `node:*`, `better-sqlite3`, Drizzle database schemas, or Electron preload globals.
- `src-electron` may depend on contracts and ports from `src`; the reverse dependency is forbidden.
- Use official ANTLR's TypeScript target. Grammar files contain no target-language actions, and generated files are never edited manually.
- Use Temporal domain types and serialize them at process/network boundaries. Do not add Moment or new Luxon usage.
- Runtime boundary data is `unknown` until validated with Zod.
- Create new SQLite databases from one reviewed complete schema. Do not add migration metadata or incremental upgrade behavior.
- Do not convert, back up, import, or otherwise support the 1.2 database.
- Use test-driven development, keep each task independently testable, and commit after every task.

---

## Target File Map

```text
src/
├─ app/
│  ├─ bootstrap.ts                 # creates the Vue app and installs adapters
│  └─ injection-keys.ts            # typed application dependency injection
├─ assets/styles/
│  ├─ tokens.css                   # design tokens and Naive UI mappings
│  └─ main.css                     # reset, layers, and application styles
├─ contracts/
│  ├─ result.ts                    # stable success/error envelopes
│  ├─ schedule.contract.ts         # Zod schemas and DTO types
│  ├─ settings.contract.ts
│  ├─ session.contract.ts
│  └─ platform.contract.ts
├─ domain/
│  ├─ schedule/
│  │  ├─ schedule.ts               # domain model and invariants
│  │  └─ recurrence.ts             # platform-neutral recurrence model
│  ├─ shared/clock.ts              # Clock port and fixed/system implementations
│  └─ shared/id-generator.ts
├─ features/
│  ├─ schedule/                    # schedule UI and async composables
│  ├─ calendar/                    # month/week presentation
│  ├─ settings/
│  └─ session/
├─ parser/
│  ├─ grammar/Schedule.g4
│  ├─ generated/                   # checked-in generated ANTLR sources
│  ├─ ast.ts
│  ├─ ast-builder.ts
│  ├─ evaluator.ts
│  ├─ diagnostics.ts
│  └─ parse-schedule.ts
├─ pages/                          # Vue Router 5 file routes
├─ platform/
│  ├─ ports.ts                     # ScheduleRepository and host capability ports
│  ├─ gateway.ts                   # UI-facing application gateway
│  └─ web/                         # HTTP/browser implementations
├─ stores/                         # small Pinia client-state stores only
├─ App.vue
├─ index.html
└─ main.ts

src-electron/
├─ main/
│  ├─ index.ts                     # composition root only
│  ├─ lifecycle.ts
│  ├─ window.ts
│  ├─ tray.ts
│  └─ ipc/register-handlers.ts
├─ preload/
│  ├─ index.ts
│  └─ schedule-api.ts
├─ adapters/
│  ├─ db/
│  │  ├─ client.ts
│  │  ├─ schema.ts
│  │  ├─ schedule-repository.ts
│  │  └─ schema.sql
│  ├─ electron-notifier.ts
│  ├─ electron-external-link.ts
│  ├─ electron-autostart.ts
│  └─ websocket-transport.ts
└─ resources/

tests/
├─ unit/
├─ parser/
├─ contracts/
├─ integration/
│  ├─ database/
│  └─ ipc/
└─ e2e/
   ├─ web/
   └─ electron/
```

### Task 1: Establish the v2 toolchain and standalone Web shell

**Files:**
- Modify: `package.json`
- Delete: `package-lock.json`
- Create: `pnpm-lock.yaml`
- Create: `pnpm-workspace.yaml`
- Modify: `tsconfig.json`
- Create: `tsconfig.app.json`
- Create: `tsconfig.electron.json`
- Modify: `vite.config.ts`
- Create: `src/index.html`
- Create: `src/main.ts`
- Create: `src/App.vue`
- Create: `src/assets/styles/main.css`
- Create: `tests/unit/app-shell.test.ts`

**Interfaces:**
- Produces: standalone `pnpm dev:web`, `pnpm build:web`, `pnpm typecheck`, and `pnpm test:unit` commands.
- Produces: a browser application that contains no Electron globals.

- [ ] **Step 1: Record the exact runtime baseline**

Run:

```powershell
node --version
corepack use pnpm@latest-11
pnpm --version
```

Expected: Node reports major version 24; `package.json` receives an exact `packageManager` value with pnpm major version 11.

- [ ] **Step 2: Replace package metadata before installing dependencies**

Set `type` to `module`, require Node 24 and pnpm 11, and define these scripts:

```json
{
  "scripts": {
    "dev:web": "vite",
    "build:web": "vue-tsc --noEmit -p tsconfig.app.json && vite build",
    "typecheck": "vue-tsc --noEmit -p tsconfig.app.json && tsc --noEmit -p tsconfig.electron.json",
    "test:unit": "vitest run tests/unit tests/contracts tests/parser",
    "test:e2e:web": "playwright test tests/e2e/web",
    "lint": "eslint .",
    "format": "prettier --write .",
    "check": "pnpm lint && pnpm typecheck && pnpm test:unit && pnpm build:web"
  }
}
```

Install stable releases only:

```powershell
pnpm add vue@latest pinia@latest vue-router@latest naive-ui@latest @vueuse/core@latest zod@latest
pnpm add -D vite@^8 @vitejs/plugin-vue@latest typescript@^6 vue-tsc@latest vitest@latest @vue/test-utils@latest jsdom@latest eslint@latest eslint-plugin-vue@latest typescript-eslint@latest prettier@^3
```

Expected: `pnpm-lock.yaml` is created and no installed package version is a prerelease.

- [ ] **Step 3: Write the failing Web shell test**

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import App from '../../src/App.vue'

describe('App shell', () => {
  it('renders without an Electron preload API', () => {
    const wrapper = mount(App)
    expect(wrapper.get('[data-testid="app-shell"]').exists()).toBe(true)
    expect('api' in window).toBe(false)
  })
})
```

- [ ] **Step 4: Run the shell test and verify the expected failure**

Run: `pnpm vitest run tests/unit/app-shell.test.ts`

Expected: FAIL because the new `src/App.vue` does not exist.

- [ ] **Step 5: Implement the minimal independent Vue shell**

`src/App.vue`:

```vue
<template>
  <main data-testid="app-shell">
    <RouterView />
  </main>
</template>
```

`src/main.ts` creates Vue, Pinia, and the router without reading `window.api`.

- [ ] **Step 6: Verify the toolchain**

Run:

```powershell
pnpm test:unit
pnpm typecheck
pnpm build:web
```

Expected: all three commands exit successfully and Vite emits `dist-web`.

- [ ] **Step 7: Commit the toolchain foundation**

```powershell
git add package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json tsconfig.app.json tsconfig.electron.json vite.config.ts src tests/unit/app-shell.test.ts
git commit -m "build: establish Schedule v2 web toolchain"
```

### Task 2: Enforce architecture boundaries and runtime contracts

**Files:**
- Create: `src/contracts/result.ts`
- Create: `src/contracts/schedule.contract.ts`
- Create: `src/contracts/platform.contract.ts`
- Create: `src/platform/ports.ts`
- Create: `src/platform/gateway.ts`
- Create: `src/app/injection-keys.ts`
- Create: `tests/contracts/schedule.contract.test.ts`
- Modify: `eslint.config.js`

**Interfaces:**
- Produces: `AppResult<T>`, `ScheduleDto`, `CreateScheduleInput`, `ScheduleGateway`, `PlatformGateway`.
- Produces: `platformGatewayKey: InjectionKey<PlatformGateway>`.

- [ ] **Step 1: Write failing contract tests**

Test that a valid create command parses, an empty title fails, unknown fields are rejected, and malformed platform results fail validation.

```ts
expect(CreateScheduleInputSchema.safeParse({
  title: 'Weekly review',
  recurrenceCode: '2026/7/13 10:00-11:00 weekly;',
  exclusionCode: '',
  comment: ''
}).success).toBe(true)

expect(CreateScheduleInputSchema.safeParse({
  title: '',
  recurrenceCode: '',
  exclusionCode: '',
  comment: ''
}).success).toBe(false)
```

- [ ] **Step 2: Run the contract test**

Run: `pnpm vitest run tests/contracts/schedule.contract.test.ts`

Expected: FAIL because the schemas do not exist.

- [ ] **Step 3: Define stable Zod contracts**

Use strict objects and export inferred DTO types. Use a discriminated result envelope:

```ts
export type AppResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: AppErrorDto }

export interface ScheduleGateway {
  create(input: CreateScheduleInput): Promise<AppResult<ScheduleDto>>
  findById(id: string): Promise<AppResult<ScheduleDto | null>>
  list(query: ScheduleListQuery): Promise<AppResult<readonly ScheduleDto[]>>
}
```

- [ ] **Step 4: Add dependency restrictions**

Configure ESLint so files below `src/**` cannot import `electron`, `node:*`, `better-sqlite3`, `drizzle-orm`, `src-electron/**`, or legacy `src/main/**` paths.

- [ ] **Step 5: Verify contracts and boundary lint**

Run: `pnpm lint && pnpm vitest run tests/contracts`

Expected: PASS.

- [ ] **Step 6: Commit contracts and ports**

```powershell
git add src/contracts src/platform src/app/injection-keys.ts tests/contracts eslint.config.js
git commit -m "feat: define platform-neutral application contracts"
```

### Task 3: Introduce Temporal domain primitives and deterministic time

**Files:**
- Create: `src/domain/shared/clock.ts`
- Create: `src/domain/shared/temporal.ts`
- Create: `src/domain/shared/id-generator.ts`
- Create: `src/domain/schedule/schedule.ts`
- Create: `src/domain/schedule/recurrence.ts`
- Create: `tests/unit/domain/clock.test.ts`
- Create: `tests/unit/domain/schedule.test.ts`

**Interfaces:**
- Produces: `Clock.now(): Temporal.Instant`.
- Produces: `SystemClock`, `FixedClock`, `IdGenerator`, `Schedule`, `RecurrenceSpec`.

- [ ] **Step 1: Add the Temporal polyfill**

Run: `pnpm add @js-temporal/polyfill@latest`

- [ ] **Step 2: Write deterministic failing tests**

```ts
const clock = new FixedClock('2026-07-11T02:00:00Z')
expect(clock.now().toString()).toBe('2026-07-11T02:00:00Z')
expect(() => Schedule.create({ title: '', clock, idGenerator })).toThrow('SCHEDULE_TITLE_EMPTY')
```

- [ ] **Step 3: Run tests and verify failure**

Run: `pnpm vitest run tests/unit/domain`

Expected: FAIL because the domain primitives do not exist.

- [ ] **Step 4: Implement immutable domain primitives**

Use Temporal internally. Store no Luxon, Moment, JavaScript `Date`, Prisma, Drizzle, Vue, or Zod types inside domain objects.

- [ ] **Step 5: Run deterministic tests**

Run: `pnpm vitest run tests/unit/domain`

Expected: PASS independently of machine date and timezone.

- [ ] **Step 6: Commit the domain baseline**

```powershell
git add package.json pnpm-lock.yaml src/domain tests/unit/domain
git commit -m "feat: add Temporal-based schedule domain"
```

### Task 4: Replace the hand-written parser with ANTLR behind a stable API

**Files:**
- Create: `tools/antlr/README.md`
- Create: `src/parser/grammar/Schedule.g4`
- Create: `src/parser/generated/**`
- Create: `src/parser/ast.ts`
- Create: `src/parser/ast-builder.ts`
- Create: `src/parser/evaluator.ts`
- Create: `src/parser/diagnostics.ts`
- Create: `src/parser/parse-schedule.ts`
- Create: `tests/parser/grammar.test.ts`
- Create: `tests/parser/golden.test.ts`
- Create: `tests/parser/property.test.ts`
- Read reference: `src/main/service/timeCodeParser.ts`
- Read reference: `src/test/timeParser.test.ts`

**Interfaces:**
- Produces: `parseSchedule(source: string, context: EvaluationContext): ParseResult<ScheduleSpec>`.
- Produces: diagnostics with stable `code`, `message`, `start`, `end`, `line`, and `column` fields.

- [ ] **Step 1: Extract a legacy golden corpus**

Copy representative valid and invalid inputs from `src/test/timeParser.test.ts` into fixture data. Freeze `now`, `defaultTimeZone`, and `weekStartsOn`; do not execute legacy tests against the real clock.

- [ ] **Step 2: Write failing syntax and diagnostics tests**

Cover absolute dates, `tdy`, `tmr`, omitted years, time ranges, unknown time marks, timezone identifiers, timezone abbreviations, frequency clauses, `by[...]`, multiple statements, exclusions, and invalid token locations.

- [ ] **Step 3: Install and pin official ANTLR tooling/runtime**

Pin the same exact ANTLR version for the generator and TypeScript runtime. Add `parser:generate` and `parser:check-generated` scripts. Generated sources must be reproducible and checked in.

- [ ] **Step 4: Implement a grammar without embedded actions**

The grammar recognizes structure only. It must not read settings, current time, timezone databases, RRule, Electron, or storage.

- [ ] **Step 5: Build a platform-neutral AST and diagnostic listener**

Convert parse trees to explicitly typed AST nodes. Never export ANTLR context types from `src/parser`.

- [ ] **Step 6: Implement semantic evaluation**

Inject this context:

```ts
export interface EvaluationContext {
  readonly now: Temporal.Instant
  readonly defaultTimeZone: string
  readonly weekStartsOn: 1 | 2 | 3 | 4 | 5 | 6 | 7
  resolveTimeZoneAbbreviation(value: string): TimeZoneResolution
}
```

- [ ] **Step 7: Add property tests**

Use fast-check to verify parse-normalize-serialize stability and that invalid date/time components never produce a successful result.

- [ ] **Step 8: Run parser verification**

Run:

```powershell
pnpm parser:check-generated
pnpm vitest run tests/parser
```

Expected: all golden, diagnostic, and property tests pass with a fixed clock.

- [ ] **Step 9: Commit the ANTLR parser**

```powershell
git add tools/antlr src/parser tests/parser package.json pnpm-lock.yaml
git commit -m "feat: replace schedule parser with ANTLR"
```

### Task 5: Build the Drizzle SQLite repository and direct schema initialization

**Files:**
- Create: `src-electron/adapters/db/schema.ts`
- Create: `src-electron/adapters/db/client.ts`
- Create: `src-electron/adapters/db/schedule-mapper.ts`
- Create: `src-electron/adapters/db/schedule-repository.ts`
- Create: `src-electron/adapters/db/schema.sql`
- Create: `tests/integration/database/schedule-repository.test.ts`
- Create: `tests/integration/database/database-initialization.test.ts`
- Read reference: `src/prisma/schema.prisma`
- Read reference: `src/main/service/scheduleService.ts`

**Interfaces:**
- Consumes: domain `Schedule` and `ScheduleRepository` port.
- Produces: `DrizzleScheduleRepository` and `initializeScheduleDatabase(databasePath, schemaSql)`.

- [ ] **Step 1: Install Drizzle and SQLite driver**

Run:

```powershell
pnpm add drizzle-orm@latest better-sqlite3@latest
pnpm add -D drizzle-kit@latest @types/better-sqlite3@latest
```

- [ ] **Step 2: Write repository contract tests against a temporary database**

Cover create/read/update/delete, transactions, recurrence persistence, timestamps, soft deletion, and mapper round trips.

- [ ] **Step 3: Write failing direct-initialization tests**

Verify a missing database receives the complete current schema and an existing database is opened without conversion or upgrades.

- [ ] **Step 4: Define the reviewed complete v2 schema**

Use integer epoch milliseconds for instants, explicit nullability, foreign keys, and indexes for calendar range queries. Do not add a migration metadata table or expose inferred database row types outside this adapter.

- [ ] **Step 5: Initialize only new database files**

Execute the complete schema only when the database file did not exist before opening. Existing files are opened unchanged.

- [ ] **Step 6: Run database tests**

Run: `pnpm vitest run tests/integration/database`

Expected: repository and direct-initialization tests pass.

- [ ] **Step 7: Commit persistence and direct initialization**

```powershell
git add src-electron/adapters/db tests/integration/database package.json pnpm-lock.yaml
git commit -m "feat: 增加 Drizzle 持久化与直接建库"
```

### Task 6: Implement typed Electron IPC and secure host adapters

**Files:**
- Create: `src-electron/preload/schedule-api.ts`
- Create: `src-electron/preload/index.ts`
- Create: `src-electron/main/ipc/register-handlers.ts`
- Create: `src-electron/adapters/electron-notifier.ts`
- Create: `src-electron/adapters/electron-external-link.ts`
- Create: `src-electron/adapters/electron-autostart.ts`
- Create: `tests/integration/ipc/schedule-ipc.test.ts`
- Read reference: `src/preload/index.ts`
- Read reference: `src/main/index.ts`

**Interfaces:**
- Consumes: Zod contracts and application services.
- Produces: a minimal typed `window.scheduleHost` preload API.

- [ ] **Step 1: Write failing IPC contract tests**

Test valid requests, malformed renderer input, unknown fields, handler exceptions, and serialization of Temporal values to DTO strings.

- [ ] **Step 2: Define explicit IPC methods**

Expose named methods such as `createSchedule`, `findScheduleById`, and `listSchedules`. Do not expose a generic `invoke(name, data)` method and do not expose raw `ipcRenderer`.

- [ ] **Step 3: Validate both IPC directions**

Validate input in the main process and validate returned DTOs in preload before resolving to the renderer.

- [ ] **Step 4: Enable Electron isolation defaults**

Use `contextIsolation: true`, `sandbox: true`, and `nodeIntegration: false`. Open external URLs only after protocol allow-list validation.

- [ ] **Step 5: Run IPC tests and Electron typecheck**

Run: `pnpm vitest run tests/integration/ipc && pnpm typecheck`

Expected: PASS and no `any`-typed preload API.

- [ ] **Step 6: Commit typed host boundaries**

```powershell
git add src-electron/preload src-electron/main/ipc src-electron/adapters tests/integration/ipc
git commit -m "feat: add typed secure Electron host adapters"
```

### Task 7: Split Electron composition and consume the standalone Web build

**Files:**
- Create: `src-electron/main/index.ts`
- Create: `src-electron/main/lifecycle.ts`
- Create: `src-electron/main/window.ts`
- Create: `src-electron/main/tray.ts`
- Modify: `electron.vite.config.ts`
- Modify: `electron-builder.yml`
- Create: `tests/e2e/electron/startup.spec.ts`

**Interfaces:**
- Consumes: `dist-web` in production and the Vite Web URL in development.
- Produces: `pnpm dev:electron`, `pnpm build:electron`, and a secure Electron startup smoke test.

- [ ] **Step 1: Write a failing Electron startup test**

Launch the packaged/development Electron entry, assert exactly one main window exists, assert the Web shell is visible, and assert Node globals are unavailable in the renderer.

- [ ] **Step 2: Split lifecycle, window, and tray responsibilities**

Keep `main/index.ts` as a composition root. It may instantiate adapters and register lifecycle hooks but must not contain schedule business logic.

- [ ] **Step 3: Configure separate Web and Electron outputs**

Vite emits `dist-web`; Electron main/preload emit `dist-electron`. Packaging copies both and unpacks only required native database artifacts.

- [ ] **Step 4: Run startup and build verification**

Run:

```powershell
pnpm build:web
pnpm build:electron
pnpm playwright test tests/e2e/electron/startup.spec.ts
```

Expected: all commands pass.

- [ ] **Step 5: Commit the decoupled Electron shell**

```powershell
git add src-electron/main electron.vite.config.ts electron-builder.yml tests/e2e/electron/startup.spec.ts package.json pnpm-lock.yaml
git commit -m "refactor: decouple Electron host from Web application"
```

### Task 8: Rebuild application services and migrate Vue features

**Files:**
- Create: `src/platform/gateway.ts`
- Create: `src/features/schedule/use-schedule-list.ts`
- Create: `src/features/schedule/use-schedule-detail.ts`
- Create: `src/features/schedule/use-schedule-mutations.ts`
- Create: `src/stores/preferences.ts`
- Create: `src/pages/index.vue`
- Create: `src/pages/schedule/[id].vue`
- Create: `src/pages/settings.vue`
- Create: `src/pages/database.vue`
- Create: `tests/unit/features/schedule-composables.test.ts`
- Read reference: `src/renderer/src/**`

**Interfaces:**
- Consumes: `PlatformGateway` and stable DTOs.
- Produces: page-level async composables and small Pinia client-state stores.

- [ ] **Step 1: Write failing composable tests with an in-memory gateway**

Test loading, success, empty results, stable application errors, mutation refresh, and stale response cancellation without accessing Electron globals.

- [ ] **Step 2: Implement async composables**

Keep async database/remote data in feature composables. Pinia stores contain client-only state such as theme, calendar mode, current filters, and drafts.

- [ ] **Step 3: Add Vue Router 5 typed file routing**

Generate `src/route-map.d.ts`, use typed route parameters for schedule pages, and avoid experimental data loaders.

- [ ] **Step 4: Migrate pages by behavior rather than copying legacy internals**

Preserve user-visible schedule, todo, calendar, settings, database, and concentration workflows. Replace EventBus refreshes with explicit composable refresh methods.

- [ ] **Step 5: Verify Web-only behavior**

Run: `pnpm vitest run tests/unit/features && pnpm build:web`

Expected: pages compile and tests run with the in-memory gateway and no preload.

- [ ] **Step 6: Commit migrated application features**

```powershell
git add src/features src/stores src/pages src/platform/gateway.ts src/route-map.d.ts tests/unit/features
git commit -m "feat: rebuild schedule features on platform gateway"
```

### Task 9: Modernize styling, utilities, and icons

**Files:**
- Create: `src/assets/styles/tokens.css`
- Modify: `src/assets/styles/main.css`
- Create: `src/app/naive-theme.ts`
- Modify: migrated Vue components under `src/features/**`
- Delete after final consumer migration: legacy Less and vicons imports under `src/renderer/src/**`

**Interfaces:**
- Produces: CSS custom properties and a single typed Naive UI theme mapping.

- [ ] **Step 1: Add screenshot baselines for month, week, todo, schedule detail, and settings views**

Use Playwright with fixed viewport, timezone, clock data, and in-memory fixtures.

- [ ] **Step 2: Replace Less constructs with native CSS**

Use cascade layers, nesting, logical properties, container queries, and custom properties. Do not add Tailwind.

- [ ] **Step 3: Consolidate utilities**

Use VueUse for debounce, event cleanup, preferred color scheme, window size, and visibility where behavior matches. Keep domain utilities independent of VueUse.

- [ ] **Step 4: Consolidate icons**

Choose one Iconify family, replace mixed Ant Design/Ionicons/Tabler visual styles, and ensure icons remain accessible.

- [ ] **Step 5: Verify visual baselines and accessibility locators**

Run: `pnpm playwright test tests/e2e/web --grep @visual`

Expected: approved screenshots pass and controls can be located by role or label.

- [ ] **Step 6: Commit UI modernization**

```powershell
git add src/assets src/app/naive-theme.ts src/features tests/e2e/web package.json pnpm-lock.yaml
git commit -m "style: modernize Schedule v2 presentation"
```

### Task 10: Restore sync, alarms, and host-only capabilities through ports

**Files:**
- Create: `src/contracts/sync.contract.ts`
- Create: `src/platform/sync-transport.ts`
- Create: `src-electron/adapters/websocket-transport.ts`
- Create: `src-electron/adapters/alarm-scheduler.ts`
- Create: `tests/unit/sync/sync-service.test.ts`
- Create: `tests/integration/electron/alarm-scheduler.test.ts`
- Read reference: `src/main/websocket.ts`
- Read reference: `src/main/alarm.ts`

**Interfaces:**
- Produces: `SyncTransport`, `SyncService`, `AlarmScheduler`, and `NotificationPort`.

- [ ] **Step 1: Write deterministic sync and alarm tests**

Inject fixed clocks, fake transports, in-memory repositories, and fake notifications. Cover reconnect, duplicate messages, conflict results, DST boundaries, alarm rescheduling, and disabled notifications.

- [ ] **Step 2: Implement protocol contracts and transport adapter**

Validate every WebSocket message with Zod and keep `BrowserWindow` out of the transport. Publish domain events through an event port.

- [ ] **Step 3: Implement alarm scheduling independently of Electron Notification**

The scheduler calculates due alarms and calls `NotificationPort`; only `ElectronNotifier` imports Electron.

- [ ] **Step 4: Verify sync and alarm behavior**

Run: `pnpm vitest run tests/unit/sync tests/integration/electron/alarm-scheduler.test.ts`

Expected: PASS with no real network or system notifications.

- [ ] **Step 5: Commit platform capabilities**

```powershell
git add src/contracts/sync.contract.ts src/platform/sync-transport.ts src-electron/adapters tests/unit/sync tests/integration/electron
git commit -m "feat: restore sync and alarm platform capabilities"
```

### Task 11: Complete Web and Electron end-to-end coverage

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/web/schedule-create.spec.ts`
- Create: `tests/e2e/web/parser-diagnostics.spec.ts`
- Create: `tests/e2e/web/calendar.spec.ts`
- Create: `tests/e2e/web/settings.spec.ts`
- Create: `tests/e2e/electron/persistence.spec.ts`
- Create: `tests/e2e/electron/external-link.spec.ts`

**Interfaces:**
- Produces: repeatable Web E2E coverage and minimal Electron adapter smoke coverage.

- [ ] **Step 1: Configure deterministic Playwright projects**

Use fixed locale, timezone, viewport, fixture data, trace on first retry, screenshots only on failure, and retained video on failure.

- [ ] **Step 2: Test the primary Web journeys**

Cover create/edit/delete schedule, parser error location, todo completion, week/month navigation, settings persistence through a fake gateway, and concentration records.

- [ ] **Step 3: Test Electron-specific behavior only**

Cover local SQLite persistence across restart, preload availability, blocked Node access, allowed external HTTPS links, rejected unsafe protocols, and fresh database initialization.

- [ ] **Step 4: Run complete verification**

Run:

```powershell
pnpm check
pnpm test:e2e:web
pnpm test:e2e:electron
```

Expected: all checks pass without reliance on the legacy runtime.

- [ ] **Step 5: Commit end-to-end coverage**

```powershell
git add playwright.config.ts tests/e2e package.json pnpm-lock.yaml
git commit -m "test: cover Schedule v2 user journeys"
```

### Task 12: Remove legacy implementation and prove release readiness

**Files:**
- Delete after replacement: `src/main/**`
- Delete after replacement: `src/preload/**`
- Delete after replacement: `src/renderer/**`
- Delete after persistence replacement: `src/prisma/**`
- Delete after parser replacement: `src/test/timeParser.test.ts`
- Delete after utility migration: unused files under `src/utils/**`
- Modify: `README.md`
- Modify: `README.en.md`
- Modify: `.github/workflows/**`
- Create: `docs/architecture.md`

**Interfaces:**
- Produces: a repository containing only v2 source, documented architecture boundaries, and reproducible CI/release commands.

- [ ] **Step 1: Prove every legacy behavior has a v2 test or an explicit removal decision**

Create a review checklist mapping legacy pages, IPC calls, parser constructs, settings, database entities, sync operations, alarm behavior, tray behavior, and autostart to v2 tests or documented removals.

- [ ] **Step 2: Run Knip and dependency-boundary checks**

Remove unused packages, exports, generated aliases, old environment variables, Axios, Moment, Luxon after the final adapter is gone, Prisma, UUID, and mixed icon packages.

- [ ] **Step 3: Delete legacy source only after tests pass without it**

Run all tests before deletion, delete legacy paths, then rerun the same commands. The second run must not resolve imports through legacy aliases.

- [ ] **Step 4: Document architecture and database initialization**

Document dependency direction, platform adapter creation, ANTLR generation, fresh database initialization, Web development, Electron packaging, and future Tauri adapter requirements.

- [ ] **Step 5: Run final release verification**

Run:

```powershell
pnpm install --frozen-lockfile
pnpm check
pnpm parser:check-generated
pnpm test:e2e:web
pnpm test:e2e:electron
pnpm build:web
pnpm build:electron
```

Expected: every command exits successfully from a clean checkout using Node 24 and the pinned pnpm 11 version.

- [ ] **Step 6: Commit the completed v2 cutover**

```powershell
git add -A
git commit -m "refactor: complete Schedule v2 platform-independent rebuild"
```

## Plan Self-Review

- Spec coverage: Web/Electron separation, future Tauri compatibility, Vite 8, pnpm 11+, latest stable Vue 3, Pinia without TanStack Query, ANTLR, Temporal, Zod, Drizzle, direct database initialization, Playwright, modern CSS, sync, alarm, and release verification each have an owning task.
- Placeholder scan: the implementation deliberately excludes prerelease Vue, experimental router loaders, TypeScript 7 preview, `node:sqlite` RC, Tailwind, and TanStack Query rather than leaving their adoption undecided.
- Type consistency: UI consumes `PlatformGateway`; Electron implements it through typed contracts; persistence implements `ScheduleRepository`; parser returns `ScheduleSpec`; all cross-process types are DTOs validated by Zod.
- Scope control: each task ends with an independently reviewable test/build result and commit. If execution proves a task too large, split it only at its testable interface boundaries without changing the interfaces declared above.
