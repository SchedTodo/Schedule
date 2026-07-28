import { mount } from '@vue/test-utils'
import { NButton, NDataTable, NInput, NPopconfirm, NRadio, NSelect, NSwitch } from 'naive-ui'
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
      { path: '/database', name: 'database', component: DatabasePage },
      { path: '/schedule/:id', name: 'schedule-detail', component: ScheduleDetailPage },
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
    const table = wrapper.getComponent(NDataTable)
    expect(table.props('remote')).toBe(true)
    expect(table.props('pagination')).toMatchObject({
      pageSize: 10,
      showSizePicker: true,
      pageSizes: [5, 10, 15, 20]
    })
  })

  it('restores the Schedule header with Info and Times cards', async () => {
    const router = await routerAt(`/schedule/${schedule.id}`)
    const detailSchedule: ScheduleDto = {
      ...schedule,
      recurrenceCode: '2026/7/15 10:00;2026/7/16 11:00;',
      exclusionCode: '2026/7/17 12:00;2026/7/18 13:00;'
    }
    const platform = createInMemoryGateway([schedule])
    vi.spyOn(platform.schedules, 'findById').mockResolvedValue({
      ok: true,
      value: { ...detailSchedule, deleted: false }
    })
    const excludeMany = vi.spyOn(platform.occurrences, 'excludeMany')
      .mockResolvedValue({ ok: true, value: undefined })
    const wrapper = mount(ScheduleDetailPage, {
      global: {
        plugins: [router],
        provide: { [platformGatewayKey as symbol]: platform }
      }
    })
    await vi.waitFor(() => expect(wrapper.text()).toContain('Weekly review'))
    expect(wrapper.text()).toContain('Schedule')
    expect(wrapper.text()).toContain('Info')
    expect(wrapper.text()).toContain('Times')
    expect(wrapper.text()).toContain('Review notes')
    expect(wrapper.text()).toContain('Deleted')
    expect(wrapper.text()).not.toContain('Starfalse')
    expect(wrapper.text()).not.toContain('Records')
    expect(wrapper.find('.star-icon').exists()).toBe(true)
    expect(wrapper.find('.star-button').exists()).toBe(true)
    expect(wrapper.find('.schedule-actions').exists()).toBe(true)
    expect(wrapper.find('.schedule-type').exists()).toBe(true)
    expect(wrapper.get('.recurrence-code').element.textContent)
      .toBe('2026/7/15 10:00;\n2026/7/16 11:00;\n')
    expect(wrapper.get('.exclusion-code').element.textContent)
      .toBe('2026/7/17 12:00;\n2026/7/18 13:00;\n')
    expect(wrapper.findAllComponents(NPopconfirm)).toHaveLength(2)
    const table = wrapper.getComponent(NDataTable)
    const columns = table.props('columns') as Array<{ title?: unknown }>
    expect(columns.map((column) => column.title).filter((title) => typeof title === 'string'))
      .toEqual(['Start', 'End', 'Weekday', 'Comment'])
    expect(table.props('pagination')).toMatchObject({
      pageSize: 5,
      showSizePicker: true,
      pageSizes: [5, 10, 15, 20]
    })
    table.vm.$emit('update:checked-row-keys', ['20000000-0000-4000-8000-000000000001'])
    await wrapper.vm.$nextTick()
    expect(excludeMany).not.toHaveBeenCalled()
    wrapper.findAllComponents(NPopconfirm)[1]!.vm.$emit('positive-click')
    await vi.waitFor(() => expect(excludeMany).toHaveBeenCalledWith({
        ids: ['20000000-0000-4000-8000-000000000001']
      }))
  })

  it('opens deleted schedules from Database for read-only detail', async () => {
    const platform = createInMemoryGateway([schedule])
    await platform.schedules.setDeleted({ id: schedule.id, deleted: true })
    const router = await routerAt('/database')
    const wrapper = mount(DatabasePage, {
      global: {
        plugins: [router],
        provide: { [platformGatewayKey as symbol]: platform }
      }
    })

    await vi.waitFor(() => expect(wrapper.text()).toContain('Weekly review'))
    await wrapper.get('tbody tr').trigger('click')

    await vi.waitFor(() => expect(router.currentRoute.value).toMatchObject({
        name: 'schedule-detail',
        params: { id: schedule.id }
      }))
  })

  it('shows Todo record durations with second precision', async () => {
    const todoSchedule: ScheduleDto = { ...schedule, kind: 'todo' }
    const platform = createInMemoryGateway([todoSchedule])
    vi.spyOn(platform.schedules, 'findById').mockResolvedValue({
      ok: true,
      value: { ...todoSchedule, deleted: false }
    })
    vi.spyOn(platform.records, 'listBySchedule').mockResolvedValue({
      ok: true,
      value: [{
        id: '2198f0de-8f7f-7000-8000-000000000001',
        scheduleId: todoSchedule.id,
        start: '2026-07-16T08:00:00.000Z',
        end: '2026-07-16T08:01:23.000Z'
      }]
    })
    const router = await routerAt(`/schedule/${todoSchedule.id}`)
    const wrapper = mount(ScheduleDetailPage, {
      global: {
        plugins: [router],
        provide: { [platformGatewayKey as symbol]: platform }
      }
    })

    await vi.waitFor(() => expect(wrapper.text()).toContain('Records'))
    expect(wrapper.text()).toContain('00:01:23')
    expect(wrapper.text()).not.toContain('1 min')
  })

  it('restores complete settings choices and aligned controls', async () => {
    const router = await routerAt('/settings')
    const wrapper = mount(SettingsPage, { global: { plugins: [createPinia(), router] } })

    for (const text of ['Appearance', 'RRule', 'Alarm', 'Preferences', 'Pomodoro', 'Theme']) {
      expect(wrapper.text()).toContain(text)
    }
    expect(wrapper.text()).not.toContain('Compact Density')

    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    const weekStartRadios = wrapper.findAllComponents(NRadio).filter((radio) =>
      labels.includes(radio.text().trim())
    )
    expect(weekStartRadios.map((radio) => radio.props('value'))).toEqual([1, 2, 3, 4, 5, 6, 7])

    const timeZoneSelect = wrapper.findAllComponents(NSelect)[0]!
    expect(timeZoneSelect.props('filterable')).toBe(true)
    expect(timeZoneSelect.props('options')?.length ?? 0).toBeGreaterThan(100)
    expect(wrapper.text()).toContain('Time Zone Abbreviations')
    const abbreviationTable = wrapper.getComponent(NDataTable)
    expect(abbreviationTable.props('pagination')).toBe(false)
    expect(wrapper.findAllComponents(NSelect)[1]?.props('filterable')).toBe(true)
    expect(wrapper.getComponent(NInput).props('placeholder')).toBe('Abbreviation')
    expect(wrapper.findAll('.setting-field')).toHaveLength(14)
    expect(wrapper.findAllComponents(NSwitch).every(
      (component) => component.element.parentElement?.classList.contains('setting-field') === true
    )).toBe(true)
  })

  it('adds and removes configured time zone abbreviations', async () => {
    const router = await routerAt('/settings')
    const platform = createInMemoryGateway()
    const wrapper = mount(SettingsPage, {
      global: {
        plugins: [createPinia(), router],
        provide: { [platformGatewayKey as symbol]: platform }
      }
    })
    await vi.waitFor(() => expect(wrapper.findAllComponents(NSelect)).toHaveLength(4))

    wrapper.getComponent(NInput).vm.$emit('update:value', 'work_1')
    wrapper.findAllComponents(NSelect)[1]!.vm.$emit('update:value', 'America/Chicago')
    await wrapper.vm.$nextTick()
    await wrapper.findAllComponents(NButton)
      .find((button) => button.text() === 'Add')!
      .trigger('click')

    await vi.waitFor(async () => {
      const result = await platform.settings.get()
      expect(result.ok && result.value.timeZoneAbbreviations)
        .toEqual({ WORK_1: 'America/Chicago' })
    })
    expect(wrapper.getComponent(NDataTable).props('data')).toEqual([
      { abbreviation: 'WORK_1', timeZone: 'America/Chicago' }
    ])

    await wrapper.findAllComponents(NButton)
      .find((button) => button.text() === 'Delete')!
      .trigger('click')
    await vi.waitFor(async () => {
      const result = await platform.settings.get()
      expect(result.ok && result.value.timeZoneAbbreviations).toEqual({})
    })
  })

  it('documents the shortcuts on Help', () => {
    const wrapper = mount(HelpPage)
    expect(wrapper.text()).toContain('Ctrl + Arrow Left / Right')
    expect(wrapper.text()).toContain('Ctrl + Arrow Up')
    expect(wrapper.text()).toContain('Ctrl + Enter')
    expect(wrapper.text()).toContain('now')
    expect(wrapper.text()).toContain('10:?-2h')
  })
})
