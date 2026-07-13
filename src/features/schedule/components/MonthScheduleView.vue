<script setup lang="ts">
import { computed } from 'vue'
import { NCalendar } from 'naive-ui'
import type { CalendarOccurrenceDto } from '../../../contracts/occurrence.contract'
import { formatMarkedWallClock, occurrenceWallTime } from '../occurrence-time'
import OccurrenceTooltip from './OccurrenceTooltip.vue'

const props = defineProps<{ items: readonly CalendarOccurrenceDto[]; timeZone: string }>()
const emit = defineEmits<{ select: [id: string] }>()
const indexed = computed(() => {
  const result = new Map<string, CalendarOccurrenceDto[]>()
  for (const item of props.items) {
    if (item.start === null) continue
    const dateKey = occurrenceWallTime(item.start, props.timeZone).date
    const group = result.get(dateKey) ?? []
    group.push(item)
    result.set(dateKey, group)
  }
  return result
})

function timeLabel(item: CalendarOccurrenceDto): string {
  if (item.start === null) return ''
  return formatMarkedWallClock(item.start, item.startMark, props.timeZone)
}
</script>

<template>
  <div
    data-testid="month-view"
    class="month-view"
  >
    <NCalendar #="{ year, month, date }">
      <OccurrenceTooltip
        v-for="item in indexed.get(`${year}-${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')}`)"
        :key="item.id"
        :item="item"
        :time-zone="timeZone"
      >
        <button
          :data-occurrence-id="item.id"
          class="schedule-card"
          @click="emit('select', item.scheduleId)"
        >
          <span class="schedule-name">{{ item.title }}</span>
          <span class="schedule-time">{{ timeLabel(item) }}</span>
        </button>
      </OccurrenceTooltip>
    </NCalendar>
  </div>
</template>

<style scoped>
.month-view { flex: 1; block-size: 100%; min-block-size: 0; overflow: hidden; }
.month-view :deep(.n-calendar) { block-size: 100%; }
.schedule-card { display: flex; flex-wrap: nowrap; justify-content: space-between; inline-size: 100%; padding: 4px; overflow: hidden; border: 1.5px solid #eee; border-radius: 4px; box-shadow: 0 0 4px #eee; background: var(--color-surface); color: inherit; cursor: pointer; }
.schedule-name { min-inline-size: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.schedule-time { flex: none; white-space: nowrap; }
.schedule-card:hover { inline-size: auto; border-color: #18a058; background: var(--color-surface); transition: all 0.2s ease-in-out; }
</style>
