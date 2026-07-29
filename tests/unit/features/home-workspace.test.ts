import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, type Pinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { NLayoutSider } from 'naive-ui'
import { describe, expect, it, vi } from 'vitest'

import {
  appFeedbackKey,
  type AppFeedback
} from '../../../src/app/app-feedback'
import { platformGatewayKey } from '../../../src/app/injection-keys'
import {
  createShortcutManager,
  defaultShortcutBindings,
  shortcutManagerKey
} from '../../../src/app/shortcuts'
import type { CalendarOccurrenceDto } from '../../../src/contracts/occurrence.contract'
import type { ScheduleDto } from '../../../src/contracts/schedule.contract'
import { defaultSettings } from '../../../src/contracts/settings.contract'
import ScheduleModal from '../../../src/features/schedule/components/ScheduleModal.vue'
import ScheduleCodeEditor from '../../../src/features/schedule/editor/ScheduleCodeEditor.vue'
import WeekScheduleView from '../../../src/features/schedule/components/WeekScheduleView.vue'
import { FixedClock } from '../../../src/domain/shared/clock'
import { CryptoIdGenerator } from '../../../src/domain/shared/id-generator'
import { createInMemoryGateway } from '../../../src/platform/browser/in-memory-gateway'
import HomePage from '../../../src/pages/index.vue'
import { useRuntimeStore } from '../../../src/stores/runtime'
import { TEST_NOW } from '../../support/time'

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

async function setScheduleCode(
  wrapper: ReturnType<typeof mount>,
  ariaLabel: 'rTime' | 'exTime',
  value: string
) {
  const editor = wrapper.findAllComponents(ScheduleCodeEditor)
    .find((candidate) => candidate.props('ariaLabel') === ariaLabel)
  if (editor === undefined) throw new Error(`Missing ${ariaLabel} editor`)
  ;(editor.vm as unknown as { insertText(value: string): void }).insertText(value)
  await wrapper.vm.$nextTick()
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

const fixedNow = TEST_NOW

describe('home workspace', () => {
  function testGateway(seed: readonly ScheduleDto[] = []) {
    return createInMemoryGateway(seed, {
      clock: new FixedClock(fixedNow),
      idGenerator: new CryptoIdGenerator()
    })
  }

  async function mountHome(
    seed: readonly ScheduleDto[] = [],
    pinia: Pinia = createPinia(),
    platform = testGateway(seed),
    feedback?: AppFeedback
  ) {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: HomePage }]
    })
    await router.push('/')
    return mount(HomePage, {
      global: {
        plugins: [pinia, router],
        stubs: { teleport: true },
        provide: {
          [platformGatewayKey as symbol]: platform,
          ...(feedback === undefined ? {} : { [appFeedbackKey as symbol]: feedback })
        }
      }
    })
  }

  it('queries the current logical day from the shared test instant', async () => {
    const platform = testGateway([todo])
    const listTodos = vi.spyOn(platform.occurrences, 'listTodos')
    const wrapper = await mountHome([todo], createPinia(), platform)
    await vi.waitFor(() => expect(wrapper.text()).toContain('Submit report'))

    expect(listTodos).toHaveBeenCalledWith({
      now: TEST_NOW,
      timeZone: 'UTC',
      logicalDayStartHour: 0,
      logicalDayStartMinute: 0
    })
  })

  it('restores the runtime calendar view after the homepage remounts', async () => {
    const pinia = createPinia()
    const first = await mountHome([], pinia)
    await first.get('button[data-view="week"]').trigger('click')
    expect(useRuntimeStore(pinia).homepage.priority).toBe('week')
    first.unmount()

    const restored = await mountHome([], pinia)
    expect(restored.find('[data-testid="week-view"]').exists()).toBe(true)
    await restored.get('button[data-view="month"]').trigger('click')
    expect(useRuntimeStore(pinia).homepage.priority).toBe('month')
  })

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
      .toContain('background-color: var(--color-control-pressed-background)')
    await wrapper.get('button[data-view="week"]').trigger('click')
    expect(wrapper.get('[data-testid="week-view"]')).toBeTruthy()
    const weekStyle = wrapper.get('button[data-view="week"]').attributes('style')
    expect(weekStyle).toContain('background-color: var(--color-control-pressed-background)')
    expect(weekStyle).toContain('box-shadow: var(--shadow-control-pressed)')
  })

  it('keeps runtime time mode and clears item overrides on global changes', async () => {
    const pinia = createPinia()
    const wrapper = await mountHome([], pinia)
    const runtime = useRuntimeStore(pinia)

    expect(wrapper.get('button[data-time-mode="clock"]').attributes('style'))
      .toContain('background-color: var(--color-control-pressed-background)')
    await wrapper.get('button[data-time-mode="relative"]').trigger('click')
    expect(runtime.homepage.timeDisplayMode).toBe('relative')

    runtime.toggleOccurrenceTime(eventOccurrence.id)
    expect(runtime.homepage.timeDisplayOverrides).toEqual([eventOccurrence.id])
    await wrapper.get('button[data-time-mode="clock"]').trigger('click')
    expect(runtime.homepage.timeDisplayMode).toBe('clock')
    expect(runtime.homepage.timeDisplayOverrides).toEqual([])
  })

  it('refreshes visible relative event time once per minute', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(TEST_NOW))
    const platform = testGateway()
    vi.spyOn(platform.occurrences, 'listRange').mockResolvedValue({
      ok: true,
      value: [{
        ...eventOccurrence,
        start: '2026-07-13T04:02:00Z',
        end: '2026-07-13T05:02:00Z'
      }]
    })
    const wrapper = await mountHome([], createPinia(), platform)

    try {
      await flushPromises()
      await wrapper.get('button[data-time-mode="relative"]').trigger('click')
      expect(wrapper.get('.schedule-time').text()).toBe('in 2m')

      await vi.advanceTimersByTimeAsync(60_000)
      await wrapper.vm.$nextTick()
      expect(wrapper.get('.schedule-time').text()).toBe('in 1m')
    } finally {
      wrapper.unmount()
      vi.useRealTimers()
    }
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
    const shortcutManager = createShortcutManager(() => defaultShortcutBindings)
    shortcutManager.start()
    const wrapper = mount(ScheduleModal, {
      props: { settings: defaultSettings },
      global: {
        provide: { [shortcutManagerKey as symbol]: shortcutManager },
        stubs: { teleport: true }
      }
    })

    try {
      window.dispatchEvent(new KeyboardEvent('keydown', { ctrlKey: true, key: 'ArrowUp' }))
      await wrapper.vm.$nextTick()
      expect(wrapper.text()).toContain('Name')
      expect(wrapper.text()).toContain('rTime')
      expect(wrapper.text()).toContain('exTime')
      expect(wrapper.text()).toContain('Comment')

      await wrapper.get('input[aria-label="Name"]').setValue('Weekly review')
      await setScheduleCode(wrapper, 'rTime', '2026/07/12 10:00')
      window.dispatchEvent(new KeyboardEvent('keydown', { ctrlKey: true, key: 'Enter' }))
      await vi.waitFor(() => expect(wrapper.emitted('submit')).toHaveLength(1))
      expect(wrapper.emitted('submit')?.[0]).toEqual([
        {
          title: 'Weekly review',
          recurrenceCode: '2026/07/12 10:00',
          exclusionCode: '',
          comment: ''
        }
      ])
    } finally {
      wrapper.unmount()
      shortcutManager.stop()
    }
  })

  it('reports schedule creation success and failure through application feedback', async () => {
    const feedback: AppFeedback = {
      success: vi.fn(),
      error: vi.fn()
    }
    const platform = testGateway()
    const create = vi.spyOn(platform.schedules, 'create')
    const wrapper = await mountHome([], createPinia(), platform, feedback)
    const input = {
      title: 'Weekly review',
      recurrenceCode: '2026/7/14 10:00',
      exclusionCode: '',
      comment: ''
    }

    await wrapper.getComponent(ScheduleModal).get('button').trigger('click')
    await wrapper.get('input[aria-label="Name"]').setValue(input.title)
    await setScheduleCode(wrapper, 'rTime', input.recurrenceCode)
    await wrapper.get('[role="dialog"] button').trigger('click')
    await vi.waitFor(() => expect(create).toHaveBeenCalledWith(input))
    await expect(create.mock.results[0]!.value).resolves.toMatchObject({ ok: true })
    await vi.waitFor(() => expect(feedback.success).toHaveBeenCalledWith('Success'), {
      timeout: 5000
    })

    create.mockResolvedValueOnce({
      ok: false,
      error: {
        code: 'PERSISTENCE_FAILED',
        messageKey: 'error.persistenceFailed',
        message: '保存失败'
      }
    })
    await wrapper.getComponent(ScheduleModal).get('button').trigger('click')
    await wrapper.get('input[aria-label="Name"]').setValue(input.title)
    await setScheduleCode(wrapper, 'rTime', input.recurrenceCode)
    await wrapper.get('[role="dialog"] button').trigger('click')
    await vi.waitFor(() => expect(feedback.error).toHaveBeenCalledWith(
      'Error',
      'Local data could not be saved or loaded.'
    ))
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it('inserts the next weekday into the focused rTime and exTime fields', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-13T04:00:00.000Z'))
    const shortcutManager = createShortcutManager(() => defaultShortcutBindings)
    shortcutManager.start()
    const wrapper = mount(ScheduleModal, {
      props: { settings: defaultSettings },
      global: {
        provide: { [shortcutManagerKey as symbol]: shortcutManager },
        stubs: { teleport: true }
      }
    })

    try {
      await wrapper.get('button').trigger('click')
      const editors = wrapper.findAllComponents(ScheduleCodeEditor)
      ;(editors[0]?.vm as unknown as { focus(): void }).focus()
      window.dispatchEvent(new KeyboardEvent('keydown', { ctrlKey: true, key: '1' }))
      await wrapper.vm.$nextTick()
      expect(wrapper.getComponent(ScheduleCodeEditor).props('modelValue')).toBe('2026/07/20')

      ;(editors[1]?.vm as unknown as { focus(): void }).focus()
      window.dispatchEvent(new KeyboardEvent('keydown', { ctrlKey: true, key: '1' }))
      await wrapper.vm.$nextTick()
      expect(wrapper.findAllComponents(ScheduleCodeEditor)[1]?.props('modelValue')).toBe('2026/07/20')
    } finally {
      wrapper.unmount()
      shortcutManager.stop()
      vi.useRealTimers()
    }
  })

  it('updates the week current-time indicator once per minute and cleans up its timer', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(TEST_NOW))
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval')
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval')
    const wrapper = await mountHome()

    try {
      await flushPromises()
      setIntervalSpy.mockClear()
      clearIntervalSpy.mockClear()
      await wrapper.get('button[data-view="week"]').trigger('click')
      const indicator = wrapper.get('[data-testid="current-time-indicator"]')
      const originalStyle = indicator.attributes('style')
      const timer = setIntervalSpy.mock.results.at(-1)?.value

      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 60_000)
      await vi.advanceTimersByTimeAsync(60_000)
      await wrapper.vm.$nextTick()
      expect(indicator.attributes('style')).not.toBe(originalStyle)

      wrapper.unmount()
      expect(clearIntervalSpy).toHaveBeenCalledWith(timer)
    } finally {
      if (wrapper.exists()) wrapper.unmount()
      setIntervalSpy.mockRestore()
      clearIntervalSpy.mockRestore()
      vi.useRealTimers()
    }
  })

  it('starts the week on the current logical day and rolls over at its boundary', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(TEST_NOW))
    const platform = testGateway()
    await platform.settings.update({ logicalDayStartHour: 6 })
    const wrapper = await mountHome([], createPinia(), platform)

    try {
      await flushPromises()
      await wrapper.get('button[data-view="week"]').trigger('click')
      expect(wrapper.get('.day-card header').text()).toBe('Sun, 7/12')

      await vi.advanceTimersByTimeAsync(2 * 60 * 60 * 1000)
      await wrapper.vm.$nextTick()
      expect(wrapper.get('.day-card header').text()).toBe('Mon, 7/13')
    } finally {
      wrapper.unmount()
      vi.useRealTimers()
    }
  })

  it('marks Name and rTime required and shows field errors before submitting', async () => {
    const wrapper = mount(ScheduleModal, {
      props: { settings: defaultSettings },
      global: { stubs: { teleport: true } }
    })

    await wrapper.get('button').trigger('click')
    await wrapper.get('[role="dialog"] button').trigger('click')
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Please input name')
      expect(wrapper.text()).toContain('Please input rTime')
    })

    expect(wrapper.findAll('.n-form-item-feedback__line')).toHaveLength(2)
    expect(wrapper.findAll('.n-form-item-label__asterisk')).toHaveLength(2)
    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('reuses the modal with initial values for Edit', async () => {
    const initialValue = {
      title: 'Weekly review',
      recurrenceCode: '2026/7/13-17 13:00-14:00 daily;',
      exclusionCode: '',
      comment: 'Every day'
    }
    const wrapper = mount(ScheduleModal, {
      props: { mode: 'edit', initialValue, settings: defaultSettings },
      global: { stubs: { teleport: true } }
    })

    await wrapper.get('button').trigger('click')
    expect(wrapper.text()).toContain('Edit')
    expect(wrapper.get('input[aria-label="Name"]').element).toHaveProperty(
      'value',
      initialValue.title
    )
    expect(wrapper.getComponent(ScheduleCodeEditor).props('modelValue'))
      .toBe(initialValue.recurrenceCode)
    await wrapper.get('input[aria-label="Name"]').setValue('Changed')
    await wrapper.get('[role="dialog"] button').trigger('click')

    await vi.waitFor(() => expect(wrapper.emitted('submit')?.[0]).toEqual([{
        ...initialValue,
        title: 'Changed'
      }]))
  })
})
