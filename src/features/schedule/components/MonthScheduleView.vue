<script setup lang="ts">
import { computed } from 'vue'
import { NCalendar } from 'naive-ui'
import type { ScheduleOccurrenceDto } from '../../../contracts/occurrence.contract'

const props = defineProps<{ items: readonly ScheduleOccurrenceDto[] }>()
const emit = defineEmits<{ select: [id: string] }>()
const indexed = computed(() => {
  const result = new Map<string, ScheduleOccurrenceDto[]>()
  for (const item of props.items) {
    if (item.start === null) continue
    const dateKey = item.start.slice(0, 10)
    const group = result.get(dateKey) ?? []
    group.push(item)
    result.set(dateKey, group)
  }
  return result
})

function timeLabel(item: ScheduleOccurrenceDto): string {
  if (item.start === null) return ''
  const [hour, minute] = item.start.slice(11, 16).split(':')
  return `${item.startMark[0] === '1' ? hour : '?'}:${item.startMark[1] === '1' ? minute : '?'}`
}
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
        :data-occurrence-id="item.id"
        class="schedule-card"
        @click="emit('select', item.scheduleId)"
      >
        <span>{{ item.title }}</span>
        <span>{{ timeLabel(item) }}</span>
      </button>
    </NCalendar>
  </div>
</template>

<style scoped>
.month-view { block-size: calc(100% - 3rem); min-block-size: 70vh; }
.schedule-card { display: flex; justify-content: space-between; inline-size: 100%; padding: 4px; border: 1.5px solid #eee; border-radius: 4px; background: var(--color-surface); color: inherit; cursor: pointer; }
.schedule-card:hover { border-color: #18a058; }
</style>
