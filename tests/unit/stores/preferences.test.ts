import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { defaultShortcutBindings } from '../../../src/app/shortcuts'
import { usePreferencesStore } from '../../../src/stores/preferences'

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem(key: string) {
      return values.get(key) ?? null
    },
    setItem(key: string, value: string) {
      values.set(key, value)
    }
  }
}

describe('preferences store', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('uses stable client preference defaults', () => {
    const store = usePreferencesStore()

    expect(store.$state).toEqual({
      themeMode: 'system',
      calendarMode: 'month',
      weekStart: 1,
      locale: 'en-US',
      shortcuts: defaultShortcutBindings
    })
  })

  it('updates ISO week starts and round trips them through storage', () => {
    const storage = memoryStorage()
    const first = usePreferencesStore()
    first.update({
      themeMode: 'light',
      calendarMode: 'week',
      weekStart: 7,
      locale: 'zh-CN',
      shortcuts: defaultShortcutBindings
    }, storage)

    setActivePinia(createPinia())
    const restored = usePreferencesStore()
    restored.hydrate(storage)

    expect(restored.$state).toEqual({
      themeMode: 'light',
      calendarMode: 'week',
      weekStart: 7,
      locale: 'zh-CN',
      shortcuts: defaultShortcutBindings
    })
  })

  it('rejects legacy preferences without locale', () => {
    const storage = memoryStorage()
    storage.setItem('schedule-v2-preferences', JSON.stringify({
      themeMode: 'dark',
      calendarMode: 'week',
      weekStart: 7
    }))
    const store = usePreferencesStore()
    store.hydrate(storage, 'zh-CN')

    expect(store.$state).toEqual({
      themeMode: 'system',
      calendarMode: 'month',
      weekStart: 1,
      locale: 'zh-CN',
      shortcuts: defaultShortcutBindings
    })
  })

  it('adds default shortcuts to existing valid preferences and persists custom bindings', () => {
    const storage = memoryStorage()
    storage.setItem('schedule-v2-preferences', JSON.stringify({
      themeMode: 'dark',
      calendarMode: 'week',
      weekStart: 7,
      locale: 'zh-CN'
    }))
    const first = usePreferencesStore()
    first.hydrate(storage)

    expect(first.shortcuts).toEqual(defaultShortcutBindings)
    first.updateShortcut('navigation.next', 'Ctrl+PageDown', storage)
    first.updateShortcut('editor.acceptCompletion', null, storage)

    setActivePinia(createPinia())
    const restored = usePreferencesStore()
    restored.hydrate(storage)
    expect(restored.shortcuts['navigation.next']).toBe('Ctrl+PageDown')
    expect(restored.shortcuts['editor.acceptCompletion']).toBeNull()
  })

  it('rejects persisted shortcut conflicts and reserved bindings', () => {
    const storage = memoryStorage()
    storage.setItem('schedule-v2-preferences', JSON.stringify({
      themeMode: 'dark',
      calendarMode: 'week',
      weekStart: 7,
      locale: 'en-US',
      shortcuts: {
        ...defaultShortcutBindings,
        'navigation.next': 'Ctrl+ArrowLeft',
        'editor.acceptCompletion': 'Ctrl+W'
      }
    }))
    const store = usePreferencesStore()

    store.hydrate(storage, 'zh-CN')

    expect(store.themeMode).toBe('system')
    expect(store.locale).toBe('zh-CN')
    expect(store.shortcuts).toEqual(defaultShortcutBindings)
  })
})
