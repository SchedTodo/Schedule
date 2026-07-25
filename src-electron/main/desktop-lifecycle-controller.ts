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

/** 根据 Electron 启动参数区分正常启动和后台自启动。 */
export function resolveLaunchMode(argv: readonly string[]): LaunchMode {
  return argv.includes('--autostart') ? 'autostart' : 'normal'
}

export class DesktopLifecycleController {
  private quitting = false
  private disposed = false

  constructor(private readonly dependencies: DesktopLifecycleDependencies) {}

  /** 安装窗口生命周期处理，并仅在开发环境注册 F5 刷新快捷键。 */
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

  /** 恢复、显示、最大化并聚焦主窗口。 */
  showMainWindow(): void {
    const window = this.dependencies.window
    if (window.isMinimized()) window.restore()
    window.show()
    window.maximize()
    window.focus()
  }

  /** 后台模式下阻止窗口关闭并将其隐藏；退出流程中不再拦截。 */
  hideMainWindow(event?: PreventableEvent): void {
    if (this.quitting) return
    event?.preventDefault()
    this.dependencies.window.hide()
  }

  /** 标记退出状态并请求 Electron 应用退出。 */
  quit(): void {
    if (this.quitting) return
    this.quitting = true
    this.dependencies.requestAppQuit()
  }

  /** 幂等释放快捷键和全部已注册资源，单个资源失败不阻断其余清理。 */
  dispose(): void {
    this.quitting = true
    if (this.disposed) return
    this.disposed = true

    this.tryDispose(() => { this.dependencies.shortcuts.unregisterAll() })
    for (const resource of this.dependencies.resources) {
      this.tryDispose(() => { resource.dispose() })
    }
  }

  /** 执行单项清理并把异常交给统一错误报告器。 */
  private tryDispose(dispose: () => void): void {
    try {
      dispose()
    } catch (error) {
      this.dependencies.reportError(error)
    }
  }
}
