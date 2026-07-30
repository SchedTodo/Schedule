import type { DesktopWidgetPort } from '../../src/platform/desktop-widget'
import {
  WidgetScheduleInputSchema,
  widgetIpcChannels,
  widgetIpcContracts
} from '../ipc-contracts/widget-ipc'

export type WidgetIpcInvoke = (channel: string, input: unknown) => Promise<unknown>
export type WidgetIpcListen = (
  channel: string,
  handler: (_event: unknown, input: unknown) => void
) => () => void

export function createDesktopWidgetApi(
  invoke: WidgetIpcInvoke,
  listen: WidgetIpcListen
): DesktopWidgetPort {
  return {
    async getState() {
      return widgetIpcContracts[widgetIpcChannels.getState].output.parse(
        await invoke(widgetIpcChannels.getState, {})
      )
    },
    async setEnabled(value) {
      return widgetIpcContracts[widgetIpcChannels.setEnabled].output.parse(
        await invoke(widgetIpcChannels.setEnabled, { value })
      )
    },
    async setAlwaysOnTop(value) {
      return widgetIpcContracts[widgetIpcChannels.setAlwaysOnTop].output.parse(
        await invoke(widgetIpcChannels.setAlwaysOnTop, { value })
      )
    },
    async setIgnoreMouseEvents(value) {
      widgetIpcContracts[widgetIpcChannels.setIgnoreMouseEvents].output.parse(
        await invoke(widgetIpcChannels.setIgnoreMouseEvents, { value })
      )
    },
    async resize(input) {
      widgetIpcContracts[widgetIpcChannels.resize].output.parse(
        await invoke(widgetIpcChannels.resize, input)
      )
    },
    async hide() {
      widgetIpcContracts[widgetIpcChannels.hide].output.parse(
        await invoke(widgetIpcChannels.hide, {})
      )
    },
    async openSchedule(scheduleId) {
      widgetIpcContracts[widgetIpcChannels.openSchedule].output.parse(
        await invoke(widgetIpcChannels.openSchedule, { scheduleId })
      )
    },
    onOpenSchedule(handler) {
      return listen(widgetIpcChannels.navigateSchedule, (_event, input) => {
        const parsed = WidgetScheduleInputSchema.parse(input)
        handler(parsed.scheduleId)
      })
    },
    onDataChanged(handler) {
      return listen(widgetIpcChannels.dataChanged, () => { handler() })
    }
  }
}
