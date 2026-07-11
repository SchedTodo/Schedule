import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { describe, expect, it } from 'vitest'

import App from '../../src/App.vue'

describe('App shell', () => {
  it('renders without an Electron preload API', () => {
    const wrapper = mount(App, {
      global: {
        plugins: [createPinia()],
        stubs: { RouterView: true }
      }
    })

    expect(wrapper.find('[data-testid="app-shell"]').exists()).toBe(true)
    expect('api' in window).toBe(false)
  })
})
