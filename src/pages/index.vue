<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import { NLayout, NLayoutContent, NLayoutSider } from 'naive-ui'
import { useRouter } from 'vue-router'
import { platformGatewayKey } from '../app/injection-keys'
import type { CreateScheduleInput } from '../contracts/schedule.contract'
import ScheduleModal from '../features/schedule/components/ScheduleModal.vue'
import MonthScheduleView from '../features/schedule/components/MonthScheduleView.vue'
import TodoSidebar from '../features/schedule/components/TodoSidebar.vue'
import WeekScheduleView from '../features/schedule/components/WeekScheduleView.vue'
import { useScheduleList } from '../features/schedule/use-schedule-list'
import { useScheduleMutations } from '../features/schedule/use-schedule-mutations'
import { useOccurrenceRange } from '../features/schedule/use-occurrence-range'
import { usePreferencesStore } from '../stores/preferences'

const gateway = inject(platformGatewayKey)
if (!gateway) throw new Error('Platform gateway is not available')
const router = useRouter()
const preferences = usePreferencesStore()
const list = useScheduleList(gateway, { offset: 0, limit: 200 })
const mutations = useScheduleMutations(gateway, list.refresh)
const view = ref(preferences.calendarMode)
const sidebarCollapsed = ref(false)
const todos = computed(() => list.items.value.filter(({ kind }) => kind === 'todo'))
const now = new Date()
const occurrenceStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
occurrenceStart.setUTCDate(occurrenceStart.getUTCDate() - 7)
const occurrenceEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
occurrenceEnd.setUTCDate(occurrenceEnd.getUTCDate() + 7)
const occurrenceRange = useOccurrenceRange(gateway, {
  start: occurrenceStart.toISOString(),
  end: occurrenceEnd.toISOString(),
  limit: 5000
})

function select(id: string) {
  void router.push({ name: 'schedule-detail', params: { id } })
}
async function create(input: CreateScheduleInput) {
  await mutations.createSchedule(input)
}
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
        @select="select"
      />
    </NLayoutSider>
    <NLayoutContent
      class="schedule-workspace"
      bordered
      :native-scrollbar="false"
    >
      <div class="home-toolbar">
        <div class="view-switcher">
          <button
            data-view="month"
            :class="{ active: view === 'month' }"
            @click="view = 'month'"
          >
            month
          </button>
          <button
            data-view="week"
            :class="{ active: view === 'week' }"
            @click="view = 'week'"
          >
            week
          </button>
        </div>
        <ScheduleModal
          :loading="mutations.loading.value"
          @submit="create"
        />
        <button
          class="sync-placeholder"
          disabled
          aria-label="Sync"
        >
          ↻
        </button>
      </div>
      <MonthScheduleView
        v-if="view === 'month'"
        :items="occurrenceRange.items.value"
        @select="select"
      />
      <WeekScheduleView
        v-else
        :items="occurrenceRange.items.value"
        @select="select"
      />
    </NLayoutContent>
  </NLayout>
</template>

<style scoped>
.home-workspace { block-size: 100%; }
.schedule-workspace { padding: 2vh 3vw; overflow: hidden; }
.home-toolbar { display: flex; gap: 1vw; padding-block-end: 1vh; }
.view-switcher { display: flex; }
.view-switcher button, .sync-placeholder { padding: 0.55rem 0.8rem; border: 1px solid var(--color-border); background: var(--color-surface); color: inherit; }
.view-switcher button.active { background: rgb(0 14 28 / 10%); box-shadow: 1px 1px 1px rgb(0 14 28 / 60%) inset; }
</style>
