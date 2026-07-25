<script setup lang="ts">
import { inject, ref } from 'vue'
import { NAlert, NButton, NButtonGroup, NLayout, NLayoutContent, NLayoutSider } from 'naive-ui'
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
import { useRuntimeStore } from '../stores/runtime'

const gateway = inject(platformGatewayKey)
if (!gateway) throw new Error('Platform gateway is not available')
const platform = gateway
const router = useRouter()
const runtimeStore = useRuntimeStore()
const list = useScheduleList(gateway, { offset: 0, limit: 200 })
const mutations = useScheduleMutations(gateway, list.refresh)
const activeButtonStyle = {
  backgroundColor: 'var(--color-control-pressed-background)',
  boxShadow: 'var(--shadow-control-pressed)'
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
/** 按当前设置加载逻辑日范围内需要展示的 Todo。 */
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
/** 更新 occurrence 完成状态，并重新加载 Todo 列表。 */
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
          <ScheduleModal
            :loading="mutations.loading.value"
            :time-zone="appSettings.timeZone"
            @submit="create"
          />
        </div>
        <NAlert
          v-if="mutations.error.value"
          type="error"
          role="alert"
        >
          {{ mutations.error.value.message }}
        </NAlert>
        <MonthScheduleView
          v-if="runtimeStore.homepage.priority === 'month'"
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
