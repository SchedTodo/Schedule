import { Menu, Tray, type BrowserWindow } from 'electron'

export function createApplicationTray(
  iconPath: string,
  getWindow: () => BrowserWindow | undefined,
  createWindow: () => BrowserWindow,
  quit: () => void
): Tray {
  const tray = new Tray(iconPath)
  const show = () => {
    const window = getWindow() ?? createWindow()
    if (window.isMinimized()) window.restore()
    window.show()
    window.focus()
  }
  tray.setToolTip('Schedule')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show Schedule', click: show },
    { type: 'separator' },
    { label: 'Quit', click: quit }
  ]))
  tray.on('double-click', show)
  return tray
}
