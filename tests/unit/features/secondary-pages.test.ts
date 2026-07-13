import { mount } from '@vue/test-utils'
import { NRadio, NSelect, NSwitch } from 'naive-ui'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it, vi } from 'vitest'

import { platformGatewayKey } from '../../../src/app/injection-keys'
import type { ScheduleDto } from '../../../src/contracts/schedule.contract'
import { createInMemoryGateway } from '../../../src/platform/browser/in-memory-gateway'
import DatabasePage from '../../../src/pages/database.vue'
import HelpPage from '../../../src/pages/help.vue'
import ScheduleDetailPage from '../../../src/pages/schedule/[id].vue'
import SettingsPage from '../../../src/pages/settings.vue'

const schedule: ScheduleDto = {
  id: '0198f0de-8f7f-7000-8000-000000000001',
  kind: 'event',
  title: 'Weekly review',
  recurrenceCode: '2026-07-12 10:00',
  exclusionCode: '',
  comment: 'Review notes',
  starred: false,
  createdAt: '2026-07-11T08:00:00Z',
  updatedAt: '2026-07-11T08:00:00Z'
}

function routerAt(path: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/database', component: DatabasePage },
      { path: '/schedule/:id', component: ScheduleDetailPage },
      { path: '/settings', component: SettingsPage },
      { path: '/help', component: HelpPage }
    ]
  })
  return router.push(path).then(() => router)
}

describe('secondary pages', () => {
  it('restores the Database card, filters, and table', async () => {
    const router = await routerAt('/database')
    const wrapper = mount(DatabasePage, {
      global: {
        plugins: [router],
        provide: { [platformGatewayKey as symbol]: createInMemoryGateway([schedule]) }
      }
    })
    await vi.waitFor(() => expect(wrapper.text()).toContain('Weekly review'))
    for (const text of ['Database', 'Search Name or Comment', 'Start Date', 'Type', 'ID', 'Name', 'Deleted', 'Created', 'Updated', 'Star', 'Total is']) {
      expect(wrapper.text()).toContain(text)
    }
  })

  it('restores the Schedule header with Info and Times cards', async () => {
    const router = await routerAt(`/schedule/${schedule.id}`)
    const wrapper = mount(ScheduleDetailPage, {
      global: {
        plugins: [router],
        provide: { [platformGatewayKey as symbol]: createInMemoryGateway([schedule]) }
      }
    })
    await vi.waitFor(() => expect(wrapper.text()).toContain('Weekly review'))
    expect(wrapper.text()).toContain('Schedule')
    expect(wrapper.text()).toContain('Info')
    expect(wrapper.text()).toContain('Times')
    expect(wrapper.text()).toContain('Review notes')
  })

  it('restores complete settings choices and aligned controls', async () => {
    const router = await routerAt('/settings')
    const wrapper = mount(SettingsPage, { global: { plugins: [createPinia(), router] } })

    for (const text of ['Appearance', 'RRule', 'Alarm', 'Preferences', 'Pomodoro', 'Theme']) {
      expect(wrapper.text()).toContain(text)
    }
    expect(wrapper.text()).not.toContain('Compact Density')

    const labels = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']
    const weekStartRadios = wrapper.findAllComponents(NRadio).filter((radio) =>
      labels.includes(radio.text().trim())
    )
    expect(weekStartRadios.map((radio) => radio.props('value'))).toEqual([1, 2, 3, 4, 5, 6, 7])

    const timeZoneSelect = wrapper.findAllComponents(NSelect)[0]!
    expect(timeZoneSelect.props('filterable')).toBe(true)
    expect(timeZoneSelect.props('options')?.length ?? 0).toBeGreaterThan(100)
    expect(wrapper.findAll('.setting-field')).toHaveLength(12)
    expect(wrapper.findAllComponents(NSwitch).every(
      (component) => component.element.parentElement?.classList.contains('setting-field') === true
    )).toBe(true)
  })

  it('documents the shortcuts on Help', () => {
    const wrapper = mount(HelpPage)
    expect(wrapper.text()).toContain('Ctrl + Arrow Left / Right')
    expect(wrapper.text()).toContain('Ctrl + Arrow Up')
    expect(wrapper.text()).toContain('Ctrl + Enter')
  })
})
