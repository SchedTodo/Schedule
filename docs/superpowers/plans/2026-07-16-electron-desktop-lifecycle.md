# Electron Desktop Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Schedule v2's existing Electron window, tray, startup, shortcut, external-link, and shutdown handlers with one narrowly injected lifecycle controller that satisfies GAP-02.

**Architecture:** A `DesktopLifecycleController` owns desktop lifecycle state and calls only the small window, shortcut, quit, reporting, and disposable interfaces it needs. Electron adapters translate real `BrowserWindow`, `Tray`, and `globalShortcut` objects at the composition root; the existing direct event handlers and duplicate cleanup callbacks are removed rather than retained beside the controller.

**Tech Stack:** Electron 43, TypeScript 6 strict mode, Vitest, Playwright Electron, Vite 8, Node.js 24 LTS, pnpm 11.11.0.

## Global Constraints

- `release/1.2.0` is immutable; all work remains on `main`.
- Use Node.js 24 LTS and the exact `pnpm@11.11.0` package manager pinned in `package.json`.
- Use RED–GREEN TDD for every behavior change.
- Keep `src` browser-runnable and platform-independent; Electron types stay below `src-electron`.
- Do not add a general-purpose dependency-injection framework or wrap unused Electron APIs.
- Normal launch shows, maximizes, and focuses the main window; exact `--autostart` launch remains hidden and does not take focus.
- Minimize and Close both hide to tray unless a real quit is already in progress.
- Tray Show restores when needed, then shows, maximizes, and focuses; Tray Quit requests the shared shutdown path.
- F5 reload exists only in development; existing renderer shortcuts are unchanged.
- Only `https:` is approved for system external links, and every `window.open` request is denied inside Electron.
- Preserve `contextIsolation: true`, `sandbox: true`, and `nodeIntegration: false`.
- Cleanup must attempt database close, alarm timer cancellation, tray destruction, and shortcut unregistration exactly once.

---

## Target File Map

- Create `src-electron/main/desktop-lifecycle-controller.ts`: lifecycle state, event policies, development F5, quit, and idempotent cleanup.
- Create `src-electron/main/electron-desktop-adapters.ts`: narrow wrappers around the real BrowserWindow and globalShortcut capabilities.
- Modify `src-electron/main/tray.ts`: construct the tray from injected Show and Quit actions instead of manipulating BrowserWindow directly.
- Modify `src-electron/main/window.ts`: hidden-by-default window options and the safe `window.open` bridge.
- Modify `src-electron/adapters/electron-external-link.ts`: keep the HTTPS-only system-browser boundary.
- Modify `src-electron/main/index.ts`: compose the existing database, timer, window, tray, shortcut, external-link, and controller resources; delete old direct lifecycle paths.
- Delete `src-electron/main/lifecycle.ts`: its app events move to the composition root and controller.
- Create `tests/integration/electron/desktop-lifecycle-controller.test.ts`: controller behavior and cleanup coverage.
- Create `tests/integration/electron/tray.test.ts`: tray menu and double-click action mapping.
- Create `tests/integration/electron/window.test.ts`: security options, window-open denial, protocol allow-list, and handled failures.
- Modify `tests/integration/ipc/schedule-ipc.test.ts`: remove the host-boundary tests moved to the focused Electron window test.
- Modify `tests/e2e/electron/startup.spec.ts`: normal/autostart presentation, isolation, and child-window denial.
- Modify `docs/development/v2-feature-gaps.md`: close GAP-02 only after fresh verification.

### Task 1: Build the narrow lifecycle controller

**Files:**
- Create: `tests/integration/electron/desktop-lifecycle-controller.test.ts`
- Create: `src-electron/main/desktop-lifecycle-controller.ts`

**Interfaces:**
- Produces: `LaunchMode`, `PreventableEvent`, `WindowPort`, `ShortcutPort`, `Disposable`, `DesktopLifecycleDependencies`, and `DesktopLifecycleController`.
- Produces: `resolveLaunchMode(argv: readonly string[]): LaunchMode`.

- [ ] **Step 1: Write the failing controller integration tests**

Create a harness that captures registered window handlers and records call order:

```ts
import { describe, expect, it, vi } from 'vitest'

import {
  DesktopLifecycleController,
  resolveLaunchMode,
  type PreventableEvent,
  type WindowPort
} from '../../../src-electron/main/desktop-lifecycle-controller'

function createHarness(options: { development?: boolean; minimized?: boolean } = {}) {
  const handlers: {
    ready?: () => void
    minimize?: (event: PreventableEvent) => void
    close?: (event: PreventableEvent) => void
  } = {}
  const calls: string[] = []
  const window: WindowPort = {
    onReadyToShow: (handler) => { handlers.ready = handler },
    onMinimize: (handler) => { handlers.minimize = handler },
    onClose: (handler) => { handlers.close = handler },
    isMinimized: () => options.minimized ?? false,
    restore: () => { calls.push('restore') },
    show: () => { calls.push('show') },
    hide: () => { calls.push('hide') },
    maximize: () => { calls.push('maximize') },
    focus: () => { calls.push('focus') },
    reload: () => { calls.push('reload') }
  }
  const shortcutHandler: { current?: () => void } = {}
  const shortcuts = {
    register: vi.fn((_accelerator: string, handler: () => void) => {
      shortcutHandler.current = handler
      return true
    }),
    unregisterAll: vi.fn(() => { calls.push('unregister-shortcuts') })
  }
  const requestAppQuit = vi.fn(() => { calls.push('request-quit') })
  const reportError = vi.fn()
  const controller = new DesktopLifecycleController({
    window,
    shortcuts,
    requestAppQuit,
    reportError,
    resources: [],
    development: options.development ?? false
  })
  return { calls, controller, handlers, reportError, requestAppQuit, shortcutHandler, shortcuts }
}

describe('DesktopLifecycleController', () => {
  it('resolves only the exact autostart argument as an autostart launch', () => {
    expect(resolveLaunchMode(['electron', '.', '--autostart'])).toBe('autostart')
    expect(resolveLaunchMode(['electron', '.', '--autostart=true'])).toBe('normal')
  })

  it('shows, maximizes, and focuses a normal launch when ready', () => {
    const harness = createHarness()
    harness.controller.start('normal')
    harness.handlers.ready?.()
    expect(harness.calls).toEqual(['show', 'maximize', 'focus'])
  })

  it('leaves an autostart launch hidden when ready', () => {
    const harness = createHarness()
    harness.controller.start('autostart')
    harness.handlers.ready?.()
    expect(harness.calls).toEqual([])
  })

  it.each(['minimize', 'close'] as const)('hides on %s while not quitting', (kind) => {
    const harness = createHarness()
    const event = { preventDefault: vi.fn() }
    harness.controller.start('normal')
    harness.handlers[kind]?.(event)
    expect(event.preventDefault).toHaveBeenCalledOnce()
    expect(harness.calls).toEqual(['hide'])
  })

  it('allows Close to continue after quit starts', () => {
    const harness = createHarness()
    const event = { preventDefault: vi.fn() }
    harness.controller.start('normal')
    harness.controller.quit()
    harness.handlers.close?.(event)
    expect(event.preventDefault).not.toHaveBeenCalled()
    expect(harness.requestAppQuit).toHaveBeenCalledOnce()
  })

  it('restores when needed, then shows, maximizes, and focuses from tray', () => {
    const harness = createHarness({ minimized: true })
    harness.controller.showMainWindow()
    expect(harness.calls).toEqual(['restore', 'show', 'maximize', 'focus'])
  })

  it('registers F5 only in development and reloads through the window port', () => {
    const development = createHarness({ development: true })
    development.controller.start('normal')
    expect(development.shortcuts.register).toHaveBeenCalledWith('F5', expect.any(Function))
    development.shortcutHandler.current?.()
    expect(development.calls).toEqual(['reload'])

    const production = createHarness()
    production.controller.start('normal')
    expect(production.shortcuts.register).not.toHaveBeenCalled()
  })
})
```

Add cleanup tests using three `dispose` spies. Assert that `dispose()` sets quitting, calls `unregisterAll()`, attempts every disposable once, remains idempotent on a second call, and reports an error while continuing when the middle disposable throws. Add a registration-failure test for both `register()` returning false and throwing.

- [ ] **Step 2: Run the controller test and verify RED**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/integration/electron/desktop-lifecycle-controller.test.ts
```

Expected: FAIL because `desktop-lifecycle-controller.ts` does not exist.

- [ ] **Step 3: Implement the minimal controller**

Implement the declared interfaces and this behavior:

```ts
export type LaunchMode = 'normal' | 'autostart'

export interface PreventableEvent {
  preventDefault(): void
}

export interface WindowPort {
  onReadyToShow(handler: () => void): void
  onMinimize(handler: (event: PreventableEvent) => void): void
  onClose(handler: (event: PreventableEvent) => void): void
  isMinimized(): boolean
  restore(): void
  show(): void
  hide(): void
  maximize(): void
  focus(): void
  reload(): void
}

export interface ShortcutPort {
  register(accelerator: string, handler: () => void): boolean
  unregisterAll(): void
}

export interface Disposable {
  dispose(): void
}

export interface DesktopLifecycleDependencies {
  window: WindowPort
  shortcuts: ShortcutPort
  requestAppQuit(): void
  reportError(error: unknown): void
  resources: readonly Disposable[]
  development: boolean
}

export function resolveLaunchMode(argv: readonly string[]): LaunchMode {
  return argv.includes('--autostart') ? 'autostart' : 'normal'
}

export class DesktopLifecycleController {
  private quitting = false
  private disposed = false

  constructor(private readonly dependencies: DesktopLifecycleDependencies) {}

  start(mode: LaunchMode): void {
    const window = this.dependencies.window
    window.onReadyToShow(() => {
      if (mode === 'normal') this.showMainWindow()
    })
    window.onMinimize((event) => { this.hideMainWindow(event) })
    window.onClose((event) => { this.hideMainWindow(event) })
    if (!this.dependencies.development) return
    try {
      const registered = this.dependencies.shortcuts.register('F5', () => { window.reload() })
      if (!registered) this.dependencies.reportError(new Error('无法注册 F5 刷新快捷键'))
    } catch (error) {
      this.dependencies.reportError(error)
    }
  }

  showMainWindow(): void {
    const window = this.dependencies.window
    if (window.isMinimized()) window.restore()
    window.show()
    window.maximize()
    window.focus()
  }

  hideMainWindow(event: PreventableEvent): void {
    if (this.quitting) return
    event.preventDefault()
    this.dependencies.window.hide()
  }

  quit(): void {
    if (this.quitting) return
    this.quitting = true
    this.dependencies.requestAppQuit()
  }

  dispose(): void {
    this.quitting = true
    if (this.disposed) return
    this.disposed = true
    this.tryDispose(() => { this.dependencies.shortcuts.unregisterAll() })
    for (const resource of this.dependencies.resources) {
      this.tryDispose(() => { resource.dispose() })
    }
  }

  private tryDispose(dispose: () => void): void {
    try {
      dispose()
    } catch (error) {
      this.dependencies.reportError(error)
    }
  }
}
```

- [ ] **Step 4: Run the controller tests and Electron typecheck**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/integration/electron/desktop-lifecycle-controller.test.ts
.\node_modules\.bin\tsc.cmd --noEmit -p tsconfig.electron.json
```

Expected: both commands PASS.

- [ ] **Step 5: Commit the controller**

```powershell
git add src-electron/main/desktop-lifecycle-controller.ts tests/integration/electron/desktop-lifecycle-controller.test.ts
git commit -m "feat(electron): 增加桌面生命周期控制器"
```

### Task 2: Adapt BrowserWindow, shortcuts, and tray to the controller

**Files:**
- Create: `src-electron/main/electron-desktop-adapters.ts`
- Modify: `src-electron/main/tray.ts`
- Create: `tests/integration/electron/tray.test.ts`

**Interfaces:**
- Consumes: `WindowPort`, `ShortcutPort`, and controller Show/Quit methods from Task 1.
- Produces: `createElectronWindowPort(window): WindowPort`, `createElectronShortcutPort(shortcuts): ShortcutPort`, `TrayActions`, `TrayLike`, and `createApplicationTray(iconPath, actions, factory?)`.

- [ ] **Step 1: Write failing tray action-mapping tests**

Use an injected tray factory so no operating-system tray is created:

```ts
import { describe, expect, it, vi } from 'vitest'

import { createApplicationTray, type TrayFactory } from '../../../src-electron/main/tray'

it('maps menu Show/Quit and double-click to the injected controller actions', () => {
  const listeners = new Map<string, () => void>()
  const tray = {
    setToolTip: vi.fn(),
    setContextMenu: vi.fn(),
    on: vi.fn((event: string, handler: () => void) => { listeners.set(event, handler) }),
    destroy: vi.fn()
  }
  let template: readonly { label?: string; click?: () => void }[] = []
  const factory: TrayFactory = {
    create: vi.fn(() => tray),
    buildMenu: vi.fn((value) => {
      template = value
      return { menu: true }
    })
  }
  const show = vi.fn()
  const quit = vi.fn()

  expect(createApplicationTray('icon.ico', { show, quit }, factory)).toBe(tray)
  template.find((item) => item.label === 'Show Schedule')?.click?.()
  template.find((item) => item.label === 'Quit')?.click?.()
  listeners.get('double-click')?.()

  expect(show).toHaveBeenCalledTimes(2)
  expect(quit).toHaveBeenCalledOnce()
  expect(tray.setToolTip).toHaveBeenCalledWith('Schedule')
})
```

- [ ] **Step 2: Run the tray test and verify RED**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/integration/electron/tray.test.ts
```

Expected: FAIL because the existing tray signature requires BrowserWindow callbacks and has no injectable factory.

- [ ] **Step 3: Implement only the Electron adapters used by the controller**

In `electron-desktop-adapters.ts`, structurally wrap the supplied objects:

```ts
import type { BrowserWindow } from 'electron'

import type { ShortcutPort, WindowPort } from './desktop-lifecycle-controller'

export interface ElectronShortcutRegistry {
  register(accelerator: string, callback: () => void): boolean
  unregisterAll(): void
}

export function createElectronWindowPort(window: BrowserWindow): WindowPort {
  return {
    onReadyToShow: (handler) => { window.on('ready-to-show', handler) },
    onMinimize: (handler) => { window.on('minimize', handler) },
    onClose: (handler) => { window.on('close', handler) },
    isMinimized: () => window.isMinimized(),
    restore: () => { window.restore() },
    show: () => { window.show() },
    hide: () => { window.hide() },
    maximize: () => { window.maximize() },
    focus: () => { window.focus() },
    reload: () => { window.reload() }
  }
}

export function createElectronShortcutPort(shortcuts: ElectronShortcutRegistry): ShortcutPort {
  return {
    register: (accelerator, handler) => shortcuts.register(accelerator, handler),
    unregisterAll: () => { shortcuts.unregisterAll() }
  }
}
```

Rewrite `tray.ts` so it creates only the used tray capabilities and maps callbacks directly:

```ts
import { Menu, Tray, type MenuItemConstructorOptions } from 'electron'

export interface TrayActions {
  show(): void
  quit(): void
}

export interface TrayLike {
  setToolTip(value: string): void
  setContextMenu(menu: unknown): void
  on(event: 'double-click', handler: () => void): void
  destroy(): void
}

export interface TrayFactory {
  create(iconPath: string): TrayLike
  buildMenu(template: readonly MenuItemConstructorOptions[]): unknown
}

const electronTrayFactory: TrayFactory = {
  create: (iconPath) => new Tray(iconPath),
  buildMenu: (template) => Menu.buildFromTemplate([...template])
}

export function createApplicationTray(
  iconPath: string,
  actions: TrayActions,
  factory: TrayFactory = electronTrayFactory
): TrayLike {
  const tray = factory.create(iconPath)
  tray.setToolTip('Schedule')
  tray.setContextMenu(factory.buildMenu([
    { label: 'Show Schedule', click: actions.show },
    { type: 'separator' },
    { label: 'Quit', click: actions.quit }
  ]))
  tray.on('double-click', actions.show)
  return tray
}
```

- [ ] **Step 4: Verify tray behavior and adapter types**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/integration/electron/tray.test.ts tests/integration/electron/desktop-lifecycle-controller.test.ts
.\node_modules\.bin\tsc.cmd --noEmit -p tsconfig.electron.json
```

Expected: all tests PASS and TypeScript reports no errors.

- [ ] **Step 5: Commit the adapters and tray migration**

```powershell
git add src-electron/main/electron-desktop-adapters.ts src-electron/main/tray.ts tests/integration/electron/tray.test.ts
git commit -m "refactor(electron): 将托盘操作接入生命周期控制器"
```

### Task 3: Route all child-window and external-link requests through the safe adapter

**Files:**
- Modify: `src-electron/main/window.ts`
- Modify: `src-electron/adapters/electron-external-link.ts`
- Create: `tests/integration/electron/window.test.ts`
- Modify: `tests/integration/ipc/schedule-ipc.test.ts`

**Interfaces:**
- Produces: `ExternalLinkOpener`, `WindowOpenTarget`, and `installWindowOpenHandler(target, links, reportError): void`.
- Preserves: `ElectronExternalLink.open(value: string): Promise<void>` with exact HTTPS-only validation.

- [ ] **Step 1: Move and expand the failing secure-window tests**

Remove the `secure Electron host boundary` block and its two imports from `schedule-ipc.test.ts`. Create `window.test.ts` with these assertions:

```ts
import { describe, expect, it, vi } from 'vitest'

import { ElectronExternalLink } from '../../../src-electron/adapters/electron-external-link'
import {
  createMainWindowOptions,
  installWindowOpenHandler,
  type WindowOpenHandler
} from '../../../src-electron/main/window'

it('creates the main window hidden with strict renderer isolation', () => {
  expect(createMainWindowOptions('D:/app/preload.js')).toMatchObject({
    show: false,
    webPreferences: {
      preload: 'D:/app/preload.js',
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  })
})

it.each([
  'http://example.com',
  'file:///C:/secret.txt',
  'javascript:alert(1)',
  'data:text/plain,secret',
  'mailto:owner@example.com',
  'not a url'
])('rejects an unapproved external link: %s', async (value) => {
  const openExternal = vi.fn(async () => undefined)
  const links = new ElectronExternalLink({ openExternal })
  await expect(links.open(value)).rejects.toThrow()
  expect(openExternal).not.toHaveBeenCalled()
})

it('opens an approved HTTPS link through the system shell', async () => {
  const openExternal = vi.fn(async () => undefined)
  const links = new ElectronExternalLink({ openExternal })
  await links.open('https://example.com/help')
  expect(openExternal).toHaveBeenCalledWith('https://example.com/help')
})

it('always denies Electron child windows and reports rejected links', async () => {
  let handler: WindowOpenHandler | undefined
  const open = vi.fn(async () => { throw new Error('blocked') })
  const reportError = vi.fn()
  installWindowOpenHandler({ setWindowOpenHandler: (value) => { handler = value } }, { open }, reportError)

  expect(handler?.({ url: 'file:///C:/secret.txt' })).toEqual({ action: 'deny' })
  await vi.waitFor(() => { expect(reportError).toHaveBeenCalledWith(expect.any(Error)) })
})
```

Add a successful handler case proving an HTTPS request still returns `deny`, calls the injected opener once, and does not report an error.

- [ ] **Step 2: Run the secure-window test and verify RED**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/integration/electron/window.test.ts
```

Expected: FAIL because `show: false` and `installWindowOpenHandler` do not exist.

- [ ] **Step 3: Implement the safe window-open bridge**

Keep the existing security flags, add `show: false`, and add these narrow interfaces and installer to `window.ts`:

```ts
export interface ExternalLinkOpener {
  open(url: string): Promise<void>
}

export interface WindowOpenDetails {
  readonly url: string
}

export type WindowOpenHandler = (details: WindowOpenDetails) => { action: 'deny' }

export interface WindowOpenTarget {
  setWindowOpenHandler(handler: WindowOpenHandler): void
}

export function installWindowOpenHandler(
  target: WindowOpenTarget,
  links: ExternalLinkOpener,
  reportError: (error: unknown) => void
): void {
  target.setWindowOpenHandler(({ url }) => {
    void links.open(url).catch(reportError)
    return { action: 'deny' }
  })
}
```

Keep `ElectronExternalLink` minimal and HTTPS-only:

```ts
async open(value: string): Promise<void> {
  const url = new URL(value)
  if (url.protocol !== 'https:') throw new Error('不允许的外部链接协议')
  await this.shell.openExternal(url.toString())
}
```

- [ ] **Step 4: Verify focused security behavior**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/integration/electron/window.test.ts tests/integration/ipc/schedule-ipc.test.ts
.\node_modules\.bin\tsc.cmd --noEmit -p tsconfig.electron.json
```

Expected: all tests PASS and TypeScript reports no errors.

- [ ] **Step 5: Commit the secure external-link boundary**

```powershell
git add src-electron/main/window.ts src-electron/adapters/electron-external-link.ts tests/integration/electron/window.test.ts tests/integration/ipc/schedule-ipc.test.ts
git commit -m "fix(electron): 限制窗口外链协议与打开路径"
```

### Task 4: Replace the existing composition-root lifecycle with the controller

**Files:**
- Modify: `src-electron/main/index.ts`
- Delete: `src-electron/main/lifecycle.ts`
- Modify: `tests/e2e/electron/startup.spec.ts`

**Interfaces:**
- Consumes: all Task 1–3 controller and adapter interfaces.
- Produces: one authoritative application lifecycle with the current database, alarm timer, tray, window, and shortcut resources injected into the controller.

- [ ] **Step 1: Write failing normal/autostart and child-window Electron tests**

Refactor the existing startup launch into a helper that accepts additional arguments and always uses a temporary user-data directory and in-memory database. Extend the existing normal startup test with main-process state:

```ts
await expect.poll(() => application.evaluate(({ BrowserWindow }) => {
  const window = BrowserWindow.getAllWindows()[0]
  return window ? { visible: window.isVisible(), maximized: window.isMaximized() } : undefined
})).toEqual({ visible: true, maximized: true })
```

Add an autostart test:

```ts
test('keeps an autostart launch hidden and out of the foreground', async () => {
  const application = await launchSchedule(['--autostart'])
  try {
    await application.firstWindow()
    await expect.poll(() => application.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0]
      return window
        ? { visible: window.isVisible(), maximized: window.isMaximized(), focused: window.isFocused() }
        : undefined
    })).toEqual({ visible: false, maximized: false, focused: false })
  } finally {
    await application.close()
  }
})
```

Add a child-window test that executes `window.open('file:///C:/secret.txt')` in the renderer and asserts `application.windows()` remains length 1. Do not launch an approved HTTPS system browser from E2E; the focused integration test already verifies approved delegation.

- [ ] **Step 2: Build and run startup E2E to verify RED**

Run:

```powershell
.\node_modules\.bin\vite.cmd build
.\node_modules\.bin\vite.cmd build --config vite.electron-main.config.ts
.\node_modules\.bin\vite.cmd build --config vite.electron-preload.config.ts
.\node_modules\.bin\playwright.cmd test tests/e2e/electron/startup.spec.ts
```

Expected: at least the maximized normal-launch or hidden autostart assertion FAILS because the current window lacks the approved presentation policy.

- [ ] **Step 3: Return the current platform resources from registration**

Change `registerSchedulePlatform()` to return `readonly Disposable[]`. Remove its `app.on('before-quit')` callback and return the existing resources instead:

```ts
return [
  { dispose: () => { clearInterval(alarmTimer) } },
  { dispose: () => { connection.sqlite.close() } }
]
```

Do not change schedule services, repositories, IPC contracts, alarm calculation, settings updates, or notification behavior.

- [ ] **Step 4: Compose the controller and delete the old direct paths**

In the `app.whenReady()` composition:

1. Create the platform resources.
2. Create one hidden BrowserWindow with `createMainWindowOptions`.
3. Install the safe window-open handler using `new ElectronExternalLink(shell)`.
4. Create `WindowPort` and `ShortcutPort` adapters.
5. Create the controller with database and alarm resources plus a lazy tray disposable.
6. Call `controller.start(resolveLaunchMode(process.argv))` before loading the Web page.
7. Create the tray, when enabled, with `{ show: () => controller.showMainWindow(), quit: () => controller.quit() }`.
8. Map `app.activate` to `controller.showMainWindow()`.
9. Map `app.before-quit` to `controller.dispose()`.
10. Keep `window-all-closed` alive when the tray is enabled; when `SCHEDULE_DISABLE_TRAY === '1'`, call `app.quit()`.

The core composition should have this shape:

```ts
void app.whenReady().then(() => {
  const resources = registerSchedulePlatform()
  const backgroundEnabled = process.env.SCHEDULE_DISABLE_TRAY !== '1'
  const mainWindow = new BrowserWindow(createMainWindowOptions(preloadPath))
  installWindowOpenHandler(
    mainWindow.webContents,
    new ElectronExternalLink(shell),
    (error) => { console.error('Electron external link failed', error) }
  )

  let tray: TrayLike | undefined
  const controller = new DesktopLifecycleController({
    window: createElectronWindowPort(mainWindow),
    shortcuts: createElectronShortcutPort(globalShortcut),
    requestAppQuit: () => { app.quit() },
    reportError: (error) => { console.error('Electron lifecycle failed', error) },
    resources: [...resources, { dispose: () => { tray?.destroy() } }],
    development: Boolean(process.env.VITE_DEV_SERVER_URL)
  })

  controller.start(resolveLaunchMode(process.argv))
  if (backgroundEnabled) {
    tray = createApplicationTray(resolve(mainDirectory, '../../resources/icon256.ico'), {
      show: () => { controller.showMainWindow() },
      quit: () => { controller.quit() }
    })
  }

  app.on('activate', () => { controller.showMainWindow() })
  app.on('before-quit', () => { controller.dispose() })
  app.on('window-all-closed', () => {
    if (!backgroundEnabled) app.quit()
  })
  void loadMainWindow(mainWindow, process.env.VITE_DEV_SERVER_URL, webEntryPath)
})
```

Delete the module-level `quitting`, the old `createWindow()` close handler, every old `before-quit` registration, direct tray callbacks, and `registerApplicationLifecycle`. Delete `src-electron/main/lifecycle.ts` after its `activate` and `window-all-closed` responsibilities are represented above.

- [ ] **Step 5: Run focused integration, type, build, and Electron startup verification**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/integration/electron tests/integration/ipc
.\node_modules\.bin\tsc.cmd --noEmit -p tsconfig.electron.json
.\node_modules\.bin\vite.cmd build
.\node_modules\.bin\vite.cmd build --config vite.electron-main.config.ts
.\node_modules\.bin\vite.cmd build --config vite.electron-preload.config.ts
.\node_modules\.bin\playwright.cmd test tests/e2e/electron/startup.spec.ts
```

Expected: all commands PASS. The Electron test reports a visible maximized normal window, a hidden autostart window, one isolated renderer window, and no child window for a rejected URL.

- [ ] **Step 6: Commit the composition-root migration**

```powershell
git add src-electron/main/index.ts src-electron/main/lifecycle.ts tests/e2e/electron/startup.spec.ts
git commit -m "refactor(electron): 统一窗口托盘与退出生命周期"
```

### Task 5: Close GAP-02 with full fresh verification

**Files:**
- Modify: `docs/development/v2-feature-gaps.md`

**Interfaces:**
- Produces: an auditable GAP-02 completion record tied to exact commands.

- [ ] **Step 1: Run the complete relevant verification before editing status**

Run each command separately and require exit code 0:

```powershell
.\node_modules\.bin\eslint.cmd .
.\node_modules\.bin\vue-tsc.cmd --noEmit -p tsconfig.app.json
.\node_modules\.bin\tsc.cmd --noEmit -p tsconfig.electron.json
.\node_modules\.bin\vitest.cmd run tests/unit tests/contracts tests/parser
.\node_modules\.bin\vitest.cmd run tests/integration/electron tests/integration/ipc
.\node_modules\.bin\vite.cmd build
.\node_modules\.bin\vite.cmd build --config vite.electron-main.config.ts
.\node_modules\.bin\vite.cmd build --config vite.electron-preload.config.ts
.\node_modules\.bin\playwright.cmd test tests/e2e/electron/startup.spec.ts
```

Expected: every command exits 0 with no failed tests. If any command fails, leave GAP-02 as `待实施`, diagnose the failure with `superpowers:systematic-debugging`, add a reproducing test where applicable, and repeat verification after the fix.

- [ ] **Step 2: Record the approved decisions and mark GAP-02 complete**

Change only GAP-02's status and append this completion evidence below its acceptance criteria:

```markdown
状态：`已完成`

实施决定：

- 最小化和关闭均隐藏到托盘；只有真实应用退出允许窗口关闭。
- F5 仅在开发环境注册，生产环境禁用；renderer 业务快捷键保持不变。
- 外链仅允许 `https:`，且 `window.open` 始终拒绝创建 Electron 子窗口。
- 窗口、托盘、开机启动、快捷键和资源释放统一由窄接口生命周期控制器协调。

验证：

- `eslint .`
- `vue-tsc --noEmit -p tsconfig.app.json`
- `tsc --noEmit -p tsconfig.electron.json`
- `vitest run tests/unit tests/contracts tests/parser`
- `vitest run tests/integration/electron tests/integration/ipc`
- `vite build`
- `vite build --config vite.electron-main.config.ts`
- `vite build --config vite.electron-preload.config.ts`
- `playwright test tests/e2e/electron/startup.spec.ts`
```

- [ ] **Step 3: Verify the final diff and documentation claim**

Run:

```powershell
git diff --check
git diff --stat HEAD~4
git status --short
```

Expected: no whitespace errors; only the GAP-02 files listed by this plan are changed; no unrelated user files are staged or modified.

- [ ] **Step 4: Commit the GAP closure**

```powershell
git add docs/development/v2-feature-gaps.md docs/superpowers/specs/2026-07-16-electron-desktop-lifecycle-design.md
git commit -m "docs(electron): 记录桌面生命周期验收结果"
```

## Plan Self-Review

- Spec coverage: startup presentation, matching Minimize/Close behavior, tray Show/Quit, database/timer/tray/shortcut cleanup, development-only F5, HTTPS-only external links, unconditional child-window denial, and all three BrowserWindow security flags each have a named test and implementation task.
- Existing-code migration: Task 4 explicitly removes the module `quitting` flag, old Close handler, direct tray callbacks, duplicate cleanup callbacks, and `lifecycle.ts`; no parallel legacy lifecycle remains.
- Type consistency: Task 1 produces the exact ports consumed by Task 2 and Task 4; tray cleanup conforms structurally to `Disposable`; window-open handling consumes `ElectronExternalLink.open` without exposing Electron to `src`.
- Scope control: login, additional protocols, second-window support, Tauri, alarm semantics, and general-purpose DI remain outside GAP-02.
- F5 decision: development-only registration is explicit in constraints, controller tests, implementation, and the completion record.
