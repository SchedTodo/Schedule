import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import type { CalendarOccurrenceDto } from '../../../src/contracts/occurrence.contract'
import OccurrenceTooltip from '../../../src/features/schedule/components/OccurrenceTooltip.vue'

const occurrence: CalendarOccurrenceDto = {
  id: '20000000-0000-4000-8000-000000000001',
  scheduleId: '10000000-0000-4000-8000-000000000001',
  kind: 'event',
  title: '02-重叠会议-这是一个用于测试长标题截断和换行的日程',
  excluded: false,
  start: '2026-07-13T01:30:00Z',
  end: '2026-07-13T03:30:00Z',
  startMark: '11',
  endMark: '11',
  comment: '单次时间片备注',
  scheduleComment: '与晨会重叠；这是一段较长的备注。',
  done: false
}

describe('occurrence tooltip', () => {
  it('renders the legacy header, date range, and comment', () => {
    const wrapper = mount(OccurrenceTooltip, {
      props: { item: occurrence, timeZone: 'Asia/Shanghai' },
      slots: { default: '<button>trigger</button>' },
      global: {
        stubs: {
          Tooltip: {
            template: `
              <div class="tooltip-stub">
                <slot name="trigger" />
                <div class="tooltip-header"><slot name="header" /></div>
                <div class="tooltip-content"><slot /></div>
                <div class="tooltip-footer"><slot name="footer" /></div>
              </div>
            `
          }
        }
      }
    })

    expect(wrapper.get('.tooltip-header').text()).toBe(occurrence.title)
    expect(wrapper.get('.tooltip-content').text()).toContain('7/13 09:30–11:30')
    expect(wrapper.get('.tooltip-footer').text()).toBe(occurrence.scheduleComment)
  })
})
