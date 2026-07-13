<script setup lang="ts">
import { inject, ref } from 'vue'
import { NButton, NButtonGroup, NLayout, NLayoutContent, NLayoutSider } from 'naive-ui'
import { useRouter } from 'vue-router'
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
import { calendarRange, todayInTimeZone } from '../features/schedule/occurrence-time'
import { usePreferencesStore } from '../stores/preferences'

const gateway = inject(platformGatewayKey)
if (!gateway) throw new Error('Platform gateway is not available')
const platform = gateway
const router = useRouter()
const preferences = usePreferencesStore()
const list = useScheduleList(gateway, { offset: 0, limit: 200 })
const mutations = useScheduleMutations(gateway, list.refresh)
const view = ref(preferences.calendarMode)
const activeButtonStyle = {
  backgroundColor: 'rgba(0, 14, 28, 0.1)',
  boxShadow: '1px 1px 1px 1px rgba(0, 14, 28, 0.6) inset'
}
const sidebarCollapsed = ref(false)
const todos = ref<readonly ScheduleOccurrenceDto[]>([])
const appSettings = ref({ ...defaultSettings })
const occurrenceRange = useOccurrenceRange(gateway, calendarRange(appSettings.value.timeZone))

function select(id: string) {
  void router.push({ name: 'schedule-detail', params: { id } })
}
async function create(input: CreateScheduleInput) {
  await mutations.createSchedule(input)
  await refreshTodos()
}
async function refreshTodos() {
  const settings = await platform.settings.get()
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
  if (result.ok) todos.value = result.value
}
async function setDone(id: string, done: boolean) {
  await platform.occurrences.setDone(id, done)
  await refreshTodos()
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
        @select="select"
        @done="setDone"
        @concentrate="concentrate"
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
              :style="view === 'month' ? activeButtonStyle : undefined"
              @click="view = 'month'"
            >
              month
            </NButton>
            <NButton
              data-view="week"
              :style="view === 'week' ? activeButtonStyle : undefined"
              @click="view = 'week'"
            >
              week
            </NButton>
          </NButtonGroup>
          <ScheduleModal
            :loading="mutations.loading.value"
            @submit="create"
          />
        </div>
        <MonthScheduleView
          v-if="view === 'month'"
          :items="occurrenceRange.items.value"
          :time-zone="appSettings.timeZone"
          @select="select"
        />
        <WeekScheduleView
          v-else
          :items="occurrenceRange.items.value"
          :time-zone="appSettings.timeZone"
          :start-date="todayInTimeZone(appSettings.timeZone)"
          :day-count="appSettings.weekViewDays"
          :start-hour="appSettings.logicalDayStartHour"
          :start-minute="appSettings.logicalDayStartMinute"
          @select="select"
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
