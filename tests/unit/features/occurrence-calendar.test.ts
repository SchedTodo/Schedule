import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import type { ScheduleOccurrenceDto } from '../../../src/contracts/occurrence.contract'
import MonthScheduleView from '../../../src/features/schedule/components/MonthScheduleView.vue'
import WeekScheduleView from '../../../src/features/schedule/components/WeekScheduleView.vue'

const occurrences: readonly ScheduleOccurrenceDto[] = [
  {
    id: '20000000-0000-4000-8000-000000000001',
    scheduleId: '10000000-0000-4000-8000-000000000001',
    kind: 'event',
    title: 'Recurring review',
    excluded: false,
    start: '2026-07-13T10:00:00Z',
    end: '2026-07-13T11:00:00Z',
    startMark: '11',
    endMark: '11',
    comment: '',
    done: false
  },
  {
    id: '20000000-0000-4000-8000-000000000002',
    scheduleId: '10000000-0000-4000-8000-000000000001',
    kind: 'event',
    title: 'Recurring review',
    excluded: false,
    start: '2026-07-15T10:00:00Z',
    end: '2026-07-15T11:00:00Z',
    startMark: '11',
    endMark: '11',
    comment: '',
    done: false
  }
]

describe('occurrence calendar views', () => {
  it('renders every occurrence from one recurring schedule in month view', () => {
    const wrapper = mount(MonthScheduleView, { props: { items: occurrences } })
    expect(wrapper.findAll('[data-occurrence-id]')).toHaveLength(2)
  })

  it('uses occurrence IDs for week cards and selects the owning schedule', async () => {
    const wrapper = mount(WeekScheduleView, {
      props: { items: occurrences, startDate: '2026-07-12' }
    })
    const cards = wrapper.findAll('[data-occurrence-id]')
    expect(cards.map((card) => card.attributes('data-occurrence-id'))).toEqual([
      occurrences[0]!.id,
      occurrences[1]!.id
    ])
    await cards[0]!.trigger('click')
    expect(wrapper.emitted('select')).toEqual([[occurrences[0]!.scheduleId]])
  })
})
