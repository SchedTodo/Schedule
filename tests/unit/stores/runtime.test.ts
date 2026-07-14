import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useRuntimeStore } from '../../../src/stores/runtime'

describe('runtime store', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('initializes the homepage priority from the persisted default', () => {
    const store = useRuntimeStore()
    store.init('week')

    expect(store.homepage.priority).toBe('week')
  })

  it('keeps the selected homepage priority for the Pinia lifetime', () => {
    const first = useRuntimeStore()
    first.init('month')
    first.homepage.priority = 'week'

    const restored = useRuntimeStore()
    expect(restored.homepage.priority).toBe('week')
  })
})
