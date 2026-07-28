<script setup lang="ts">
import { NListItem, NTag } from 'naive-ui'

import type { ScheduleDto } from '../../../contracts/schedule.contract'
import { useI18n } from 'vue-i18n'

defineProps<{ schedule: ScheduleDto }>()
const emit = defineEmits<{ select: [id: string] }>()
const { t } = useI18n()
</script>

<template>
  <NListItem>
    <button
      class="schedule-row"
      type="button"
      :data-schedule-id="schedule.id"
      @click="emit('select', schedule.id)"
    >
      <span class="schedule-title">{{ schedule.title }}</span>
      <NTag
        size="small"
        :type="schedule.kind === 'event' ? 'info' : 'success'"
      >
        {{ schedule.kind === 'event' ? t('common.event') : t('common.todo') }}
      </NTag>
      <span
        v-if="schedule.recurrenceCode"
        class="schedule-recurrence"
      >
        {{ schedule.recurrenceCode }}
      </span>
    </button>
  </NListItem>
</template>

<style scoped>
.schedule-row {
  display: grid;
  inline-size: 100%;
  padding: 0.75rem;
  border: 0;
  border-radius: 0.5rem;
  background: transparent;
  color: inherit;
  cursor: pointer;
  gap: 0.375rem 0.75rem;
  grid-template-columns: 1fr auto;
  text-align: start;
}

.schedule-row:hover,
.schedule-row:focus-visible {
  background: color-mix(in srgb, currentColor 8%, transparent);
}

.schedule-title {
  font-weight: 600;
}

.schedule-recurrence {
  grid-column: 1 / -1;
  opacity: 0.7;
}
</style>
