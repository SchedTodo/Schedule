import type { BrowserWindow } from 'electron'

import {
  widgetIpcChannels,
  widgetIpcContracts
} from '../../ipc-contracts/widget-ipc'
import { resizeWidgetBounds } from '../widget-window'

export interface WidgetIpcRegistrar {
  handle(
    channel: string,
    handler: (event: { sender: unknown }, input: unknown) => unknown
  ): void
}

export interface WidgetHandlerWindows {
  readonly widget: BrowserWindow
  readonly main: BrowserWindow
  showMain(): void
  setEnabled(value: boolean): void
  isEnabled(): boolean
  saveState(): void
}

export function registerWidgetIpcHandlers(
  ipcMain: WidgetIpcRegistrar,
  windows: WidgetHandlerWindows
): void {
  let resizeSession: {
    edge: 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw'
    screenX: number
    screenY: number
    bounds: ReturnType<BrowserWindow['getBounds']>
  } | undefined
  function fromWidget(event: { sender: unknown }): void {
    if (event.sender !== windows.widget.webContents) {
      throw new Error('Widget window control is only available to the widget renderer')
    }
  }
  function fromApplication(event: { sender: unknown }): void {
    if (event.sender !== windows.widget.webContents && event.sender !== windows.main.webContents) {
      throw new Error('Widget settings are only available to application renderers')
    }
  }

  ipcMain.handle(widgetIpcChannels.getState, (event, input) => {
    fromApplication(event)
    widgetIpcContracts[widgetIpcChannels.getState].input.parse(input)
    return { enabled: windows.isEnabled(), alwaysOnTop: windows.widget.isAlwaysOnTop() }
  })
  ipcMain.handle(widgetIpcChannels.setEnabled, (event, input) => {
    fromApplication(event)
    const parsed = widgetIpcContracts[widgetIpcChannels.setEnabled].input.parse(input)
    windows.setEnabled(parsed.value)
    windows.saveState()
    return { enabled: windows.isEnabled(), alwaysOnTop: windows.widget.isAlwaysOnTop() }
  })
  ipcMain.handle(widgetIpcChannels.setAlwaysOnTop, (event, input) => {
    fromWidget(event)
    const parsed = widgetIpcContracts[widgetIpcChannels.setAlwaysOnTop].input.parse(input)
    windows.widget.setAlwaysOnTop(parsed.value)
    windows.saveState()
    return { enabled: windows.isEnabled(), alwaysOnTop: windows.widget.isAlwaysOnTop() }
  })
  ipcMain.handle(widgetIpcChannels.setIgnoreMouseEvents, (event, input) => {
    fromWidget(event)
    const parsed = widgetIpcContracts[widgetIpcChannels.setIgnoreMouseEvents].input.parse(input)
    windows.widget.setIgnoreMouseEvents(parsed.value, { forward: true })
  })
  ipcMain.handle(widgetIpcChannels.resize, (event, input) => {
    fromWidget(event)
    const parsed = widgetIpcContracts[widgetIpcChannels.resize].input.parse(input)
    if (parsed.phase === 'start') {
      resizeSession = {
        edge: parsed.edge,
        screenX: parsed.screenX,
        screenY: parsed.screenY,
        bounds: windows.widget.getBounds()
      }
    } else if (parsed.phase === 'move' && resizeSession !== undefined) {
      windows.widget.setBounds(resizeWidgetBounds(
        resizeSession.bounds,
        resizeSession.edge,
        parsed.screenX - resizeSession.screenX,
        parsed.screenY - resizeSession.screenY
      ))
    } else if (parsed.phase === 'end') {
      resizeSession = undefined
      windows.saveState()
    }
  })
  ipcMain.handle(widgetIpcChannels.hide, (event, input) => {
    fromWidget(event)
    widgetIpcContracts[widgetIpcChannels.hide].input.parse(input)
    windows.widget.hide()
    windows.saveState()
  })
  ipcMain.handle(widgetIpcChannels.openSchedule, (event, input) => {
    fromWidget(event)
    const parsed = widgetIpcContracts[widgetIpcChannels.openSchedule].input.parse(input)
    windows.showMain()
    windows.main.webContents.send(widgetIpcChannels.navigateSchedule, parsed)
  })
}
