import { z } from 'zod'

import { DesktopWidgetStateSchema } from '../../src/platform/desktop-widget'

export const widgetIpcChannels = {
  getState: 'widget:get-state',
  setEnabled: 'widget:set-enabled',
  setAlwaysOnTop: 'widget:set-always-on-top',
  setIgnoreMouseEvents: 'widget:set-ignore-mouse-events',
  resize: 'widget:resize',
  hide: 'widget:hide',
  openSchedule: 'widget:open-schedule',
  navigateSchedule: 'widget:navigate-schedule',
  dataChanged: 'widget:data-changed'
} as const

export const WidgetBooleanInputSchema = z.object({ value: z.boolean() }).strict()
export const WidgetScheduleInputSchema = z.object({ scheduleId: z.uuid() }).strict()
export const WidgetResizeInputSchema = z.object({
  edge: z.enum(['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']),
  phase: z.enum(['start', 'move', 'end']),
  screenX: z.number().finite(),
  screenY: z.number().finite()
}).strict()

export const widgetIpcContracts = {
  [widgetIpcChannels.getState]: {
    input: z.object({}).strict(),
    output: DesktopWidgetStateSchema
  },
  [widgetIpcChannels.setEnabled]: {
    input: WidgetBooleanInputSchema,
    output: DesktopWidgetStateSchema
  },
  [widgetIpcChannels.setAlwaysOnTop]: {
    input: WidgetBooleanInputSchema,
    output: DesktopWidgetStateSchema
  },
  [widgetIpcChannels.setIgnoreMouseEvents]: {
    input: WidgetBooleanInputSchema,
    output: z.void()
  },
  [widgetIpcChannels.resize]: {
    input: WidgetResizeInputSchema,
    output: z.void()
  },
  [widgetIpcChannels.hide]: {
    input: z.object({}).strict(),
    output: z.void()
  },
  [widgetIpcChannels.openSchedule]: {
    input: WidgetScheduleInputSchema,
    output: z.void()
  }
} as const
