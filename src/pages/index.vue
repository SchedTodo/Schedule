<script setup lang="ts">
import { computed, inject, onBeforeUnmount, ref, watch } from 'vue'
import { NButton, NButtonGroup, NLayout, NLayoutContent, NLayoutSider } from 'naive-ui'
import { useRouter } from 'vue-router'
import { useOperationFeedback } from '../app/app-feedback'
import { platformGatewayKey } from '../app/injection-keys'
import type { CreateScheduleInput } from '../contracts/schedule.contract'
import type { ScheduleOccurrenceDto } from '../contracts/occurrence.contract'
import { defaultSettings } from '../contracts/settings.contract'
import ScheduleModal from '../features/schedule/components/ScheduleModal.vue'
import MonthScheduleView from '../features/schedule/components/MonthScheduleView.vue'
import TodoSidebar from '../features/schedule/components/TodoSidebar.vue'
import WeekScheduleView from '../features/schedule/components/WeekScheduleView.vue'
import { useScheduleList } from '../features/schedule/use-schedule-list'
import { useScheduleMutations } from '../features/schedule/use-schedule-mutations'
import { useOccurrenceRange } from '../features/schedule/use-occurrence-range'
import { calendarRange } from '../features/schedule/occurrence-time'
import { logicalDateForInstant } from '../features/schedule/week-presentation'
import { useRuntimeStore } from '../stores/runtime'

const gateway = inject(platformGatewayKey)
if (!gateway) throw new Error('Platform gateway is not available')
const platform = gateway
const router = useRouter()
const runtimeStore = useRuntimeStore()
const { showResult } = useOperationFeedback()
const list = useScheduleList(gateway, { offset: 0, limit: 200 }, showResult)
const mutations = useScheduleMutations(
  gateway,
  list.refresh,
  (result) => showResult(result, { success: true })
)
const activeButtonStyle = {
  backgroundColor: 'var(--color-control-pressed-background)',
  boxShadow: 'var(--shadow-control-pressed)'
}
const sidebarCollapsed = ref(false)
const todos = ref<readonly ScheduleOccurrenceDto[]>([])
const displayNow = ref(new Date().toISOString())
const appSettings = ref({ ...defaultSettings })
const occurrenceRange = useOccurrenceRange(
  gateway,
  calendarRange(appSettings.value.timeZone),
  showResult
)
let relativeTimeTimer: ReturnType<typeof setInterval> | undefined

function effectiveTimeMode(id: string) {
  const { timeDisplayMode, timeDisplayOverrides } = runtimeStore.homepage
  if (!timeDisplayOverrides.includes(id)) return timeDisplayMode
  return timeDisplayMode === 'clock' ? 'relative' : 'clock'
}

const hasVisibleRelativeTime = computed(() => [
  ...occurrenceRange.items.value.filter((item) => item.startMark === '11'),
  ...todos.value.filter((item) => item.endMark === '11')
].some((item) => effectiveTimeMode(item.id) === 'relative'))
const needsLiveClock = computed(() =>
  runtimeStore.homepage.priority === 'week' || hasVisibleRelativeTime.value
)
const weekStartDate = computed(() => logicalDateForInstant(
  displayNow.value,
  appSettings.value.timeZone,
  appSettings.value.logicalDayStartHour,
  appSettings.value.logicalDayStartMinute
))

watch(needsLiveClock, (visible) => {
  if (relativeTimeTimer !== undefined) clearInterval(relativeTimeTimer)
  relativeTimeTimer = undefined
  if (!visible) return
  displayNow.value = new Date().toISOString()
  relativeTimeTimer = setInterval(() => {
    displayNow.value = new Date().toISOString()
  }, 60_000)
}, { immediate: true })

onBeforeUnmount(() => {
  if (relativeTimeTimer !== undefined) clearInterval(relativeTimeTimer)
})

function select(id: string) {
  void router.push({ name: 'schedule-detail', params: { id } })
}
async function create(input: CreateScheduleInput) {
  const result = await mutations.createSchedule(input)
  if (result.ok) await refreshTodos()
}
/** 按当前设置加载逻辑日范围内需要展示的 Todo。 */
async function refreshTodos() {
  const settings = await platform.settings.get()
  showResult(settings)
  if (settings.ok) {
    appSettings.value = settings.value
    await occurrenceRange.refresh(calendarRange(settings.value.timeZone))
  }
  const result = await platform.occurrences.listTodos({
    now: new Date().toISOString(),
    timeZone: settings.ok ? settings.value.timeZone : defaultSettings.timeZone,
    logicalDayStartHour: settings.ok ? settings.value.logicalDayStartHour : 0,
    logicalDayStartMinute: settings.ok ? settings.value.logicalDayStartMinute : 0
  })
  if (showResult(result)) todos.value = result.value
}
/** 更新 occurrence 完成状态，并重新加载 Todo 列表。 */
async function setDone(id: string, done: boolean) {
  const result = await platform.occurrences.setDone(id, done)
  if (showResult(result)) await refreshTodos()
}
function concentrate(id: string) {
  void router.push({ name: 'concentrate', params: { timeId: id } })
}
void refreshTodos()
</script>

<template>
  <NLayout
    class="home-workspace"
    has-sider
  >
    <NLayoutSider
      v-model:collapsed="sidebarCollapsed"
      bordered
      collapse-mode="width"
      :collapsed-width="0"
      width="30vw"
      show-trigger="arrow-circle"
      :native-scrollbar="false"
      content-style="height: 100%;"
    >
      <TodoSidebar
        :items="todos"
        :time-zone="appSettings.timeZone"
        :time-display-mode="runtimeStore.homepage.timeDisplayMode"
        :time-display-overrides="runtimeStore.homepage.timeDisplayOverrides"
        :now="displayNow"
        @select="select"
        @done="setDone"
        @concentrate="concentrate"
        @toggle-time="runtimeStore.toggleOccurrenceTime"
      />
    </NLayoutSider>
    <NLayoutContent
      class="schedule-workspace"
      bordered
      :native-scrollbar="false"
    >
      <div class="workspace-content">
        <div class="home-toolbar">
          <NButtonGroup class="segmented-control">
            <NButton
              data-view="month"
              :style="runtimeStore.homepage.priority === 'month' ? activeButtonStyle : undefined"
              @click="runtimeStore.homepage.priority = 'month'"
            >
              month
            </NButton>
            <NButton
              data-view="week"
              :style="runtimeStore.homepage.priority === 'week' ? activeButtonStyle : undefined"
              @click="runtimeStore.homepage.priority = 'week'"
            >
              week
            </NButton>
          </NButtonGroup>
          <NButtonGroup class="segmented-control">
            <NButton
              data-time-mode="clock"
              :style="runtimeStore.homepage.timeDisplayMode === 'clock' ? activeButtonStyle : undefined"
              @click="runtimeStore.setTimeDisplayMode('clock')"
            >
              time
            </NButton>
            <NButton
              data-time-mode="relative"
              :style="runtimeStore.homepage.timeDisplayMode === 'relative' ? activeButtonStyle : undefined"
              @click="runtimeStore.setTimeDisplayMode('relative')"
            >
              relative
            </NButton>
          </NButtonGroup>
          <ScheduleModal
            :loading="mutations.loading.value"
            :time-zone="appSettings.timeZone"
            @submit="create"
          />
        </div>
        <MonthScheduleView
          v-if="runtimeStore.homepage.priority === 'month'"
          :items="occurrenceRange.items.value"
          :time-zone="appSettings.timeZone"
          :time-display-mode="runtimeStore.homepage.timeDisplayMode"
          :time-display-overrides="runtimeStore.homepage.timeDisplayOverrides"
          :now="displayNow"
          @select="select"
          @toggle-time="runtimeStore.toggleOccurrenceTime"
        />
        <WeekScheduleView
          v-else
          :items="occurrenceRange.items.value"
          :time-zone="appSettings.timeZone"
          :start-date="weekStartDate"
          :day-count="appSettings.weekViewDays"
          :start-hour="appSettings.logicalDayStartHour"
          :start-minute="appSettings.logicalDayStartMinute"
          :time-display-mode="runtimeStore.homepage.timeDisplayMode"
          :time-display-overrides="runtimeStore.homepage.timeDisplayOverrides"
          :now="displayNow"
          @select="select"
          @toggle-time="runtimeStore.toggleOccurrenceTime"
        />
      </div>
    </NLayoutContent>
  </NLayout>
</template>

<style scoped>
.home-workspace { block-size: 100%; }
.schedule-workspace { block-size: 100%; overflow: hidden; }
.schedule-workspace :deep(.n-scrollbar-content) { block-size: 100%; }
.workspace-content { display: flex; flex-direction: column; block-size: 100%; padding: 2vh 3vw; overflow: hidden; }
.home-toolbar { display: flex; flex: none; gap: 1vw; padding-block-end: 1vh; }
</style>
