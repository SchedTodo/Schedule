import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import type { ScheduleDto } from '../../../src/contracts/schedule.contract'
import ScheduleComposer from '../../../src/features/schedule/components/ScheduleComposer.vue'
import ScheduleList from '../../../src/features/schedule/components/ScheduleList.vue'

const event: ScheduleDto = {
  id: '0198f0de-8f7f-7000-8000-000000000001',
  kind: 'event',
  title: '周会',
  recurrenceCode: '2026-07-12 10:00',
  exclusionCode: '',
  comment: '',
  starred: false,
  createdAt: '2026-07-11T08:00:00Z',
  updatedAt: '2026-07-11T08:00:00Z'
}

const todo: ScheduleDto = {
  ...event,
  id: '0198f0de-8f7f-7000-8000-000000000002',
  kind: 'todo',
  title: '提交周报',
  recurrenceCode: ''
}

describe('schedule UI', () => {
  it('renders an accessible composer and emits normalized input', async () => {
    const wrapper = mount(ScheduleComposer)

    expect(wrapper.get('label[for="schedule-title"]').text()).toBe('Name')
    expect(wrapper.get('label[for="schedule-recurrence"]').text()).toBe('rTime')
    expect(wrapper.get('label[for="schedule-comment"]').text()).toBe('Comment')
    await wrapper.get('#schedule-title').setValue(' 周会 ')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('submit')?.[0]).toEqual([
      { title: '周会', recurrenceCode: '', exclusionCode: '', comment: '' }
    ])
  })

  it('validates title and disables submit while loading', async () => {
    const wrapper = mount(ScheduleComposer, { props: { loading: true } })

    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.get('button[type="submit"]').attributes()).toHaveProperty('disabled')

    await wrapper.setProps({ loading: false })
    await wrapper.get('form').trigger('submit')
    expect(wrapper.get('[role="alert"]').text()).toContain('Please input name')
  })

  it('renders empty, error, event, and todo list states', () => {
    const empty = mount(ScheduleList, { props: { items: [] } })
    expect(empty.text()).toContain('No schedules')

    const failed = mount(ScheduleList, {
      props: {
        items: [],
        error: {
          code: 'INTERNAL_ERROR',
          messageKey: 'error.internalError',
          message: '加载失败'
        }
      }
    })
    expect(failed.get('[role="alert"]').text()).toContain('unexpectedly')

    const list = mount(ScheduleList, { props: { items: [event, todo] } })
    expect(list.text()).toContain('Event')
    expect(list.text()).toContain('Todo')
    expect(list.text()).toContain('周会')
    expect(list.text()).toContain('提交周报')
  })

  it('selects a schedule through a keyboard-focusable control', async () => {
    const wrapper = mount(ScheduleList, { props: { items: [event] } })
    const control = wrapper.get('button[data-schedule-id]')

    expect(control.attributes('type')).toBe('button')
    await control.trigger('click')
    expect(wrapper.emitted('select')).toEqual([[event.id]])
  })
})
