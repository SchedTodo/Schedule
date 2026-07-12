import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it, vi } from 'vitest'

import { platformGatewayKey } from '../../../src/app/injection-keys'
import type { ScheduleDto } from '../../../src/contracts/schedule.contract'
import ScheduleModal from '../../../src/features/schedule/components/ScheduleModal.vue'
import { createInMemoryGateway } from '../../../src/platform/browser/in-memory-gateway'
import HomePage from '../../../src/pages/index.vue'

const todo: ScheduleDto = {
  id: '0198f0de-8f7f-7000-8000-000000000001',
  kind: 'todo',
  title: 'Submit report',
  recurrenceCode: '2026-07-13 18:00',
  exclusionCode: '',
  comment: '',
  starred: false,
  createdAt: '2026-07-11T08:00:00Z',
  updatedAt: '2026-07-11T08:00:00Z'
}

describe('home workspace', () => {
  it('renders the todo sidebar and month/week workspace', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: HomePage }]
    })
    await router.push('/')
    const wrapper = mount(HomePage, {
      global: {
        plugins: [createPinia(), router],
        provide: { [platformGatewayKey as symbol]: createInMemoryGateway([todo]) }
      }
    })
    await vi.waitFor(() => expect(wrapper.text()).toContain('Submit report'))

    for (const text of ['Not Expired', 'Not Done', 'Name', 'Deadline', 'Action', 'Done']) {
      expect(wrapper.text()).toContain(text)
    }
    expect(wrapper.get('[data-testid="month-view"]')).toBeTruthy()
    await wrapper.get('button[data-view="week"]').trigger('click')
    expect(wrapper.get('[data-testid="week-view"]')).toBeTruthy()
  })

  it('uses the Add modal fields and keyboard shortcuts', async () => {
    const wrapper = mount(ScheduleModal, {
      global: { stubs: { teleport: true } }
    })

    window.dispatchEvent(new KeyboardEvent('keydown', { ctrlKey: true, key: 'ArrowUp' }))
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Name')
    expect(wrapper.text()).toContain('rTime')
    expect(wrapper.text()).toContain('exTime')
    expect(wrapper.text()).toContain('Comment')

    await wrapper.get('input[aria-label="Name"]').setValue('Weekly review')
    await wrapper.get('textarea[aria-label="rTime"]').setValue('2026-07-12 10:00')
    window.dispatchEvent(new KeyboardEvent('keydown', { ctrlKey: true, key: 'Enter' }))
    await vi.waitFor(() => expect(wrapper.emitted('submit')).toHaveLength(1))
    expect(wrapper.emitted('submit')?.[0]).toEqual([
      {
        title: 'Weekly review',
        recurrenceCode: '2026-07-12 10:00',
        exclusionCode: '',
        comment: ''
      }
    ])
  })
})
