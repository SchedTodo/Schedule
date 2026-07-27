import { flushPromises, mount } from '@vue/test-utils'
import { NSelect } from 'naive-ui'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { platformGatewayKey } from '../../../src/app/injection-keys'
import type { ScheduleOccurrenceDto } from '../../../src/contracts/occurrence.contract'
import { createInMemoryGateway } from '../../../src/platform/browser/in-memory-gateway'
import ConcentratePage from '../../../src/pages/concentrate/[timeId].vue'
import { TEST_NOW } from '../../support/time'

const initialTime = TEST_NOW
const oneMinuteAfterInitialTime = new Date(Date.parse(TEST_NOW) + 60_001).toISOString()
const firstTodo: ScheduleOccurrenceDto = {
  id: '1198f0de-8f7f-7000-8000-000000000001',
  scheduleId: '0198f0de-8f7f-7000-8000-000000000001',
  kind: 'todo',
  title: 'Write tests',
  excluded: false,
  start: null,
  end: '2026-07-16T08:00:00.000Z',
  startMark: '00',
  endMark: '11',
  comment: '',
  done: false
}
const secondTodo: ScheduleOccurrenceDto = {
  ...firstTodo,
  id: '1198f0de-8f7f-7000-8000-000000000002',
  scheduleId: '0198f0de-8f7f-7000-8000-000000000002',
  title: 'Review code'
}

async function mountPage(focusMinutes: number) {
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
  vi.setSystemTime(initialTime)
  const platform = createInMemoryGateway()
  vi.spyOn(platform.settings, 'get').mockResolvedValue({
    ok: true,
    value: {
      timeZone: 'UTC', timeZoneAbbreviations: {}, weekStart: 1,
      todoAlarmEnabled: true, todoAlarmBeforeMinutes: 5,
      eventAlarmEnabled: true, eventAlarmBeforeMinutes: 5,
      calendarMode: 'month', weekViewDays: 5,
      logicalDayStartHour: 0, logicalDayStartMinute: 0,
      openAtLogin: false, focusMinutes,
      smallBreakMinutes: 1, bigBreakMinutes: 1
    }
  })
  vi.spyOn(platform.occurrences, 'listTodos').mockResolvedValue({
    ok: true,
    value: [firstTodo, secondTodo]
  })
  const notify = vi.spyOn(platform.notifications, 'show').mockResolvedValue({
    ok: true,
    value: undefined
  })
  const createRecord = vi.spyOn(platform.records, 'create').mockImplementation(async (input) => ({
    ok: true,
    value: { id: '2198f0de-8f7f-7000-8000-000000000001', ...input }
  }))
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/concentrate/:timeId', name: 'concentrate', component: ConcentratePage }]
  })
  await router.push(`/concentrate/${firstTodo.id}`)
  const wrapper = mount(ConcentratePage, {
    global: {
      plugins: [router],
      provide: { [platformGatewayKey as symbol]: platform }
    }
  })
  await flushPromises()
  return { wrapper, platform, notify, createRecord }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('concentrate page', () => {
  it('shows the stage, advances automatically, and pauses without losing progress', async () => {
    const { wrapper, notify } = await mountPage(1)
    expect(wrapper.text()).toContain('Focus 1 of 4')
    expect(wrapper.text()).toContain('01:00')
    expect(wrapper.text()).toContain('Focused 00:00:00')

    await wrapper.get('[data-testid="focus-toggle"]').trigger('click')
    await vi.advanceTimersByTimeAsync(60_000)
    expect(wrapper.text()).toContain('Small Break')
    expect(wrapper.text()).toContain('Focused 00:01:00')
    expect(notify).toHaveBeenCalledWith({ title: 'Take a break', body: 'Small Break' })

    await vi.advanceTimersByTimeAsync(30_000)
    expect(wrapper.text()).toContain('00:30')
    await wrapper.get('[data-testid="focus-toggle"]').trigger('click')
    await vi.advanceTimersByTimeAsync(10_000)
    expect(wrapper.text()).toContain('00:30')
    await wrapper.get('[data-testid="focus-toggle"]').trigger('click')
    await vi.advanceTimersByTimeAsync(10_000)
    expect(wrapper.text()).toContain('00:20')
  })

  it('saves qualifying Focus time to the outgoing Todo when selection changes', async () => {
    const { wrapper, createRecord } = await mountPage(2)
    await wrapper.get('[data-testid="focus-toggle"]').trigger('click')
    await vi.advanceTimersByTimeAsync(60_001)
    wrapper.getComponent(NSelect).vm.$emit('update:value', secondTodo.id)
    await flushPromises()

    expect(createRecord).toHaveBeenCalledWith({
      scheduleId: firstTodo.scheduleId,
      start: initialTime,
      end: oneMinuteAfterInitialTime
    })
  })

  it('saves qualifying Focus time when leaving the page', async () => {
    const { wrapper, createRecord } = await mountPage(2)
    await wrapper.get('[data-testid="focus-toggle"]').trigger('click')
    await vi.advanceTimersByTimeAsync(60_001)
    wrapper.unmount()
    await flushPromises()

    expect(createRecord).toHaveBeenCalledWith({
      scheduleId: firstTodo.scheduleId,
      start: initialTime,
      end: oneMinuteAfterInitialTime
    })
  })
})
