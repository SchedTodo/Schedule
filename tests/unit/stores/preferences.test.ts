import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

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
      compactDensity: false
    })
  })

  it('updates preferences explicitly', () => {
    const store = usePreferencesStore()

    store.update({ themeMode: 'dark', calendarMode: 'week', compactDensity: true })

    expect(store.themeMode).toBe('dark')
    expect(store.calendarMode).toBe('week')
    expect(store.weekStart).toBe(1)
    expect(store.compactDensity).toBe(true)
  })

  it('round trips validated preferences through injected storage', () => {
    const storage = memoryStorage()
    const first = usePreferencesStore()
    first.update({ themeMode: 'light', weekStart: 0 }, storage)

    setActivePinia(createPinia())
    const restored = usePreferencesStore()
    restored.hydrate(storage)

    expect(restored.themeMode).toBe('light')
    expect(restored.weekStart).toBe(0)
    expect(restored.calendarMode).toBe('month')
  })
})
