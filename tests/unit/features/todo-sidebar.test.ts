import { mount } from '@vue/test-utils'
import { NDataTable } from 'naive-ui'
import { describe, expect, it } from 'vitest'

import type { ScheduleOccurrenceDto } from '../../../src/contracts/occurrence.contract'
import TodoSidebar from '../../../src/features/schedule/components/TodoSidebar.vue'
import { TEST_NOW, TEST_TIME_ZONE } from '../../support/time'

function todo(
  index: number,
  title: string,
  end: string,
  done = false
): ScheduleOccurrenceDto {
  const suffix = String(index).padStart(12, '0')
  return {
    id: `20000000-0000-4000-8000-${suffix}`,
    scheduleId: `10000000-0000-4000-8000-${suffix}`,
    kind: 'todo',
    title,
    excluded: false,
    start: null,
    end,
    startMark: '11',
    endMark: '11',
    comment: '',
    done
  }
}

const items = [
  todo(1, 'Expired task', '2026-07-13T03:59:00Z'),
  todo(2, 'Today task', '2026-07-13T15:30:00Z'),
  todo(3, 'Tomorrow task', '2026-07-14T04:00:00Z'),
  todo(4, 'Future task', '2026-07-15T04:00:00Z'),
  todo(5, 'Completed task', '2026-07-20T04:00:00Z', true)
] as const

describe('Todo sidebar', () => {
  function mountSidebar() {
    return mount(TodoSidebar, {
      props: {
        items,
        timeZone: TEST_TIME_ZONE,
        now: TEST_NOW
      }
    })
  }

  it('renders legacy deadline tones and format', () => {
    const wrapper = mountSidebar()

    const table = wrapper.findComponent(NDataTable)
    expect(table.exists()).toBe(true)
    expect(table.props('maxHeight')).toBe('76vh')
    expect(table.props('minHeight')).toBe('76vh')
    const columns = table.props('columns') ?? []
    expect(columns.map((column) => 'key' in column ? String(column.key) : '')).toEqual([
      'name', 'end', 'action', 'done'
    ])
    const rowClassName = table.props('rowClassName') as (row: ScheduleOccurrenceDto) => string
    expect(rowClassName(items[0])).toContain('row-expired')
    expect(rowClassName(items[1])).toContain('row-tdy')
    expect(rowClassName(items[2])).toContain('row-tmr')
    expect(rowClassName(items[3])).toContain('row-after-tmr')
    expect(rowClassName(items[4])).toContain('row-done')

    expect(wrapper.get('.row-tdy').text()).toContain('07/13 23:30')
  })

  it('opens details from the name and toggles time from the deadline', async () => {
    const wrapper = mountSidebar()

    await wrapper.get('[data-action="name"]').trigger('click')
    await wrapper.get('[data-action="deadline"]').trigger('click')

    expect(wrapper.emitted('select')).toEqual([[items[0].scheduleId]])
    expect(wrapper.emitted('toggle-time')).toEqual([[items[0].id]])
  })

  it('renders relative Todo deadlines and leaves unknown deadlines absolute', () => {
    const wrapper = mount(TodoSidebar, {
      props: {
        items: [items[0], { ...items[1], endMark: '10' }],
        timeZone: TEST_TIME_ZONE,
        now: TEST_NOW,
        timeDisplayMode: 'relative'
      }
    })

    const deadlines = wrapper.findAll('[data-action="deadline"]')
    expect(deadlines[0]!.text()).toBe('overdue 1m')
    expect(deadlines[1]!.text()).toBe('07/13 23:30')
    expect(deadlines[1]!.attributes('disabled')).toBeDefined()
  })

  it('uses the legacy Play action and emits completion changes', async () => {
    const wrapper = mountSidebar()

    expect(wrapper.get('[aria-label="Concentrate"]').find('.n-icon').exists()).toBe(true)
    await wrapper.get('[aria-label="Concentrate"]').trigger('click')
    await wrapper.get('[role="checkbox"][aria-label="Done"]').trigger('click')

    expect(wrapper.emitted('concentrate')).toEqual([[items[0].id]])
    expect(wrapper.emitted('done')).toEqual([[items[0].id, true]])
  })

  it('shows the shared pressed state while filtering expired and done rows', async () => {
    const wrapper = mountSidebar()

    await wrapper.get('[data-filter="expired"]').trigger('click')
    await wrapper.get('[data-filter="done"]').trigger('click')

    for (const selector of ['[data-filter="expired"]', '[data-filter="done"]']) {
      const style = wrapper.get(selector).attributes('style')
      expect(style).toContain('background-color: var(--color-control-pressed-background)')
      expect(style).toContain('box-shadow: var(--shadow-control-pressed)')
    }
    expect(wrapper.text()).not.toContain('Expired task')
    expect(wrapper.text()).not.toContain('Completed task')
  })
})
