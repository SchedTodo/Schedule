import { contextBridge, ipcRenderer } from 'electron'

import { createScheduleHostApi } from './schedule-api'
import { createDesktopWidgetApi } from './widget-api'

contextBridge.exposeInMainWorld(
  'scheduleHost',
  createScheduleHostApi((channel, input) => ipcRenderer.invoke(channel, input))
)

contextBridge.exposeInMainWorld(
  'scheduleDesktop',
  createDesktopWidgetApi(
    (channel, input) => ipcRenderer.invoke(channel, input),
    (channel, handler) => {
      ipcRenderer.on(channel, handler)
      return () => { ipcRenderer.removeListener(channel, handler) }
    }
  )
)
