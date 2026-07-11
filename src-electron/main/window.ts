import type { BrowserWindowConstructorOptions } from 'electron'

export interface WindowLoader {
  loadURL(url: string): Promise<unknown>
  loadFile(path: string): Promise<unknown>
}

export function createMainWindowOptions(preloadPath: string): BrowserWindowConstructorOptions {
  return {
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  }
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
  await window.loadFile(webEntryPath)
}
