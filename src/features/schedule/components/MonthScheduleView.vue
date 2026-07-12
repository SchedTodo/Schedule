<script setup lang="ts">
import { computed } from 'vue'
import { NCalendar } from 'naive-ui'
import type { ScheduleDto } from '../../../contracts/schedule.contract'
import { parseFirstScheduleDate } from '../recurrence-presentation'

const props = defineProps<{ items: readonly ScheduleDto[] }>()
const emit = defineEmits<{ select: [id: string] }>()
const indexed = computed(() => {
  const result = new Map<string, ScheduleDto[]>()
  for (const item of props.items) {
    const parsed = parseFirstScheduleDate(item.recurrenceCode)
    if (!parsed) continue
    const group = result.get(parsed.dateKey) ?? []
    group.push(item)
    result.set(parsed.dateKey, group)
  }
  return result
})
</script>

<template>
  <div
    data-testid="month-view"
    class="month-view"
  >
    <NCalendar #="{ year, month, date }">
      <button
        v-for="item in indexed.get(`${year}-${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')}`)"
        :key="item.id"
        class="schedule-card"
        @click="emit('select', item.id)"
      >
        <span>{{ item.title }}</span>
        <span>{{ parseFirstScheduleDate(item.recurrenceCode)?.timeLabel }}</span>
      </button>
    </NCalendar>
  </div>
</template>

<style scoped>
.month-view { block-size: calc(100% - 3rem); min-block-size: 70vh; }
.schedule-card { display: flex; justify-content: space-between; inline-size: 100%; padding: 4px; border: 1.5px solid #eee; border-radius: 4px; background: var(--color-surface); color: inherit; cursor: pointer; }
.schedule-card:hover { border-color: #18a058; }
</style>
