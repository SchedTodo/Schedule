import { describe, expect, it, vi } from 'vitest'

import {
  DesktopLifecycleController,
  resolveLaunchMode,
  type Disposable,
  type PreventableEvent,
  type WindowPort
} from '../../../src-electron/main/desktop-lifecycle-controller'

function createHarness(options: {
  backgroundEnabled?: boolean
  development?: boolean
  minimized?: boolean
  registerError?: unknown
  registerResult?: boolean
  resources?: readonly Disposable[]
} = {}) {
  const handlers: {
    ready?: () => void
    minimize?: () => void
    close?: (event: PreventableEvent) => void
  } = {}
  const calls: string[] = []
  const window: WindowPort = {
    onReadyToShow: (handler) => { handlers.ready = handler },
    onMinimize: (handler) => { handlers.minimize = handler },
    onClose: (handler) => { handlers.close = handler },
    isMinimized: () => options.minimized ?? false,
    restore: () => { calls.push('restore') },
    show: () => { calls.push('show') },
    hide: () => { calls.push('hide') },
    maximize: () => { calls.push('maximize') },
    focus: () => { calls.push('focus') },
    reload: () => { calls.push('reload') }
  }
  const shortcutHandler: { current?: () => void } = {}
  const shortcuts = {
    register: vi.fn((_accelerator: string, handler: () => void) => {
      if (options.registerError) throw options.registerError
      shortcutHandler.current = handler
      return options.registerResult ?? true
    }),
    unregisterAll: vi.fn(() => { calls.push('unregister-shortcuts') })
  }
  const requestAppQuit = vi.fn(() => { calls.push('request-quit') })
  const reportError = vi.fn()
  const controller = new DesktopLifecycleController({
    window,
    shortcuts,
    requestAppQuit,
    reportError,
    resources: options.resources ?? [],
    backgroundEnabled: options.backgroundEnabled ?? true,
    development: options.development ?? false
  })
  return { calls, controller, handlers, reportError, requestAppQuit, shortcutHandler, shortcuts }
}

describe('DesktopLifecycleController', () => {
  it('resolves only the exact autostart argument as an autostart launch', () => {
    expect(resolveLaunchMode(['electron', '.', '--autostart'])).toBe('autostart')
    expect(resolveLaunchMode(['electron', '.', '--autostart=true'])).toBe('normal')
  })

  it('shows, maximizes, and focuses a normal launch when ready', () => {
    const harness = createHarness()
    harness.controller.start('normal')
    harness.handlers.ready?.()
    expect(harness.calls).toEqual(['show', 'maximize', 'focus'])
  })

  it('leaves an autostart launch hidden when ready', () => {
    const harness = createHarness()
    harness.controller.start('autostart')
    harness.handlers.ready?.()
    expect(harness.calls).toEqual([])
  })

  it('hides after the native window minimize event', () => {
    const harness = createHarness()
    harness.controller.start('normal')
    harness.handlers.minimize?.()
    expect(harness.calls).toEqual(['hide'])
  })

  it('prevents Close and hides while not quitting', () => {
    const harness = createHarness()
    const event = { preventDefault: vi.fn() }
    harness.controller.start('normal')
    harness.handlers.close?.(event)
    expect(event.preventDefault).toHaveBeenCalledOnce()
    expect(harness.calls).toEqual(['hide'])
  })

  it('keeps native minimize behavior when background mode is disabled', () => {
    const harness = createHarness({ backgroundEnabled: false })
    harness.controller.start('normal')
    harness.handlers.minimize?.()
    expect(harness.calls).toEqual([])
  })

  it('allows native Close when background mode is disabled', () => {
    const harness = createHarness({ backgroundEnabled: false })
    const event = { preventDefault: vi.fn() }
    harness.controller.start('normal')
    harness.handlers.close?.(event)
    expect(event.preventDefault).not.toHaveBeenCalled()
    expect(harness.calls).toEqual([])
  })

  it('allows Close to continue after quit starts', () => {
    const harness = createHarness()
    const event = { preventDefault: vi.fn() }
    harness.controller.start('normal')
    harness.controller.quit()
    harness.handlers.close?.(event)
    expect(event.preventDefault).not.toHaveBeenCalled()
    expect(harness.requestAppQuit).toHaveBeenCalledOnce()
  })

  it('restores when needed, then shows, maximizes, and focuses from tray', () => {
    const harness = createHarness({ minimized: true })
    harness.controller.showMainWindow()
    expect(harness.calls).toEqual(['restore', 'show', 'maximize', 'focus'])
  })

  it('shows without restoring a window that is not minimized', () => {
    const harness = createHarness()
    harness.controller.showMainWindow()
    expect(harness.calls).toEqual(['show', 'maximize', 'focus'])
  })

  it('registers F5 only in development and reloads through the window port', () => {
    const development = createHarness({ development: true })
    development.controller.start('normal')
    expect(development.shortcuts.register).toHaveBeenCalledWith('F5', expect.any(Function))
    development.shortcutHandler.current?.()
    expect(development.calls).toEqual(['reload'])

    const production = createHarness()
    production.controller.start('normal')
    expect(production.shortcuts.register).not.toHaveBeenCalled()
  })

  it.each([
    { registerResult: false, registerError: undefined },
    { registerResult: true, registerError: new Error('registration failed') }
  ])('reports an F5 registration failure without aborting startup', (options) => {
    const harness = createHarness({ development: true, ...options })
    expect(() => { harness.controller.start('normal') }).not.toThrow()
    expect(harness.reportError).toHaveBeenCalledOnce()
  })

  it('disposes every resource exactly once and marks system shutdown as quitting', () => {
    const calls: string[] = []
    const resources = [
      { dispose: () => { calls.push('database') } },
      { dispose: () => { calls.push('timer') } },
      { dispose: () => { calls.push('tray') } }
    ]
    const harness = createHarness({ resources })
    const event = { preventDefault: vi.fn() }
    harness.controller.start('normal')

    harness.controller.dispose()
    harness.controller.dispose()
    harness.handlers.close?.(event)

    expect(calls).toEqual(['database', 'timer', 'tray'])
    expect(harness.shortcuts.unregisterAll).toHaveBeenCalledOnce()
    expect(event.preventDefault).not.toHaveBeenCalled()
  })

  it('continues disposing resources after one fails', () => {
    const calls: string[] = []
    const failure = new Error('database close failed')
    const harness = createHarness({
      resources: [
        { dispose: () => { calls.push('first') } },
        { dispose: () => { calls.push('second'); throw failure } },
        { dispose: () => { calls.push('third') } }
      ]
    })

    harness.controller.dispose()

    expect(calls).toEqual(['first', 'second', 'third'])
    expect(harness.reportError).toHaveBeenCalledWith(failure)
  })
})
