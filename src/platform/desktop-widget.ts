import { z } from 'zod'

export const DesktopWidgetStateSchema = z.object({
  enabled: z.boolean(),
  alwaysOnTop: z.boolean()
}).strict()

export type DesktopWidgetState = z.infer<typeof DesktopWidgetStateSchema>

export interface DesktopWidgetPort {
  getState(): Promise<DesktopWidgetState>
  setEnabled(value: boolean): Promise<DesktopWidgetState>
  setAlwaysOnTop(value: boolean): Promise<DesktopWidgetState>
  setIgnoreMouseEvents(value: boolean): Promise<void>
  resize(input: {
    edge: 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw'
    phase: 'start' | 'move' | 'end'
    screenX: number
    screenY: number
  }): Promise<void>
  hide(): Promise<void>
  openSchedule(scheduleId: string): Promise<void>
  onOpenSchedule(handler: (scheduleId: string) => void): () => void
  onDataChanged(handler: () => void): () => void
}

function method<T extends (...arguments_: never[]) => unknown>() {
  return z.custom<T>((value) => typeof value === 'function')
}

export const DesktopWidgetPortSchema = z.object({
  getState: method<DesktopWidgetPort['getState']>(),
  setEnabled: method<DesktopWidgetPort['setEnabled']>(),
  setAlwaysOnTop: method<DesktopWidgetPort['setAlwaysOnTop']>(),
  setIgnoreMouseEvents: method<DesktopWidgetPort['setIgnoreMouseEvents']>(),
  resize: method<DesktopWidgetPort['resize']>(),
  hide: method<DesktopWidgetPort['hide']>(),
  openSchedule: method<DesktopWidgetPort['openSchedule']>(),
  onOpenSchedule: method<DesktopWidgetPort['onOpenSchedule']>(),
  onDataChanged: method<DesktopWidgetPort['onDataChanged']>()
}).strict()
