import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { NLayoutSider } from 'naive-ui'
import { describe, expect, it, vi } from 'vitest'

import { platformGatewayKey } from '../../../src/app/injection-keys'
import type { CalendarOccurrenceDto } from '../../../src/contracts/occurrence.contract'
import type { ScheduleDto } from '../../../src/contracts/schedule.contract'
import ScheduleModal from '../../../src/features/schedule/components/ScheduleModal.vue'
import WeekScheduleView from '../../../src/features/schedule/components/WeekScheduleView.vue'
import { createInMemoryGateway } from '../../../src/platform/browser/in-memory-gateway'
import HomePage from '../../../src/pages/index.vue'

const todo: ScheduleDto = {
  id: '0198f0de-8f7f-7000-8000-000000000001',
  kind: 'todo',
  title: 'Submit report',
  recurrenceCode: '2026/7/13 18:00',
  exclusionCode: '',
  comment: '',
  starred: false,
  createdAt: '2026-07-11T08:00:00Z',
  updatedAt: '2026-07-11T08:00:00Z'
}

const eventOccurrence: CalendarOccurrenceDto = {
  id: '0198f0de-8f7f-7000-8000-000000000002',
  scheduleId: '0198f0de-8f7f-7000-8000-000000000003',
  title: 'Overlapping event',
  kind: 'event',
  start: '2026-07-12T10:00:00Z',
  end: '2026-07-12T11:00:00Z',
  startMark: '11',
  endMark: '11',
  comment: '',
  scheduleComment: '',
  done: false,
  excluded: false
}

describe('home workspace', () => {
  async function mountHome(seed: readonly ScheduleDto[] = []) {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: HomePage }]
    })
    await router.push('/')
    return mount(HomePage, {
      global: {
        plugins: [createPinia(), router],
        provide: { [platformGatewayKey as symbol]: createInMemoryGateway(seed) }
      }
    })
  }

  it('renders the todo sidebar and month/week workspace', async () => {
    const wrapper = await mountHome([todo])
    await vi.waitFor(() => expect(wrapper.text()).toContain('Submit report'))

    for (const text of ['Not Expired', 'Not Done', 'Name', 'Deadline', 'Action', 'Done']) {
      expect(wrapper.text()).toContain(text)
    }
    expect(wrapper.get('[data-testid="month-view"]')).toBeTruthy()
    expect(wrapper.find('[aria-label="Sync"]').exists()).toBe(false)
    expect(wrapper.get('.workspace-content').classes()).toContain('workspace-content')
    expect(wrapper.get('button[data-view="month"]').attributes('style'))
      .toContain('background-color: rgba(0, 14, 28, 0.1)')
    await wrapper.get('button[data-view="week"]').trigger('click')
    expect(wrapper.get('[data-testid="week-view"]')).toBeTruthy()
    const weekStyle = wrapper.get('button[data-view="week"]').attributes('style')
    expect(weekStyle).toContain('background-color: rgba(0, 14, 28, 0.1)')
    expect(weekStyle).toContain('box-shadow: 1px 1px 1px 1px rgba(0, 14, 28, 0.6) inset')
  })

  it('completes individual Todo occurrences and filters done rows', async () => {
    const wrapper = await mountHome([todo])
    await vi.waitFor(() => expect(wrapper.text()).toContain('Submit report'))
    const checkbox = wrapper.get('[role="checkbox"][aria-label="Done"]')
    expect(checkbox.classes()).not.toContain('n-checkbox--disabled')
    await checkbox.trigger('click')
    await wrapper.findAll('.todo-toolbar button')[1]!.trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).not.toContain('Submit report'))
  })

  it('uses the native collapsible sider configuration', async () => {
    const wrapper = await mountHome()
    const sider = wrapper.findComponent(NLayoutSider)

    expect(sider.exists()).toBe(true)
    expect(sider.props('width')).toBe('30vw')
    expect(sider.props('collapsedWidth')).toBe(0)
    expect(sider.props('collapseMode')).toBe('width')
    expect(sider.props('showTrigger')).toBe('arrow-circle')
    expect(wrapper.find('.n-layout-toggle-button').exists()).toBe(true)
  })

  it('renders reference empty states and five week columns', async () => {
    const wrapper = await mountHome()
    await vi.waitFor(() => expect(wrapper.text()).toContain('No Data'))
    await wrapper.get('button[data-view="week"]').trigger('click')

    expect(wrapper.findAll('.day-card')).toHaveLength(5)
    expect(wrapper.findAll('[data-testid="no-events"]')).toHaveLength(5)
  })

  it('visually offsets a week card without changing its occurrence', async () => {
    const wrapper = mount(WeekScheduleView, {
      props: { items: [eventOccurrence], timeZone: 'UTC', startDate: '2026-07-12', dayCount: 1 }
    })
    const card = wrapper.get('[data-occurrence-id]')
    const originalStart = card.attributes('style')

    expect(card.attributes('draggable')).toBe('true')
    await card.trigger('dragstart', { offsetY: 5 })
    await card.trigger('dragend', { offsetY: 35 })

    expect(card.attributes('style')).not.toBe(originalStart)
    expect(card.attributes('style')).toContain('30px')
    expect(wrapper.emitted()).not.toHaveProperty('update')
    expect(eventOccurrence.start).toBe('2026-07-12T10:00:00Z')
    await card.trigger('click')
    expect(wrapper.emitted('select')?.[0]).toEqual([eventOccurrence.scheduleId])
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

  it('marks Name and rTime required and shows field errors before submitting', async () => {
    const wrapper = mount(ScheduleModal, {
      global: { stubs: { teleport: true } }
    })

    await wrapper.get('button').trigger('click')
    await wrapper.get('[role="dialog"] button').trigger('click')
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Please input name')
      expect(wrapper.text()).toContain('Please input rTime')
    })

    expect(wrapper.findAll('.n-input--error-status')).toHaveLength(2)
    expect(wrapper.findAll('.n-form-item-label__asterisk')).toHaveLength(2)
    expect(wrapper.emitted('submit')).toBeUndefined()
  })
})
