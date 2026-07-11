import { app, BrowserWindow } from 'electron'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { registerApplicationLifecycle } from './lifecycle'
import { createMainWindowOptions, loadMainWindow } from './window'

const mainDirectory = dirname(fileURLToPath(import.meta.url))
const preloadPath = resolve(mainDirectory, '../preload/index.cjs')
const webEntryPath = resolve(mainDirectory, '../../dist-web/index.html')

function createWindow(): BrowserWindow {
  const window = new BrowserWindow(createMainWindowOptions(preloadPath))
  void loadMainWindow(window, process.env.VITE_DEV_SERVER_URL, webEntryPath)
  return window
}

registerApplicationLifecycle(app, createWindow, () => BrowserWindow.getAllWindows().length)
void app.whenReady().then(createWindow)
