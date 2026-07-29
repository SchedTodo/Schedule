import { describe, expect, it, vi } from 'vitest'

import {
  captureShortcut,
  createShortcutManager,
  defaultShortcutBindings,
  findShortcutConflict,
  formatShortcut,
  matchesShortcut
} from '../../../src/app/shortcuts'

describe('shortcut bindings', () => {
  it('captures and formats normalized modifier chords', () => {
    const event = new KeyboardEvent('keydown', {
      altKey: true,
      ctrlKey: true,
      key: 'a'
    })

    expect(captureShortcut(event)).toEqual({ ok: true, binding: 'Ctrl+Alt+A' })
    expect(formatShortcut('Ctrl+Alt+ArrowLeft')).toBe('Ctrl + Alt + Arrow Left')
    expect(matchesShortcut(event, 'Ctrl+Alt+A')).toBe(true)
  })

  it('rejects unsafe and reserved shortcuts', () => {
    expect(captureShortcut(new KeyboardEvent('keydown', { key: 'a' }))).toEqual({
      ok: false,
      reason: 'modifier-required'
    })
    expect(captureShortcut(new KeyboardEvent('keydown', {
      ctrlKey: true,
      key: 'w'
    }))).toEqual({ ok: false, reason: 'reserved' })
    expect(captureShortcut(new KeyboardEvent('keydown', {
      altKey: true,
      key: 'F4'
    }))).toEqual({ ok: false, reason: 'reserved' })
  })

  it('allows non-printable single keys and detects global conflicts', () => {
    expect(captureShortcut(new KeyboardEvent('keydown', { key: 'Tab' })))
      .toEqual({ ok: true, binding: 'Tab' })
    expect(findShortcutConflict(
      defaultShortcutBindings,
      'editor.acceptCompletion',
      'Ctrl+ArrowLeft'
    )).toBe('navigation.previous')
  })
})

describe('shortcut manager', () => {
  it('runs the highest-priority enabled handler and prevents defaults only when handled', () => {
    const bindings = { ...defaultShortcutBindings }
    const manager = createShortcutManager(() => bindings)
    const lower = vi.fn(() => true)
    const disabled = vi.fn(() => true)
    const higher = vi.fn(() => true)
    manager.register('navigation.next', lower, { priority: 1 })
    manager.register('navigation.next', disabled, {
      enabled: () => false,
      priority: 3
    })
    manager.register('navigation.next', higher, { priority: 2 })
    manager.start()

    const handled = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
      key: 'ArrowRight'
    })
    window.dispatchEvent(handled)

    expect(higher).toHaveBeenCalledOnce()
    expect(lower).not.toHaveBeenCalled()
    expect(disabled).not.toHaveBeenCalled()
    expect(handled.defaultPrevented).toBe(true)

    manager.stop()
  })

  it('keeps default behavior when a handler declines the shortcut', () => {
    const manager = createShortcutManager(() => defaultShortcutBindings)
    manager.register('editor.acceptCompletion', () => false)
    manager.start()
    const event = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'Tab'
    })

    window.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(false)
    manager.stop()
  })

  it('unregisters handlers and removes its single window listener on stop', () => {
    const manager = createShortcutManager(() => defaultShortcutBindings)
    const handler = vi.fn()
    const dispose = manager.register('navigation.next', handler)
    manager.start()
    dispose()

    window.dispatchEvent(new KeyboardEvent('keydown', {
      ctrlKey: true,
      key: 'ArrowRight'
    }))
    manager.stop()
    window.dispatchEvent(new KeyboardEvent('keydown', {
      ctrlKey: true,
      key: 'ArrowRight'
    }))

    expect(handler).not.toHaveBeenCalled()
  })
})
