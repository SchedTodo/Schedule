import { contextBridge, ipcRenderer } from 'electron'

import { createScheduleHostApi } from './schedule-api'

contextBridge.exposeInMainWorld(
  'scheduleHost',
  createScheduleHostApi((channel, input) => ipcRenderer.invoke(channel, input))
)
