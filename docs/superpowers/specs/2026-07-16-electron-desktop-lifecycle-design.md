# Electron Desktop Lifecycle Design

## Scope

GAP-02 replaces the existing Electron window, tray, startup, shortcut, external-link, and shutdown event handling with one injected lifecycle controller. This is a migration of all current behavior, not a second implementation beside `src-electron/main/index.ts`, `tray.ts`, or `window.ts`. Obsolete event handlers and duplicate `before-quit` cleanup registrations are removed when their responsibilities move into the controller.

The change does not restore login, add new protocols, add a second window, or expose new renderer APIs.

## Approved Behavior

- A normal launch creates the main window hidden and, on `ready-to-show`, shows, maximizes, and focuses it.
- A launch containing the exact `--autostart` argument creates the main window but leaves it hidden. It does not show, maximize, or focus the window and therefore does not take the foreground.
- Clicking Minimize lets Electron enter its native minimized state and then hides the main window to the tray. Clicking Close while the application is not quitting prevents the default close and hides the window. Both controls therefore have the same user-visible tray result.
- During a real application quit, the window Close event is not prevented.
- Tray “Show Schedule” and tray double-click use the same action: restore the window when minimized, then show, maximize, and focus it.
- Tray “Quit” marks the application as quitting before requesting `app.quit()`.
- F5 reload is registered only in development. Production does not register F5. Existing renderer business shortcuts such as Ctrl+Arrow and Ctrl+Enter are unchanged.
- Only `https:` external links are approved. `http:`, `file:`, `javascript:`, `data:`, `mailto:`, malformed URLs, and every other protocol are rejected.
- Every `window.open` request is denied inside Electron. Approved HTTPS URLs are opened through the safe Electron external-link adapter and the system browser.
- The main window retains `contextIsolation: true`, `sandbox: true`, and `nodeIntegration: false`.

## Architecture

`DesktopLifecycleController` centralizes desktop lifecycle state and behavior while depending only on narrow interfaces for capabilities used by GAP-02. The interfaces do not reproduce the complete Electron API.

The controller owns `quitting` and `disposed` state and exposes these operations:

```ts
interface DesktopLifecycleController {
  start(mode: 'normal' | 'autostart'): void
  showMainWindow(): void
  hideMainWindow(event: PreventableEvent): void
  quit(): void
  dispose(): void
}
```

Its injected capabilities are limited to:

```ts
interface WindowPort {
  onReadyToShow(handler: () => void): void
  onMinimize(handler: () => void): void
  onClose(handler: (event: PreventableEvent) => void): void
  isMinimized(): boolean
  restore(): void
  show(): void
  hide(): void
  maximize(): void
  focus(): void
  reload(): void
}

interface TrayPort {
  destroy(): void
}

interface ShortcutPort {
  register(accelerator: string, handler: () => void): boolean
  unregisterAll(): void
}

interface Disposable {
  dispose(): void
}
```

The dependency object also supplies `requestAppQuit()`, `reportError(error)`, the development flag, and the resources that must be disposed. Real Electron adapters remain in `src-electron`; no Electron or host-specific type crosses into `src` or Vue components.

## Components and Ownership

### Desktop lifecycle controller

`src-electron/main/desktop-lifecycle-controller.ts` binds window events, applies the launch presentation policy, registers development F5, coordinates tray actions, and disposes resources exactly once. It imports no database implementation and no Vue code.

### Electron desktop adapters

`src-electron/main/electron-desktop-adapters.ts` maps the real `BrowserWindow`, `globalShortcut`, and application quit callback to the narrow controller interfaces. It is the Electron-specific edge around the controller.

### Tray

`src-electron/main/tray.ts` creates the Electron tray and maps both the Show menu item and double-click to `controller.showMainWindow()`. Its Quit item calls `controller.quit()`. Existing direct window manipulation in tray callbacks is removed.

### Window and external links

`src-electron/main/window.ts` continues to define BrowserWindow security options and page loading. It also installs a window-open handler that always returns `deny` and asynchronously delegates the URL to `ElectronExternalLink`.

`src-electron/adapters/electron-external-link.ts` remains the only system-browser exit. It parses the URL, requires the exact `https:` protocol, and only then calls `shell.openExternal()`.

### Composition root

`src-electron/main/index.ts` creates the database, alarm timer, main window, tray, external-link adapter, and controller. It wraps the existing database close, timer cancellation, tray destruction, and shortcut unregistration as disposables. It selects `normal` or `autostart` from `process.argv.includes('--autostart')` and delegates behavior to the controller.

Existing close interception, tray callbacks, and the multiple cleanup registrations in `index.ts` are removed after they are connected through the controller. There is one authoritative lifecycle path.

## Event Flow

On `ready-to-show`, a normal launch calls `show()`, `maximize()`, then `focus()`. An autostart launch performs none of these foreground operations and leaves the initially hidden window unchanged.

Minimize and Close share `hideMainWindow()`. Electron 43's typed Minimize event is not cancellable, so the controller hides immediately after native minimization. For Close, when `quitting` is false, the controller calls `preventDefault()` and `hide()`; when `quitting` is true, it allows Close to continue.

Tray Show checks `isMinimized()`, calls `restore()` only when required, then calls `show()`, `maximize()`, and `focus()`. Tray Quit sets `quitting` before calling the injected application quit request. The application's `before-quit` event invokes `dispose()`.

`dispose()` first sets `quitting` so system-initiated and programmatic quit paths cannot be blocked by the window Close handler. It is idempotent, attempts every registered cleanup even if an earlier cleanup throws, and reports each error through `reportError`. This ensures database close, alarm timer cancellation, tray destruction, and shortcut unregistration are all attempted for tray quit and any other application quit path.

## Error Handling and Security

Malformed and unapproved external URLs never reach the Electron shell. The window-open handler denies the Electron child window synchronously. Rejected URL validation and failures from `shell.openExternal()` are reported without producing an unhandled promise rejection.

Failure to register F5 does not prevent startup and is reported. No shortcut registration is attempted in production.

The controller's cleanup path continues after individual disposal errors. Repeated `before-quit` or disposal calls do not close the database or destroy the tray twice.

## Testing

Controller integration tests use narrow fakes and cover:

- normal startup presentation;
- autostart remaining hidden without foreground calls;
- matching Minimize and Close hide-to-tray behavior;
- Close proceeding while quitting;
- tray Show ordering, including conditional restore;
- tray Quit setting quitting state before requesting application quit;
- complete, idempotent cleanup of the database, alarm timer, tray, and shortcuts;
- continued cleanup after one disposable throws;
- development-only F5 registration and reload.

Window and external-link integration tests cover the exact BrowserWindow security options, HTTPS acceptance, rejection of every explicitly disallowed protocol and malformed input, unconditional denial of Electron child windows, and handled shell failures.

Real Electron end-to-end tests cover a visible maximized normal launch, a hidden `--autostart` launch, renderer isolation, and the absence of a second Electron window after `window.open`. Platform-dependent automation does not click the operating system tray; tray action mapping and complete shutdown are covered through the controller integration tests.

## Completion Criteria

GAP-02 is complete only when the old direct lifecycle paths have been removed, all new focused tests pass, the required Web foundation verification passes, the Electron build passes, the relevant Electron end-to-end tests pass, and `docs/development/v2-feature-gaps.md` marks GAP-02 as completed with the verification commands recorded.
