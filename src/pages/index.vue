<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import { NInput, NSelect } from 'naive-ui'
import { useRouter } from 'vue-router'

import { platformGatewayKey } from '../app/injection-keys'
import type { CreateScheduleInput, ScheduleKind } from '../contracts/schedule.contract'
import ScheduleComposer from '../features/schedule/components/ScheduleComposer.vue'
import ScheduleList from '../features/schedule/components/ScheduleList.vue'
import { useScheduleList } from '../features/schedule/use-schedule-list'
import { useScheduleMutations } from '../features/schedule/use-schedule-mutations'

const gateway = inject(platformGatewayKey)
if (!gateway) throw new Error('Platform gateway is not available')

const router = useRouter()
const list = useScheduleList(gateway, { offset: 0, limit: 50 })
const mutations = useScheduleMutations(gateway, list.refresh)
const search = ref('')
const kind = ref<ScheduleKind | null>(null)
const kindOptions = [
  { label: '全部类型', value: '' },
  { label: '事件', value: 'event' },
  { label: '待办', value: 'todo' }
]

const visibleItems = computed(() => {
  const keyword = search.value.trim().toLocaleLowerCase()
  return list.items.value.filter((schedule) => {
    if (kind.value && schedule.kind !== kind.value) return false
    return keyword === '' || schedule.title.toLocaleLowerCase().includes(keyword)
  })
})

async function createSchedule(input: CreateScheduleInput) {
  await mutations.createSchedule(input)
}
</script>

<template>
  <section class="home-page">
    <header class="page-header">
      <div>
        <p class="eyebrow">Schedule v2</p>
        <h1>今日日程</h1>
      </div>
      <RouterLink to="/settings">设置</RouterLink>
    </header>

    <div class="schedule-layout">
      <section class="schedule-panel" aria-labelledby="schedule-list-title">
        <h2 id="schedule-list-title">日程列表</h2>
        <div class="filters" aria-label="筛选日程">
          <NInput v-model:value="search" aria-label="搜索日程" clearable />
          <NSelect
            :value="kind ?? ''"
            :options="kindOptions"
            aria-label="日程类型"
            @update:value="kind = $event || null"
          />
        </div>
        <ScheduleList
          :items="visibleItems"
          :loading="list.loading.value"
          :error="list.error.value"
          @select="router.push({ name: 'schedule-detail', params: { id: $event } })"
        />
      </section>

      <ScheduleComposer
        :loading="mutations.loading.value"
        :error="mutations.error.value"
        @submit="createSchedule"
      />
    </div>
  </section>
</template>

<style scoped>
.home-page {
  max-inline-size: 72rem;
  min-block-size: 100vh;
  padding: 1.5rem;
  margin-inline: auto;
}

.page-header,
.filters,
.schedule-layout {
  display: flex;
  gap: 1rem;
}

.page-header {
  align-items: center;
  justify-content: space-between;
}

.eyebrow,
h1,
h2 {
  margin: 0;
}

.schedule-layout {
  align-items: start;
  margin-block-start: 2rem;
}

.schedule-panel {
  display: grid;
  flex: 1;
  gap: 1rem;
}

.schedule-composer {
  flex: 0 1 24rem;
}

.filters > * {
  flex: 1;
}

@media (max-width: 700px) {
  .schedule-layout,
  .filters {
    flex-direction: column;
  }
}
</style>
