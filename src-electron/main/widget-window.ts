import type { BrowserWindowConstructorOptions, Rectangle } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import { z } from 'zod'

const WidgetWindowStateSchema = z.object({
  bounds: z.object({
    x: z.number().int(),
    y: z.number().int(),
    width: z.number().int().min(640),
    height: z.number().int().min(420)
  }).strict().optional(),
  visible: z.boolean(),
  enabled: z.boolean().default(false),
  alwaysOnTop: z.boolean()
}).strict()

export type WidgetWindowState = z.infer<typeof WidgetWindowStateSchema>

export const defaultWidgetWindowState: WidgetWindowState = {
  enabled: false,
  visible: true,
  alwaysOnTop: false
}

export class WidgetWindowStateStore {
  constructor(private readonly path: string) {}

  load(): WidgetWindowState {
    try {
      return WidgetWindowStateSchema.parse(JSON.parse(readFileSync(this.path, 'utf8')))
    } catch {
      return defaultWidgetWindowState
    }
  }

  save(state: WidgetWindowState): void {
    writeFileSync(this.path, JSON.stringify(WidgetWindowStateSchema.parse(state)), 'utf8')
  }
}

export function ensureVisibleBounds(bounds: Rectangle, workArea: Rectangle): Rectangle {
  const width = Math.min(Math.max(bounds.width, 640), workArea.width)
  const height = Math.min(Math.max(bounds.height, 420), workArea.height)
  const x = Math.min(Math.max(bounds.x, workArea.x), workArea.x + workArea.width - width)
  const y = Math.min(Math.max(bounds.y, workArea.y), workArea.y + workArea.height - height)
  return { x, y, width, height }
}

export function resizeWidgetBounds(
  initial: Rectangle,
  edge: 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw',
  deltaX: number,
  deltaY: number
): Rectangle {
  let { x, y, width, height } = initial
  if (edge.includes('e')) width = Math.max(640, initial.width + deltaX)
  if (edge.includes('s')) height = Math.max(420, initial.height + deltaY)
  if (edge.includes('w')) {
    width = Math.max(640, initial.width - deltaX)
    x = initial.x + initial.width - width
  }
  if (edge.includes('n')) {
    height = Math.max(420, initial.height - deltaY)
    y = initial.y + initial.height - height
  }
  return { x, y, width, height }
}

export function createWidgetWindowOptions(
  preloadPath: string,
  state: WidgetWindowState
): BrowserWindowConstructorOptions {
  return {
    width: state.bounds?.width ?? 760,
    height: state.bounds?.height ?? 560,
    ...(state.bounds === undefined ? {} : { x: state.bounds.x, y: state.bounds.y }),
    minWidth: 640,
    minHeight: 420,
    show: false,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: true,
    alwaysOnTop: state.alwaysOnTop,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  }
}
