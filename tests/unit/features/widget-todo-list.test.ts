import { mount } from '@vue/test-utils'
import { NTooltip } from 'naive-ui'
import { describe, expect, it } from 'vitest'

import type { ScheduleOccurrenceDto } from '../../../src/contracts/occurrence.contract'
import WidgetTodoList from '../../../src/features/schedule/components/WidgetTodoList.vue'
import { TEST_NOW } from '../../support/time'

const todo: ScheduleOccurrenceDto = {
  id: '20000000-0000-4000-8000-000000000001',
  scheduleId: '10000000-0000-4000-8000-000000000001',
  kind: 'todo',
  title: 'Submit report',
  excluded: false,
  start: null,
  end: '2026-07-13T06:00:00Z',
  startMark: '11',
  endMark: '11',
  comment: '',
  done: false
}

describe('widget Todo list', () => {
  it('uses the shared absolute and relative time presentation', async () => {
    const wrapper = mount(WidgetTodoList, {
      props: {
        items: [todo],
        timeZone: 'UTC',
        now: TEST_NOW,
        timeDisplayMode: 'clock',
        timeDisplayOverrides: []
      }
    })

    expect(wrapper.get('.widget-todo-time').text()).toContain('06:00')
    expect(wrapper.getComponent(NTooltip).props('themeOverrides')).toMatchObject({
      color: 'rgb(24 24 28 / 62%)',
      boxShadow: 'none'
    })
    await wrapper.setProps({ timeDisplayMode: 'relative' })
    expect(wrapper.get('.widget-todo-time').text()).toBe('in 2h')
  })

  it('emits completion, detail, and per-item time actions', async () => {
    const wrapper = mount(WidgetTodoList, {
      props: {
        items: [todo],
        timeZone: 'UTC',
        now: TEST_NOW,
        timeDisplayMode: 'clock',
        timeDisplayOverrides: []
      }
    })

    await wrapper.get('.widget-todo-title').trigger('click')
    await wrapper.get('.widget-todo-time').trigger('click')
    await wrapper.get('[role="checkbox"]').trigger('click')

    expect(wrapper.emitted('select')).toEqual([[todo.scheduleId]])
    expect(wrapper.emitted('toggle-time')).toEqual([[todo.id]])
    expect(wrapper.emitted('done')).toEqual([[todo.id, true]])
  })
})
