import { describe, expect, it, vi } from 'vitest'

import { createApplicationTray, type TrayFactory } from '../../../src-electron/main/tray'

describe('application tray', () => {
  it('maps menu Show/Quit and double-click to the injected controller actions', () => {
    const listeners = new Map<string, () => void>()
    const tray = {
      setToolTip: vi.fn(),
      setContextMenu: vi.fn(),
      on: vi.fn((event: 'double-click', handler: () => void) => { listeners.set(event, handler) }),
      destroy: vi.fn()
    }
    let template: readonly { label?: string; click?: () => void }[] = []
    const factory: TrayFactory = {
      create: vi.fn(() => tray),
      buildMenu: vi.fn((value) => {
        template = value
        return { menu: true }
      })
    }
    const show = vi.fn()
    const toggleWidget = vi.fn()
    const quit = vi.fn()

    expect(createApplicationTray('icon.ico', { show, toggleWidget, quit }, factory)).toBe(tray)
    template.find((item) => item.label === 'Show Schedule')?.click?.()
    template.find((item) => item.label === 'Show/Hide Today Widget')?.click?.()
    template.find((item) => item.label === 'Quit')?.click?.()
    listeners.get('double-click')?.()

    expect(show).toHaveBeenCalledTimes(2)
    expect(toggleWidget).toHaveBeenCalledOnce()
    expect(quit).toHaveBeenCalledOnce()
    expect(tray.setToolTip).toHaveBeenCalledWith('Schedule')
    expect(tray.setContextMenu).toHaveBeenCalledWith({ menu: true })
  })
})
