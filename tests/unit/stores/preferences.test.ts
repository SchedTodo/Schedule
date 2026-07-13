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
      weekStart: 1
    })
  })

  it('updates ISO week starts and round trips them through storage', () => {
    const storage = memoryStorage()
    const first = usePreferencesStore()
    first.update({ themeMode: 'light', calendarMode: 'week', weekStart: 7 }, storage)

    setActivePinia(createPinia())
    const restored = usePreferencesStore()
    restored.hydrate(storage)

    expect(restored.$state).toEqual({
      themeMode: 'light',
      calendarMode: 'week',
      weekStart: 7
    })
  })
})
