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
    // Keep the background process alive; the tray menu owns explicit quitting.
    if (process.env.SCHEDULE_DISABLE_TRAY === '1') app.quit()
  })
}
