import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import type { CalendarOccurrenceDto } from '../../../src/contracts/occurrence.contract'
import MonthScheduleView from '../../../src/features/schedule/components/MonthScheduleView.vue'
import OccurrenceTooltip from '../../../src/features/schedule/components/OccurrenceTooltip.vue'
import WeekScheduleView from '../../../src/features/schedule/components/WeekScheduleView.vue'
import { TEST_TIME_ZONE } from '../../support/time'

const occurrences: readonly CalendarOccurrenceDto[] = [
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
    scheduleComment: 'Schedule comment',
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
    scheduleComment: 'Schedule comment',
    done: false
  }
]

describe('occurrence calendar views', () => {
  it('starts the default week range on the shared test date', () => {
    const wrapper = mount(WeekScheduleView, {
      props: { items: [occurrences[0]!], timeZone: 'UTC', dayCount: 1 }
    })

    expect(wrapper.get('.day-card header').text()).toBe('2026/07/13')
    expect(wrapper.get('[data-occurrence-id]').attributes('data-occurrence-id'))
      .toBe(occurrences[0]!.id)
  })

  it('renders every occurrence from one recurring schedule in month view', () => {
    const wrapper = mount(MonthScheduleView, { props: { items: occurrences, timeZone: 'UTC' } })
    expect(wrapper.findAll('[data-occurrence-id]')).toHaveLength(2)
    expect(wrapper.get('.schedule-name').text()).toBe('Recurring review')
    expect(wrapper.get('.schedule-time').text()).toBe('10:00')
  })

  it('renders relative event time and toggles only from the time control', async () => {
    const wrapper = mount(MonthScheduleView, {
      props: {
        items: [occurrences[0]!],
        timeZone: 'UTC',
        timeDisplayMode: 'relative',
        now: '2026-07-13T08:00:00Z'
      }
    })

    expect(wrapper.get('.schedule-time').text()).toBe('in 2h')
    await wrapper.get('.schedule-time').trigger('click')

    expect(wrapper.emitted('toggle-time')).toEqual([[occurrences[0]!.id]])
    expect(wrapper.emitted('select')).toBeUndefined()
    await wrapper.setProps({ timeDisplayOverrides: [occurrences[0]!.id] })
    expect(wrapper.get('.schedule-time').text()).toBe('10:00')
  })

  it('keeps unknown event starts absolute and non-toggleable', async () => {
    const wrapper = mount(WeekScheduleView, {
      props: {
        items: [{ ...occurrences[0]!, startMark: '10' }],
        timeZone: 'UTC',
        startDate: '2026-07-13',
        dayCount: 1,
        timeDisplayMode: 'relative',
        now: '2026-07-13T08:00:00Z'
      }
    })

    expect(wrapper.get('.event-time').text()).toBe('10:?–11:00')
    expect(wrapper.get('.event-time').attributes('disabled')).toBeDefined()
    await wrapper.get('.event-time').trigger('click')
    expect(wrapper.emitted('toggle-time')).toBeUndefined()
  })

  it('uses occurrence IDs for week cards and selects the owning schedule', async () => {
    const wrapper = mount(WeekScheduleView, {
      props: { items: occurrences, timeZone: 'UTC', startDate: '2026-07-12' }
    })
    const cards = wrapper.findAll('[data-occurrence-id]')
    expect(cards.map((card) => card.attributes('data-occurrence-id'))).toEqual([
      occurrences[0]!.id,
      occurrences[1]!.id
    ])
    await cards[0]!.trigger('click')
    expect(wrapper.emitted('select')).toEqual([[occurrences[0]!.scheduleId]])
    expect(wrapper.findAllComponents(OccurrenceTooltip)).toHaveLength(2)
  })

  it('groups and labels occurrences in the selected time zone', () => {
    const crossing = [{
      ...occurrences[0]!,
      start: '2026-07-13T23:30:00Z',
      end: '2026-07-14T00:30:00Z'
    }]
    const month = mount(MonthScheduleView, {
      props: { items: crossing, timeZone: TEST_TIME_ZONE }
    })
    const week = mount(WeekScheduleView, {
      props: {
        items: crossing,
        timeZone: TEST_TIME_ZONE,
        startDate: '2026-07-14',
        dayCount: 1
      }
    })

    expect(month.get('[data-occurrence-id]').text()).toContain('07:30')
    expect(week.get('[data-occurrence-id]').text()).toContain('07:30–08:30')
  })

  it('assigns an all-day event to the prior logical date when the day starts at 06:00', () => {
    const allDay: CalendarOccurrenceDto = {
      ...occurrences[0]!,
      id: '20000000-0000-4000-8000-000000000010',
      title: '09-全天值班',
      start: '2026-07-17T16:00:00Z',
      end: '2026-07-18T15:59:00Z'
    }
    const wrapper = mount(WeekScheduleView, {
      props: {
        items: [allDay],
        timeZone: TEST_TIME_ZONE,
        startDate: '2026-07-17',
        dayCount: 1,
        startHour: 6
      }
    })

    expect(wrapper.get('[data-occurrence-id]').text()).toContain('09-全天值班')
  })

  it('renders a crossing occurrence as centered same-color cards in both logical days', () => {
    const crossing: CalendarOccurrenceDto = {
      ...occurrences[0]!,
      title: '跨日值班',
      start: '2026-07-13T20:00:00Z',
      end: '2026-07-14T08:00:00Z'
    }
    const wrapper = mount(WeekScheduleView, {
      props: {
        items: [crossing],
        timeZone: 'UTC',
        startDate: '2026-07-13',
        dayCount: 2,
        startHour: 6
      }
    })
    const cards = wrapper.findAll('[data-occurrence-id]')

    expect(cards).toHaveLength(2)
    expect(cards.map((card) => card.attributes('data-segment-date')))
      .toEqual(['2026-07-13', '2026-07-14'])
    expect(cards.map((card) => card.text()))
      .toEqual(['跨日值班20:00–08:00', '跨日值班20:00–08:00'])
    expect(cards[0]!.attributes('style')).toContain('58.3333%')
    expect(cards[0]!.attributes('style')).toContain('41.66666666666667%')
    expect(cards[1]!.attributes('style')).toContain('0%')
    expect(cards[1]!.attributes('style')).toContain('8.333333333333332%')
    const backgrounds = cards.map((card) =>
      (card.attributes('style') ?? '').match(/background-color: [^;]+/)?.[0]
    )
    expect(backgrounds[0]).toBeDefined()
    expect(backgrounds[0]).toBe(backgrounds[1])
    expect(wrapper.findAllComponents(OccurrenceTooltip)).toHaveLength(2)
  })

  it('uses a translucent schedule color and strengthens it on hover', async () => {
    const wrapper = mount(WeekScheduleView, {
      props: { items: [occurrences[0]!], timeZone: 'UTC', startDate: '2026-07-13', dayCount: 1 }
    })
    const card = wrapper.get('[data-occurrence-id]')

    expect(card.attributes('style')).toMatch(/background-color: rgba\(\d+, \d+, \d+, 0\.396\)/)
    expect(card.attributes('style')).toMatch(/border: 1\.5px solid rgb\(\d+, \d+, \d+\)/)
    await card.trigger('mouseenter')
    expect(card.attributes('style')).toMatch(/background-color: rgba\(\d+, \d+, \d+, 0\.565\)/)
    expect(card.attributes('style')).toContain('z-index: 999')
    await card.trigger('mouseleave')
    expect(card.attributes('style')).not.toContain('z-index: 999')
  })
})
