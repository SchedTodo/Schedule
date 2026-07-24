# GAP-05 Release and End-to-End Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide reproducible local Windows x64 NSIS packaging, complete Schedule v2 Web/Electron end-to-end coverage, and verify the packaged application starts without legacy sources or a development server.

**Architecture:** Playwright uses one shared deterministic baseline with separate Web and Electron entry configurations. Browser-only journeys run against `vite preview` and the existing in-memory gateway; Electron tests cover only host capabilities, while a final packaged smoke test launches `release/win-unpacked/schedule.exe`. electron-builder consumes only `dist-web`, `dist-electron`, declared runtime dependencies, and resources.

**Tech Stack:** Node.js 24 LTS, pnpm 11.17.0, TypeScript 6, Playwright, Electron 43.1.0, electron-builder, Vite 8, Vue 3, Vitest, NSIS.

## Global Constraints

- Only Windows x64 NSIS and `win-unpacked` are release targets.
- Do not add macOS, Linux, signing, upload, auto-update, Tauri, sync, accounts, or CI.
- `release/1.2.0` remains immutable; `main` is the v2 development line.
- Keep `src` browser-runnable and free of Electron, Drizzle, SQLite driver, ANTLR context, and host-specific types.
- Do not delete legacy sources in GAP-05; GAP-06 owns legacy removal.
- Do not introduce TanStack Query.
- Validate renderer/main boundaries with the existing Zod contracts.
- Do not modify real Windows login-item state or require a visible Windows notification banner in E2E.
- Use RED→GREEN for behavior changes and command-level RED→GREEN for configuration.
- Run Electron GUI tests and packaged executable tests outside the sandbox.

---

## Target File Map

```text
playwright.config.ts                         # shared deterministic Playwright options
playwright.web.config.ts                     # Chromium plus Vite preview
playwright.electron.config.ts                # Electron and packaged-app runner
tests/e2e/support/web.ts                     # browser journey helpers
tests/e2e/support/electron.ts                # isolated Electron launch/cleanup
tests/e2e/web/smoke.spec.ts                  # Web harness proof
tests/e2e/web/schedule-lifecycle.spec.ts      # create/edit/delete/parser error
tests/e2e/web/calendar-todo.spec.ts           # Todo completion and month/week
tests/e2e/web/settings-focus.spec.ts          # settings and concentration flow
tests/e2e/electron/startup.spec.ts            # startup/security/tray lifecycle
tests/e2e/electron/schedule-ui.spec.ts        # SQLite restart persistence
tests/e2e/electron/host-capabilities.spec.ts  # autostart setting/notification/link
tests/e2e/package/windows-package.spec.ts     # win-unpacked and installer smoke
src/pages/index.vue                           # render schedule mutation errors
package.json                                  # real test/build/package/release scripts
pnpm-lock.yaml                                # locked electron-builder dependency
electron-builder.yml                          # Windows-only v2 packaging
.gitignore                                    # ignore release artifacts
docs/development/windows-release.md           # local release procedure
docs/development/v2-feature-gaps.md            # close GAP-05 only after verification
```

### Task 1: Establish deterministic Playwright entry points

**Files:**
- Create: `playwright.config.ts`
- Create: `playwright.web.config.ts`
- Create: `playwright.electron.config.ts`
- Create: `tests/e2e/web/smoke.spec.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: a Web project at `http://127.0.0.1:4173`.
- Produces: an Electron configuration that never starts the Web preview server.
- Produces: `pnpm test:e2e:web` backed by a real test directory.

- [ ] **Step 1: Verify the current Web E2E command fails for the expected reason**

Run:

```powershell
pnpm test:e2e:web
```

Expected: FAIL because `tests/e2e/web` does not exist.

- [ ] **Step 2: Add the shared Playwright baseline**

Create `playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  fullyParallel: false,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  retries: 0,
  use: {
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    viewport: { width: 1440, height: 900 },
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  }
})
```

Create `playwright.web.config.ts`:

```ts
import { defineConfig } from '@playwright/test'
import base from './playwright.config'

export default defineConfig({
  ...base,
  testDir: './tests/e2e/web',
  use: {
    ...base.use,
    baseURL: 'http://127.0.0.1:4173'
  },
  webServer: {
    command: 'pnpm exec vite preview --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false
  }
})
```

Create `playwright.electron.config.ts`:

```ts
import { defineConfig } from '@playwright/test'
import base from './playwright.config'

export default defineConfig({
  ...base,
  testDir: './tests/e2e',
  testIgnore: ['web/**']
})
```

- [ ] **Step 3: Add the first real Web test**

Create `tests/e2e/web/smoke.spec.ts`:

```ts
import { expect, test } from '@playwright/test'

test('loads the standalone Web application without a host preload', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-07-13T04:00:00.000Z'))
  await page.goto('/')

  await expect(page.getByRole('link', { name: 'Home' })).toBeVisible()
  await expect(page.getByText('Guest')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add' })).toBeVisible()
  await expect(page.evaluate(() => Reflect.has(globalThis, 'scheduleHost'))).resolves.toBe(false)
})
```

- [ ] **Step 4: Point the script to the real configuration**

Change the `package.json` script to:

```json
{
  "test:e2e:web": "pnpm build:web && playwright test --config playwright.web.config.ts"
}
```

- [ ] **Step 5: Verify the Web harness passes**

Run:

```powershell
pnpm test:e2e:web
```

Expected: `1 passed`; Vite preview starts and stops under Playwright control.

- [ ] **Step 6: Commit the Playwright foundation**

```powershell
git add playwright.config.ts playwright.web.config.ts playwright.electron.config.ts tests/e2e/web/smoke.spec.ts package.json
git commit -m "test(web): 建立可重复的端到端测试入口"
```

### Task 2: Cover schedule lifecycle and expose parser failures

**Files:**
- Create: `tests/e2e/support/web.ts`
- Create: `tests/e2e/web/schedule-lifecycle.spec.ts`
- Modify: `src/pages/index.vue`

**Interfaces:**
- Produces: `createSchedule(page, input)` for later Web tests.
- Consumes: the existing in-memory `PlatformGateway`.
- Produces: a user-visible alert for `useScheduleMutations().error`.

- [ ] **Step 1: Add the reusable browser journey helper**

Create `tests/e2e/support/web.ts`:

```ts
import type { Page } from '@playwright/test'

export interface ScheduleDraft {
  title: string
  recurrenceCode: string
  comment?: string
}

export async function createSchedule(page: Page, draft: ScheduleDraft): Promise<void> {
  await page.getByRole('button', { name: 'Add' }).click()
  await page.getByLabel('Name').fill(draft.title)
  await page.getByLabel('rTime').fill(draft.recurrenceCode)
  if (draft.comment !== undefined) await page.getByLabel('Comment').fill(draft.comment)
  await page.getByRole('button', { name: 'Confirm' }).click()
}
```

- [ ] **Step 2: Write the lifecycle and parser-error tests**

Create `tests/e2e/web/schedule-lifecycle.spec.ts`:

```ts
import { expect, test } from '@playwright/test'
import { createSchedule } from '../support/web'

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-07-13T04:00:00.000Z'))
  await page.goto('/')
})

test('creates, edits, and soft-deletes a Todo', async ({ page }) => {
  await createSchedule(page, {
    title: '端到端待办',
    recurrenceCode: '2026/7/13 18:00'
  })
  await page.getByText('端到端待办', { exact: true }).first().click()
  await page.getByRole('button', { name: 'Edit' }).click()
  await page.getByLabel('Name').fill('已编辑待办')
  await page.getByLabel('rTime').fill('2026/7/13 19:00')
  await page.getByRole('button', { name: 'Confirm' }).click()
  await expect(page.getByText('已编辑待办', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Delete' }).first().click()
  await page.getByRole('button', { name: 'Confirm' }).click()
  await expect(page).toHaveURL(/#\/database$/)
  await expect(page.getByRole('row', { name: /已编辑待办.*true/ })).toBeVisible()
})

test('shows a parser error instead of silently closing the workflow', async ({ page }) => {
  await createSchedule(page, {
    title: '无效日程',
    recurrenceCode: 'not a schedule expression'
  })

  await expect(page.getByRole('alert')).toContainText('日程数据无效')
  await expect(page.getByText('无效日程', { exact: true })).toHaveCount(0)
})
```

- [ ] **Step 3: Run the focused tests and verify RED**

Run:

```powershell
pnpm build:web
pnpm exec playwright test --config playwright.web.config.ts tests/e2e/web/schedule-lifecycle.spec.ts
```

Expected: lifecycle assertions pass or reveal locator corrections; parser-error test FAILS because the mutation error is not rendered.

- [ ] **Step 4: Render the existing mutation error with the smallest production change**

In `src/pages/index.vue`, add `NAlert` to the existing Naive UI import and render:

```vue
<NAlert
  v-if="mutations.error.value"
  type="error"
  role="alert"
>
  {{ mutations.error.value.message }}
</NAlert>
```

Place it immediately after `.home-toolbar`; do not change the composable or modal contract.

- [ ] **Step 5: Verify GREEN**

Run:

```powershell
pnpm exec playwright test --config playwright.web.config.ts tests/e2e/web/schedule-lifecycle.spec.ts
pnpm exec vitest run tests/unit/features/schedule-ui.test.ts tests/unit/features/schedule-composables.test.ts
```

Expected: both E2E tests and focused unit tests pass.

- [ ] **Step 6: Commit the lifecycle coverage**

```powershell
git add tests/e2e/support/web.ts tests/e2e/web/schedule-lifecycle.spec.ts src/pages/index.vue
git commit -m "test(web): 覆盖日程生命周期与解析错误"
```

### Task 3: Cover Todo, calendar, settings, and focus journeys

**Files:**
- Create: `tests/e2e/web/calendar-todo.spec.ts`
- Create: `tests/e2e/web/settings-focus.spec.ts`

**Interfaces:**
- Consumes: `createSchedule(page, draft)`.
- Produces: browser-level acceptance coverage for every remaining Web requirement.

- [ ] **Step 1: Add Todo completion and month/week coverage**

Create `tests/e2e/web/calendar-todo.spec.ts`:

```ts
import { expect, test } from '@playwright/test'
import { createSchedule } from '../support/web'

test('completes a Todo and switches between month and week views', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-07-13T04:00:00.000Z'))
  await page.goto('/')
  await createSchedule(page, {
    title: '日历待办',
    recurrenceCode: '2026/7/13 18:00'
  })

  await expect(page.getByTestId('month-view').getByText('日历待办')).toBeVisible()
  await page.getByRole('button', { name: 'week', exact: true }).click()
  await expect(page.getByTestId('week-view').getByText('日历待办')).toBeVisible()
  await page.getByRole('button', { name: 'month', exact: true }).click()
  await expect(page.getByTestId('month-view')).toBeVisible()

  const row = page.getByRole('row', { name: /日历待办/ })
  await row.getByRole('checkbox', { name: 'Done' }).check()
  await expect(row.getByRole('checkbox', { name: 'Done' })).toBeChecked()
})
```

- [ ] **Step 2: Add settings and focus coverage**

Create `tests/e2e/web/settings-focus.spec.ts`:

```ts
import { expect, test } from '@playwright/test'
import { createSchedule } from '../support/web'

test('updates settings and completes a focus-stage transition with a virtual clock', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-07-13T04:00:00.000Z') })
  await page.goto('/')
  await createSchedule(page, {
    title: '专注待办',
    recurrenceCode: '2026/7/13 18:00'
  })

  await page.getByRole('link', { name: 'Settings' }).click()
  await page.getByRole('radio', { name: 'TU' }).check()
  await page.getByRole('radio', { name: 'WeekView' }).check()
  const focusMinutes = page.getByText('Focus Time', { exact: true })
    .locator('xpath=following-sibling::div[1]')
    .getByRole('spinbutton')
  await focusMinutes.fill('1')
  await focusMinutes.press('Enter')
  await expect(page.getByRole('radio', { name: 'TU' })).toBeChecked()

  await page.getByRole('link', { name: 'Home' }).click()
  await page.getByRole('row', { name: /专注待办/ })
    .getByRole('button', { name: 'Concentrate' }).click()
  await expect(page.getByText('Focus 1 of 4')).toBeVisible()
  await page.getByTestId('focus-toggle').click()
  await expect(page.getByTestId('focus-toggle')).toHaveText('Pause')
  await page.getByTestId('focus-toggle').click()
  await expect(page.getByTestId('focus-toggle')).toHaveText('Resume')
  await page.getByTestId('focus-toggle').click()
  await page.clock.fastForward('01:00')
  await expect(page.getByText('Small Break')).toBeVisible()
})
```

- [ ] **Step 3: Run focused Web E2E and correct only evidence-backed locator/timing issues**

Run:

```powershell
pnpm build:web
pnpm exec playwright test --config playwright.web.config.ts tests/e2e/web/calendar-todo.spec.ts tests/e2e/web/settings-focus.spec.ts
```

Expected: `2 passed`. If Naive UI accessibility differs from the written locators, inspect the rendered role tree and adjust tests without adding test-only production hooks.

- [ ] **Step 4: Run all Web E2E**

Run:

```powershell
pnpm test:e2e:web
```

Expected: all files under `tests/e2e/web` pass.

- [ ] **Step 5: Commit the remaining Web journeys**

```powershell
git add tests/e2e/web/calendar-todo.spec.ts tests/e2e/web/settings-focus.spec.ts
git commit -m "test(web): 覆盖日历设置与专注流程"
```

### Task 4: Consolidate Electron launch isolation and cover host capabilities

**Files:**
- Create: `tests/e2e/support/electron.ts`
- Modify: `tests/e2e/electron/startup.spec.ts`
- Modify: `tests/e2e/electron/schedule-ui.spec.ts`
- Create: `tests/e2e/electron/host-capabilities.spec.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `launchSchedule(options)` and `closeSchedule(launched)`.
- Produces: isolated profile/database defaults with opt-in tray mode.
- Does not add production test hooks.

- [ ] **Step 1: Extract the shared Electron launcher**

Create `tests/e2e/support/electron.ts`:

```ts
import { _electron as electron, type ElectronApplication } from '@playwright/test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export interface LaunchScheduleOptions {
  directory?: string
  extraArgs?: readonly string[]
  databasePath?: string
  keepDirectory?: boolean
  tray?: boolean
}

export interface LaunchedSchedule {
  application: ElectronApplication
  directory: string
  databasePath: string
  keepDirectory: boolean
  profilePath: string
}

export async function launchSchedule(
  options: LaunchScheduleOptions = {}
): Promise<LaunchedSchedule> {
  const directory = options.directory ??
    mkdtempSync(join(tmpdir(), 'schedule-electron-e2e-'))
  const databasePath = options.databasePath ?? join(directory, 'schedule.db')
  const profilePath = join(directory, 'profile')
  const application = await electron.launch({
    args: [`--user-data-dir=${profilePath}`, '.', ...(options.extraArgs ?? [])],
    env: {
      ...process.env,
      SCHEDULE_DATABASE_PATH: databasePath,
      ...(options.tray ? {} : { SCHEDULE_DISABLE_TRAY: '1' })
    }
  })
  return {
    application,
    directory,
    databasePath,
    keepDirectory: options.keepDirectory ?? false,
    profilePath
  }
}

export async function closeSchedule(launched: LaunchedSchedule): Promise<void> {
  try {
    await launched.application.close()
  } finally {
    if (!launched.keepDirectory) {
      rmSync(launched.directory, { recursive: true, force: true })
    }
  }
}
```

Update both existing Electron specs to use this helper. For the restart
persistence test, close the first launch with `keepDirectory: true`, then
launch with `{ directory: first.directory }`; the second close removes the
shared profile and database.

- [ ] **Step 2: Preserve the existing startup and persistence evidence**

Run:

```powershell
pnpm build:web
pnpm build:electron
pnpm exec playwright test --config playwright.electron.config.ts tests/e2e/electron/startup.spec.ts tests/e2e/electron/schedule-ui.spec.ts
```

Expected: the existing startup/security/persistence tests pass after helper extraction.

- [ ] **Step 3: Add a tray lifecycle E2E**

Add to `startup.spec.ts`:

```ts
test('hides on close while tray mode is active and restores on activate', async () => {
  const launched = await launchSchedule({ tray: true })
  try {
    await launched.application.firstWindow()
    await launched.application.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.close()
    })
    await expect.poll(() => launched.application.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0]?.isVisible()
    )).toBe(false)
    expect(launched.application.process().exitCode).toBeNull()

    await launched.application.evaluate(({ app }) => { app.emit('activate') })
    await expect.poll(() => launched.application.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0]
      return window && {
        visible: window.isVisible(),
        maximized: window.isMaximized(),
        focused: window.isFocused()
      }
    })).toEqual({ visible: true, maximized: true, focused: true })
  } finally {
    await closeSchedule(launched)
  }
})
```

- [ ] **Step 4: Add safe autostart-setting, notification, and external-link tests**

Create `tests/e2e/electron/host-capabilities.spec.ts` with three tests:

```ts
import { expect, test } from '@playwright/test'
import { closeSchedule, launchSchedule } from '../support/electron'

test('routes Open At Login through app.setLoginItemSettings without changing the host', async () => {
  const launched = await launchSchedule()
  try {
    const window = await launched.application.firstWindow()
    await launched.application.evaluate(({ app }) => {
      const state = globalThis as typeof globalThis & { capturedLogin?: boolean }
      app.setLoginItemSettings = (settings) => { state.capturedLogin = settings.openAtLogin }
    })
    await window.getByRole('link', { name: 'Settings' }).click()
    await window.getByText('Open At Login', { exact: true })
      .locator('xpath=following-sibling::div[1]').getByRole('switch').click()
    await expect.poll(() => launched.application.evaluate(() =>
      (globalThis as typeof globalThis & { capturedLogin?: boolean }).capturedLogin
    )).toBe(true)
  } finally {
    await closeSchedule(launched)
  }
})

test('validates and delivers a notification through preload and IPC', async () => {
  const launched = await launchSchedule()
  try {
    const window = await launched.application.firstWindow()
    await launched.application.evaluate(({ Notification }) => {
      const state = globalThis as typeof globalThis & {
        capturedNotification?: { title: string; body: string }
      }
      Notification.prototype.show = function () {
        state.capturedNotification = { title: this.title, body: this.body }
      }
    })
    const result = await window.evaluate(async () => {
      const host = Reflect.get(window, 'scheduleHost') as {
        showNotification(input: { title: string; body: string }): Promise<unknown>
      }
      return host.showNotification({ title: 'Focus', body: 'Focus 2' })
    })
    expect(result).toMatchObject({ ok: true })
    await expect.poll(() => launched.application.evaluate(() =>
      (globalThis as typeof globalThis & {
        capturedNotification?: { title: string; body: string }
      }).capturedNotification
    )).toEqual({ title: 'Focus', body: 'Focus 2' })
  } finally {
    await closeSchedule(launched)
  }
})

test('delegates HTTPS externally and rejects unsafe protocols', async () => {
  const launched = await launchSchedule()
  try {
    const window = await launched.application.firstWindow()
    await launched.application.evaluate(({ shell }) => {
      const state = globalThis as typeof globalThis & { externalUrls?: string[] }
      state.externalUrls = []
      shell.openExternal = async (url) => { state.externalUrls?.push(url) }
    })
    await window.evaluate(() => { window.open('https://example.com/help') })
    await expect.poll(() => launched.application.evaluate(() =>
      (globalThis as typeof globalThis & { externalUrls?: string[] }).externalUrls
    )).toEqual(['https://example.com/help'])
    await window.evaluate(() => { window.open('file:///C:/secret.txt') })
    await expect.poll(() => launched.application.windows().length).toBe(1)
    expect(await launched.application.evaluate(() =>
      (globalThis as typeof globalThis & { externalUrls?: string[] }).externalUrls
    )).toEqual(['https://example.com/help'])
  } finally {
    await closeSchedule(launched)
  }
})
```

- [ ] **Step 5: Point Electron E2E at its actual configuration**

Change/add the scripts:

```json
{
  "test:integration": "vitest run tests/integration",
  "test:e2e:electron": "pnpm electron:rebuild-native && pnpm build:web && pnpm build:electron && playwright test --config playwright.electron.config.ts tests/e2e/electron"
}
```

- [ ] **Step 6: Run Electron E2E outside the sandbox**

Run:

```powershell
pnpm test:e2e:electron
```

Expected: persistence, window security, tray lifecycle, autostart setting, notification IPC, and external-link tests all pass. Follow `docs/development/electron-e2e-troubleshooting.md` before modifying product code for GUI-process failures.

- [ ] **Step 7: Commit the Electron host coverage**

```powershell
git add tests/e2e/support/electron.ts tests/e2e/electron package.json
git commit -m "test(electron): 覆盖桌面宿主端到端边界"
```

### Task 5: Add Windows packaging and packaged-app verification

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `electron-builder.yml`
- Modify: `.gitignore`
- Create: `tests/e2e/package/windows-package.spec.ts`
- Create: `docs/development/windows-release.md`

**Interfaces:**
- Produces: `package:win`, `test:package:win`, and `release:win`.
- Produces: `release/win-unpacked/schedule.exe`.
- Produces: `release/schedule-${version}-setup.exe`.

- [ ] **Step 1: Verify the packaging command is currently absent**

Run:

```powershell
pnpm package:win
```

Expected: FAIL with `Command "package:win" not found`.

- [ ] **Step 2: Add electron-builder using the pinned package manager**

Run:

```powershell
pnpm add --save-dev electron-builder
```

Expected: `package.json` and `pnpm-lock.yaml` change; `packageManager` remains exactly pinned. During execution, pnpm 11.11.0 reproducibly stalled on this dependency graph, so the pin was upgraded to pnpm 11.17.0 before adding electron-builder.

- [ ] **Step 3: Replace unapproved builder targets with the Windows-only configuration**

Set `electron-builder.yml` to:

```yaml
appId: top.sicongchen.schedule
productName: schedule
directories:
  buildResources: build
  output: release
files:
  - dist-web/**
  - dist-electron/**
  - package.json
  - resources/**
asarUnpack:
  - node_modules/better-sqlite3/**
win:
  target:
    - target: nsis
      arch:
        - x64
  executableName: schedule
  icon: resources/icon256.ico
nsis:
  artifactName: ${name}-${version}-setup.${ext}
  shortcutName: ${productName}
  uninstallDisplayName: ${productName}
  createDesktopShortcut: always
  allowToChangeInstallationDirectory: true
  oneClick: false
  menuCategory: false
  perMachine: false
npmRebuild: false
```

Add `/release/` to `.gitignore`.

- [ ] **Step 4: Add real packaging and release scripts**

Add:

```json
{
  "package:win": "pnpm electron:rebuild-native && pnpm build:web && pnpm build:electron && electron-builder --win nsis --x64 --publish never",
  "test:package:win": "playwright test --config playwright.electron.config.ts tests/e2e/package",
  "release:win": "pnpm lint && pnpm typecheck && pnpm test:unit && pnpm test:integration && pnpm test:e2e:web && pnpm test:e2e:electron && pnpm package:win && pnpm test:package:win"
}
```

- [ ] **Step 5: Write the packaged executable and installer test**

Create `tests/e2e/package/windows-package.spec.ts`:

```ts
import { _electron as electron, expect, test } from '@playwright/test'
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const packageJson = JSON.parse(readFileSync(resolve('package.json'), 'utf8')) as {
  name: string
  version: string
}

test('launches the unpacked production app and has a non-empty NSIS installer', async () => {
  const executable = resolve('release/win-unpacked/schedule.exe')
  const installer = resolve(
    `release/${packageJson.name}-${packageJson.version}-setup.exe`
  )
  expect(statSync(installer).size).toBeGreaterThan(0)

  const directory = mkdtempSync(join(tmpdir(), 'schedule-packaged-e2e-'))
  const application = await electron.launch({
    executablePath: executable,
    args: [`--user-data-dir=${join(directory, 'profile')}`],
    env: {
      ...process.env,
      SCHEDULE_DATABASE_PATH: join(directory, 'schedule.db'),
      SCHEDULE_DISABLE_TRAY: '1'
    }
  })
  try {
    const window = await application.firstWindow()
    await expect(window.getByRole('link', { name: 'Home' })).toBeVisible()
    await expect.poll(() => window.evaluate(() => location.protocol)).toBe('file:')
    await expect.poll(() => window.evaluate(() => typeof process)).toBe('undefined')
    await expect.poll(() => window.evaluate(() =>
      typeof Reflect.get(window, 'scheduleHost')
    )).toBe('object')
  } finally {
    await application.close()
    rmSync(directory, { recursive: true, force: true })
  }
})
```

- [ ] **Step 6: Document the local Windows workflow**

Create `docs/development/windows-release.md` with these exact sections and commands:

````markdown
# Windows 本地发布

## 支持范围

Schedule v2 当前只验证 Windows x64 NSIS。本流程不包含签名、上传、自动更新、macOS 或 Linux。

## 环境

- Node.js 24 LTS
- `package.json#packageManager` 固定的 pnpm 11.17.0
- Windows 桌面会话；Electron E2E 和产物冒烟必须允许启动 GUI 子进程

## 安装依赖

```powershell
corepack enable
pnpm install --frozen-lockfile
```

## 完整本地发布

```powershell
pnpm release:win
```

## 单独打包与验证

```powershell
pnpm package:win
pnpm test:package:win
```

产物位于 `release/win-unpacked/` 和
`release/schedule-<version>-setup.exe`。安装程序未签名，Windows 可能显示
SmartScreen 提示。生产应用从打包的 `dist-web` 加载，不需要 Vite 开发服务器。
````

- [ ] **Step 7: Build the installer**

Run:

```powershell
pnpm package:win
```

Expected: exit 0; both `release/win-unpacked/schedule.exe` and the versioned setup executable exist.

- [ ] **Step 8: Run the packaged smoke outside the sandbox**

Run:

```powershell
pnpm test:package:win
```

Expected: `1 passed`, `location.protocol === "file:"`, preload available, Node unavailable.

- [ ] **Step 9: Commit the Windows release chain**

```powershell
git add package.json pnpm-lock.yaml electron-builder.yml .gitignore tests/e2e/package/windows-package.spec.ts docs/development/windows-release.md
git commit -m "build: 增加 Windows 本地发布链路"
```

### Task 6: Run release verification and close GAP-05

**Files:**
- Modify: `docs/development/v2-feature-gaps.md`

**Interfaces:**
- Consumes: every command introduced above.
- Produces: evidence-backed `GAP-05` closure.

- [ ] **Step 1: Install exactly the locked dependency graph**

Run:

```powershell
pnpm install --frozen-lockfile
```

Expected: exit 0 and no lockfile diff.

- [ ] **Step 2: Run non-GUI verification**

Run:

```powershell
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm test:integration
pnpm build:web
pnpm build:electron
```

Expected: every command exits 0.

- [ ] **Step 3: Run the complete local release outside the sandbox**

Run:

```powershell
pnpm release:win
```

Expected: Web E2E, Electron E2E, electron-builder, packaged smoke, and all prerequisite checks exit 0.

- [ ] **Step 4: Verify the package does not contain legacy source paths**

Inspect the builder file list and unpacked output:

```powershell
rg -n "src/main|src/preload|src/renderer|VITE_DEV_SERVER_URL" electron-builder.yml package.json
rg --files release/win-unpacked | rg "src[\\/](main|preload|renderer)"
```

Expected: neither command reports legacy source files in the builder inputs or
the unpacked application. Confirm the packaged smoke reported a `file:` URL.

- [ ] **Step 5: Update the authoritative gap baseline**

In `docs/development/v2-feature-gaps.md`:

- Change the summary row for `GAP-05` to `已完成`.
- Change the GAP-05 section status to `已完成（2026-07-24）`.
- Add a completion summary covering Web journeys, Electron host boundaries, Windows x64 NSIS, and packaged `file:` startup.
- Record the exact successful commands from Steps 1–3.
- Do not change `GAP-06`.

- [ ] **Step 6: Re-run documentation-sensitive checks**

Run:

```powershell
git diff --check
pnpm lint
```

Expected: exit 0.

- [ ] **Step 7: Commit the evidence-backed closure**

```powershell
git add docs/development/v2-feature-gaps.md
git commit -m "docs: 记录发布与端到端验证关闭"
```

## Plan Self-Review

- Spec coverage: Windows NSIS, Web create/edit/delete/Todo/calendar/parser/settings/focus, Electron persistence/security/tray/autostart/notification/external-link, real scripts, local documentation, and production `file:` startup each have an owning task.
- Scope control: no CI, signing, auto-update, non-Windows target, legacy deletion, sync, account, or Tauri work is included.
- Test discipline: parser-error visibility follows a witnessed failing E2E; configuration uses the approved command-level RED→GREEN exception.
- Type consistency: Web helpers consume Playwright `Page`; Electron helpers produce `ElectronApplication`; renderer host calls retain the existing `ScheduleHostApi` and Zod IPC contracts.
- Side-effect control: login items, notifications, and external links are intercepted inside isolated Electron test processes.
