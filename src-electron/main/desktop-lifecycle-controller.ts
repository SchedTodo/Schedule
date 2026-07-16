export type LaunchMode = 'normal' | 'autostart'

export interface PreventableEvent {
  preventDefault(): void
}

export interface WindowPort {
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
  backgroundEnabled: boolean
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
    if (this.dependencies.backgroundEnabled) {
      window.onMinimize(() => { this.hideMainWindow() })
      window.onClose((event) => { this.hideMainWindow(event) })
    }
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

  hideMainWindow(event?: PreventableEvent): void {
    if (this.quitting) return
    event?.preventDefault()
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
