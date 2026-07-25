import type { BrowserWindowConstructorOptions } from 'electron'
import { pathToFileURL } from 'node:url'

export interface WindowLoader {
  loadURL(url: string): Promise<unknown>
  loadFile(path: string): Promise<unknown>
}

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

/** 创建默认隐藏且启用上下文隔离、沙箱的主窗口配置。 */
export function createMainWindowOptions(preloadPath: string): BrowserWindowConstructorOptions {
  return {
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  }
}

/** 拦截渲染器新窗口请求，交给系统外部链接处理器并始终拒绝内嵌打开。 */
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

/** 开发时加载 Vite 地址，生产时以 file URL 加载构建后的 Web 入口。 */
export async function loadMainWindow(
  window: WindowLoader,
  developmentUrl: string | undefined,
  webEntryPath: string
): Promise<void> {
  if (developmentUrl) {
    await window.loadURL(developmentUrl)
    return
  }
  await window.loadURL(pathToFileURL(webEntryPath).href)
}
