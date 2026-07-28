<script setup lang="ts">
import { computed, inject, onBeforeUnmount, ref } from 'vue'
import { NButton, NCard, NPageHeader, NProgress, NSelect } from 'naive-ui'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

import { useOperationFeedback } from '../../app/app-feedback'
import { platformGatewayKey } from '../../app/injection-keys'
import type { ScheduleOccurrenceDto } from '../../contracts/occurrence.contract'
import { defaultSettings } from '../../contracts/settings.contract'
import type { FocusCycleSnapshot } from '../../features/concentrate/focus-cycle'
import { FocusSession } from '../../features/concentrate/focus-session'

const gateway = inject(platformGatewayKey)
if (!gateway) throw new Error('Platform gateway is not available')
const platform = gateway
const { showResult } = useOperationFeedback()
const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const routeId = Array.isArray(route.params.timeId) ? route.params.timeId[0] : route.params.timeId
const todos = ref<readonly ScheduleOccurrenceDto[]>([])
const selectedId = ref(routeId ?? '')
const snapshot = ref<FocusCycleSnapshot>()
let session: FocusSession | undefined
let timer: ReturnType<typeof setInterval> | undefined
let unmounted = false

const selected = computed(() => todos.value.find(({ id }) => id === selectedId.value))
const stageLabel = computed(() => {
  const state = snapshot.value
  if (!state) return ''
  if (state.stage === 'focus') return t('focus.focusCount', { current: state.focusNumber })
  return state.stage === 'smallBreak' ? t('focus.smallBreak') : t('focus.bigBreak')
})
const buttonLabel = computed(() => {
  if (snapshot.value?.running) return t('focus.pause')
  return (snapshot.value?.cumulativeFocusMs ?? 0) === 0
    ? t('focus.start')
    : t('focus.resume')
})

function formatCountdown(milliseconds: number) {
  const seconds = Math.ceil(milliseconds / 1000)
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

function formatTotal(milliseconds: number) {
  const seconds = Math.floor(milliseconds / 1000)
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

/** 推进专注会话并同步页面快照。 */
function refresh() {
  session?.tick()
  snapshot.value = session?.snapshot()
}

/** 在运行和暂停状态之间切换当前专注会话。 */
function toggle() {
  if (!session) return
  if (session.snapshot().running) session.pause()
  else session.start()
  refresh()
}

/** 切换关联 Todo，并先结算前一个 Todo 的有效专注区间。 */
async function selectTodo(value: string | number | null) {
  const id = value === null ? '' : String(value)
  const todo = todos.value.find((candidate) => candidate.id === id)
  await session?.selectTodo(todo && { scheduleId: todo.scheduleId })
  selectedId.value = id
  refresh()
}

/** 加载可选 Todo，并按路由参数恢复初始选择。 */
async function load() {
  const settingsResult = await platform.settings.get()
  showResult(settingsResult)
  const values = settingsResult.ok ? settingsResult.value : defaultSettings
  const todoResult = await platform.occurrences.listTodos({
    now: new Date().toISOString(),
    timeZone: values.timeZone,
    logicalDayStartHour: values.logicalDayStartHour,
    logicalDayStartMinute: values.logicalDayStartMinute
  })
  if (unmounted) return
  if (showResult(todoResult)) todos.value = todoResult.value
  session = new FocusSession({
    focusMs: values.focusMinutes * 60_000,
    smallBreakMs: values.smallBreakMinutes * 60_000,
    bigBreakMs: values.bigBreakMinutes * 60_000
  }, {
    locale: values.locale,
    now: () => Date.now(),
    notify: (input) => platform.notifications.show(input),
    saveRecord: async (input) => {
      const result = await platform.records.create(input)
      showResult(result)
      return result
    }
  })
  await session.selectTodo(selected.value && { scheduleId: selected.value.scheduleId })
  snapshot.value = session.snapshot()
  timer = setInterval(refresh, 1000)
}

onBeforeUnmount(() => {
  unmounted = true
  if (timer !== undefined) clearInterval(timer)
  void session?.dispose()
})
void load()
</script>

<template>
  <div class="concentrate-page">
    <NPageHeader
      :title="t('focus.concentrate')"
      :show-breadcrumb="false"
      @back="router.back()"
    />
    <NCard>
      <NSelect
        :value="selectedId"
        :options="todos.map((todo) => ({ label: todo.title, value: todo.id }))"
        @update:value="selectTodo"
      />
      <p class="stage-label">
        {{ stageLabel }}
      </p>
      <NProgress
        type="circle"
        :percentage="snapshot?.progressPercent ?? 0"
      >
        {{ formatCountdown(snapshot?.remainingMs ?? 0) }}
      </NProgress>
      <p class="focused-total">
        {{ t('focus.focused') }} {{ formatTotal(snapshot?.cumulativeFocusMs ?? 0) }}
      </p>
      <NButton
        data-testid="focus-toggle"
        @click="toggle"
      >
        {{ buttonLabel }}
      </NButton>
    </NCard>
  </div>
</template>

<style scoped>
.concentrate-page { min-block-size: 100%; padding: 6vh 8vw; background: #001428; color: white; }
.n-card { max-inline-size: 32rem; margin: 12vh auto 0; text-align: center; }
.n-progress { margin: 2rem; }
.stage-label { margin-block: 2rem 0; font-size: 1.5rem; font-weight: 600; }
.focused-total { margin-block: 0 1.5rem; font-variant-numeric: tabular-nums; }
</style>
