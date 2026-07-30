import { describe, expect, it, vi } from 'vitest'

import { createDesktopWidgetApi } from '../../src-electron/preload/widget-api'
import { widgetIpcChannels } from '../../src-electron/ipc-contracts/widget-ipc'

describe('desktop widget preload API', () => {
  it('validates state and maps desktop controls to named channels', async () => {
    const invoke = vi.fn(async (channel: string) => {
      if (channel === widgetIpcChannels.getState ||
          channel === widgetIpcChannels.setAlwaysOnTop ||
          channel === widgetIpcChannels.setEnabled) {
        return { enabled: true, alwaysOnTop: true }
      }
      return undefined
    })
    const api = createDesktopWidgetApi(invoke, () => () => undefined)

    await expect(api.getState()).resolves.toEqual({ enabled: true, alwaysOnTop: true })
    await expect(api.setEnabled(true)).resolves.toEqual({
      enabled: true,
      alwaysOnTop: true
    })
    await expect(api.setAlwaysOnTop(true)).resolves.toEqual({
      enabled: true,
      alwaysOnTop: true
    })
    await api.setIgnoreMouseEvents(true)
    await api.hide()
    await api.openSchedule('10000000-0000-4000-8000-000000000001')

    expect(invoke.mock.calls).toEqual([
      [widgetIpcChannels.getState, {}],
      [widgetIpcChannels.setEnabled, { value: true }],
      [widgetIpcChannels.setAlwaysOnTop, { value: true }],
      [widgetIpcChannels.setIgnoreMouseEvents, { value: true }],
      [widgetIpcChannels.hide, {}],
      [widgetIpcChannels.openSchedule, {
        scheduleId: '10000000-0000-4000-8000-000000000001'
      }]
    ])
  })
})
