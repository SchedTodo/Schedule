import { Menu, Tray } from 'electron'

export interface TrayActions {
  show(): void
  quit(): void
}

export interface TrayLike {
  setToolTip(value: string): void
  setContextMenu(menu: object): void
  on(event: 'double-click', handler: () => void): void
  destroy(): void
}

export interface TrayMenuItem {
  label?: string
  type?: 'separator'
  click?: () => void
}

export interface TrayFactory {
  create(iconPath: string): TrayLike
  buildMenu(template: readonly TrayMenuItem[]): object
}

const electronTrayFactory: TrayFactory = {
  create(iconPath) {
    const tray = new Tray(iconPath)
    return {
      setToolTip: (value) => { tray.setToolTip(value) },
      setContextMenu: (menu) => {
        tray.setContextMenu(menu as ReturnType<typeof Menu.buildFromTemplate>)
      },
      on: (event, handler) => { tray.on(event, handler) },
      destroy: () => { tray.destroy() }
    }
  },
  buildMenu: (template) => Menu.buildFromTemplate([...template])
}

export function createApplicationTray(
  iconPath: string,
  actions: TrayActions,
  factory: TrayFactory = electronTrayFactory
): TrayLike {
  const tray = factory.create(iconPath)
  tray.setToolTip('Schedule')
  tray.setContextMenu(factory.buildMenu([
    { label: 'Show Schedule', click: actions.show },
    { type: 'separator' },
    { label: 'Quit', click: actions.quit }
  ]))
  tray.on('double-click', actions.show)
  return tray
}
