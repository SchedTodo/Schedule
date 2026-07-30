import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  createWidgetWindowOptions,
  defaultWidgetWindowState,
  ensureVisibleBounds,
  resizeWidgetBounds,
  WidgetWindowStateStore
} from '../../../src-electron/main/widget-window'

describe('widget window', () => {
  it('uses a secure frameless resizable window with the approved dimensions', () => {
    expect(createWidgetWindowOptions('D:/preload.cjs', defaultWidgetWindowState)).toMatchObject({
      width: 760,
      height: 560,
      minWidth: 640,
      minHeight: 420,
      frame: false,
      resizable: true,
      show: false,
      alwaysOnTop: false,
      webPreferences: {
        preload: 'D:/preload.cjs',
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false
      }
    })
  })

  it('clamps persisted bounds into the selected display work area', () => {
    expect(ensureVisibleBounds(
      { x: 2500, y: -500, width: 900, height: 700 },
      { x: 100, y: 50, width: 1200, height: 800 }
    )).toEqual({ x: 400, y: 50, width: 900, height: 700 })
  })

  it('resizes from every anchored edge while preserving minimum dimensions', () => {
    const initial = { x: 100, y: 100, width: 760, height: 560 }
    expect(resizeWidgetBounds(initial, 'se', 40, 30))
      .toEqual({ x: 100, y: 100, width: 800, height: 590 })
    expect(resizeWidgetBounds(initial, 'nw', 200, 200))
      .toEqual({ x: 220, y: 240, width: 640, height: 420 })
    expect(resizeWidgetBounds(initial, 'w', -40, 0))
      .toEqual({ x: 60, y: 100, width: 800, height: 560 })
  })

  it('falls back when the persisted state is invalid', () => {
    const directory = mkdtempSync(join(tmpdir(), 'schedule-widget-state-'))
    try {
      const store = new WidgetWindowStateStore(join(directory, 'missing.json'))
      expect(store.load()).toEqual(defaultWidgetWindowState)
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })
})
