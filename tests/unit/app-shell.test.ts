/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import { NLayoutContent } from 'naive-ui'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it, vi } from 'vitest'

import App from '../../src/App.vue'
import { usePreferencesStore } from '../../src/stores/preferences'

const applicationStyles = readFileSync(resolve('src/assets/styles/main.css'), 'utf8')

const routes = [
  { path: '/', component: { template: '<div>Home page</div>' } },
  { path: '/database', component: { template: '<div>Database page</div>' } },
  { path: '/settings', component: { template: '<div>Settings page</div>' } },
  { path: '/help', component: { template: '<div>Help page</div>' } }
]

describe('App shell', () => {
  it('renders the application navigation, guest identity, idea pane, and footer', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push('/')
    const wrapper = mount(App, {
      global: {
        plugins: [createPinia(), router]
      }
    })

    for (const label of ['Home', 'Database', 'Settings', 'Help']) {
      expect(wrapper.text()).toContain(label)
    }
    expect(wrapper.text()).toContain('Guest')
    expect(wrapper.text()).toContain('© 2023')
    expect(wrapper.get('[aria-label="Idea"]')).toBeTruthy()
    expect('api' in window).toBe(false)
  })

  it('cycles routes with the Ctrl+Arrow shortcuts', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push('/')
    mount(App, { global: { plugins: [createPinia(), router] } })

    window.dispatchEvent(new KeyboardEvent('keydown', { ctrlKey: true, key: 'ArrowRight' }))
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/database'))
    window.dispatchEvent(new KeyboardEvent('keydown', { ctrlKey: true, key: 'ArrowLeft' }))
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/'))
  })

  it('keeps chrome outside the only scrollable content row', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push('/settings')
    const wrapper = mount(App, { global: { plugins: [createPinia(), router] } })

    expect(wrapper.get('.application-layout').element.tagName).toBe('DIV')
    expect(wrapper.findComponent(NLayoutContent).props('nativeScrollbar')).toBe(true)
    expect(applicationStyles).toContain('grid-template-rows: 53px minmax(0, 1fr) 48px')
    expect(applicationStyles).toContain('.application-content > .n-layout-scroll-container')
    expect(applicationStyles).toContain('scrollbar-width: none')
    expect(applicationStyles).toContain('::-webkit-scrollbar')
    expect(applicationStyles).not.toContain('inset-block: 53px 5vh')
  })

  it.each(['light', 'dark'] as const)('keeps navigation contrast in %s mode', async (mode) => {
    const pinia = createPinia()
    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push('/')
    const preferences = usePreferencesStore(pinia)
    preferences.update({ themeMode: mode }, { getItem: () => null, setItem: () => undefined })
    const wrapper = mount(App, { global: { plugins: [pinia, router] } })

    expect(wrapper.get('.application-header').attributes('style')).toContain(
      'background-color: var(--color-navigation)'
    )
    expect(wrapper.get('.application-header').attributes('style')).toContain(
      'color: var(--color-navigation-text)'
    )
    expect(wrapper.get('.application-footer').attributes('style')).toContain(
      'background-color: var(--color-navigation)'
    )
  })
})
