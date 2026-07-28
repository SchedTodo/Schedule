<script setup lang="ts">
import { NAlert, NEmpty, NList, NSpin } from 'naive-ui'

import type { AppErrorDto } from '../../../contracts/result'
import type { ScheduleDto } from '../../../contracts/schedule.contract'
import ScheduleListItem from './ScheduleListItem.vue'
import { useI18n } from 'vue-i18n'

withDefaults(
  defineProps<{
    items: readonly ScheduleDto[]
    loading?: boolean
    error?: AppErrorDto | null
  }>(),
  { loading: false, error: null }
)

const emit = defineEmits<{ select: [id: string] }>()
const { t, te } = useI18n()
</script>

<template>
  <NAlert
    v-if="error"
    type="error"
  >
    {{ te(error.messageKey) ? t(error.messageKey) : error.message }}
  </NAlert>
  <NSpin
    v-else-if="loading"
    :description="t('schedule.loading')"
  />
  <NEmpty
    v-else-if="items.length === 0"
    :description="t('schedule.noSchedules')"
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
