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
