<script setup lang="ts">
import { computed } from 'vue'
import { NCalendar } from 'naive-ui'
import type { CalendarOccurrenceDto } from '../../../contracts/occurrence.contract'
import {
  formatMarkedWallClock,
  formatRelativeTime,
  occurrenceWallTime,
  type TimeDisplayMode
} from '../occurrence-time'
import OccurrenceTooltip from './OccurrenceTooltip.vue'

const props = withDefaults(defineProps<{
  items: readonly CalendarOccurrenceDto[]
  timeZone: string
  timeDisplayMode?: TimeDisplayMode
  timeDisplayOverrides?: readonly string[]
  now?: string
}>(), {
  timeDisplayMode: 'clock',
  timeDisplayOverrides: () => [],
  now: () => new Date().toISOString()
})
const emit = defineEmits<{
  select: [id: string]
  'toggle-time': [id: string]
}>()
/** 按指定时区的本地日期索引 occurrence，供月历单元格直接查询。 */
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
  const overridden = props.timeDisplayOverrides.includes(item.id)
  const relative = overridden
    ? props.timeDisplayMode === 'clock'
    : props.timeDisplayMode === 'relative'
  if (relative && item.startMark === '11') {
    return formatRelativeTime(item.start, props.now, 'event')
  }
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
        <div
          :data-occurrence-id="item.id"
          class="schedule-card"
          @click="emit('select', item.scheduleId)"
        >
          <button
            type="button"
            class="schedule-name"
            @click.stop="emit('select', item.scheduleId)"
          >
            {{ item.title }}
          </button>
          <button
            type="button"
            class="schedule-time"
            :disabled="item.startMark !== '11'"
            :aria-label="`Toggle time display for ${item.title}`"
            @click.stop="emit('toggle-time', item.id)"
          >
            {{ timeLabel(item) }}
          </button>
        </div>
      </OccurrenceTooltip>
    </NCalendar>
  </div>
</template>

<style scoped>
.month-view { flex: 1; block-size: 100%; min-block-size: 0; overflow: hidden; }
.month-view :deep(.n-calendar) { block-size: 100%; }
.schedule-card { display: flex; flex-wrap: nowrap; justify-content: space-between; inline-size: 100%; padding: 4px; overflow: hidden; border: 1.5px solid #eee; border-radius: 4px; box-shadow: 0 0 4px #eee; background: var(--color-surface); color: inherit; cursor: pointer; }
.schedule-name, .schedule-time { padding: 0; border: 0; background: transparent; color: inherit; font: inherit; cursor: pointer; }
.schedule-name { min-inline-size: 0; overflow: hidden; text-align: start; text-overflow: ellipsis; white-space: nowrap; }
.schedule-time { flex: none; color: var(--color-primary); white-space: nowrap; }
.schedule-time:disabled { color: inherit; cursor: default; }
.schedule-card:hover { border-color: #18a058; background: var(--color-surface); transition: border-color 0.2s ease-in-out; }
</style>
