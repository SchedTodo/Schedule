import type { BrowserWindow } from 'electron'

import type { ShortcutPort, WindowPort } from './desktop-lifecycle-controller'

export interface ElectronShortcutRegistry {
  register(accelerator: string, callback: () => void): boolean
  unregisterAll(): void
}

/** 将 BrowserWindow 适配为不向应用层暴露 Electron 类型的窗口端口。 */
export function createElectronWindowPort(window: BrowserWindow): WindowPort {
  return {
    onReadyToShow: (handler) => { window.on('ready-to-show', handler) },
    onMinimize: (handler) => { window.on('minimize', handler) },
    onClose: (handler) => {
      window.on('close', (event) => { handler(event) })
    },
    isMinimized: () => window.isMinimized(),
    restore: () => { window.restore() },
    show: () => { window.show() },
    hide: () => { window.hide() },
    maximize: () => { window.maximize() },
    focus: () => { window.focus() },
    reload: () => { window.reload() }
  }
}

/** 将 Electron 全局快捷键注册器适配为生命周期控制器端口。 */
export function createElectronShortcutPort(shortcuts: ElectronShortcutRegistry): ShortcutPort {
  return {
    register: (accelerator, handler) => shortcuts.register(accelerator, handler),
    unregisterAll: () => { shortcuts.unregisterAll() }
  }
}
