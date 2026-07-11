import type { App, BrowserWindow } from 'electron'

export function registerApplicationLifecycle(
  app: App,
  createWindow: () => BrowserWindow,
  getWindowCount: () => number
): void {
  app.on('activate', () => {
    if (getWindowCount() === 0) createWindow()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
