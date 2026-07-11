<script setup lang="ts">
import { NAlert, NEmpty, NList, NSpin } from 'naive-ui'

import type { AppErrorDto } from '../../../contracts/result'
import type { ScheduleDto } from '../../../contracts/schedule.contract'
import ScheduleListItem from './ScheduleListItem.vue'

withDefaults(
  defineProps<{
    items: readonly ScheduleDto[]
    loading?: boolean
    error?: AppErrorDto | null
  }>(),
  { loading: false, error: null }
)

const emit = defineEmits<{ select: [id: string] }>()
</script>

<template>
  <NAlert
    v-if="error"
    type="error"
  >
    {{ error.message }}
  </NAlert>
  <NSpin
    v-else-if="loading"
    description="正在加载日程"
  />
  <NEmpty
    v-else-if="items.length === 0"
    description="暂无日程"
  />
  <NList v-else>
    <ScheduleListItem
      v-for="schedule in items"
      :key="schedule.id"
      :schedule="schedule"
      @select="emit('select', $event)"
    />
  </NList>
</template>
