<script setup lang="ts">
import type { ScheduleOccurrenceDto } from '../../../contracts/occurrence.contract'
import { NEmpty } from 'naive-ui'
import { computed, reactive } from 'vue'
import { formatWallClock, occurrenceWallTime } from '../occurrence-time'

const props = withDefaults(defineProps<{
  items: readonly ScheduleOccurrenceDto[]
  timeZone: string
  startDate?: string
  dayCount?: number
  startHour?: number
}>(), { startDate: () => new Date().toISOString().slice(0, 10), dayCount: 5, startHour: 0 })
const emit = defineEmits<{ select: [id: string] }>()
const dragStartOffsets = reactive(new Map<string, number>())
const dragOffsets = reactive(new Map<string, number>())
const days = computed(() => Array.from({ length: props.dayCount }, (_, offset) => {
  const date = new Date(`${props.startDate}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + offset)
  return date.toISOString().slice(0, 10)
}))

function occursOn(item: ScheduleOccurrenceDto, day: string): boolean {
  return item.start !== null && occurrenceWallTime(item.start, props.timeZone).date === day
}

function timeLabel(item: ScheduleOccurrenceDto): string {
  if (item.start === null) return ''
  return `${formatWallClock(occurrenceWallTime(item.start, props.timeZone))}–${formatWallClock(occurrenceWallTime(item.end, props.timeZone))}`
}
function eventStyle(item: ScheduleOccurrenceDto) {
  if (item.start === null) return {}
  const start = occurrenceWallTime(item.start, props.timeZone)
  const startMinutes = start.hour * 60 + start.minute - props.startHour * 60
  const duration = Math.max(30, (Date.parse(item.end) - Date.parse(item.start)) / 60_000)
  return {
    insetBlockStart: `calc(3rem + ${(Math.max(0, startMinutes) / 1440) * 100}% + ${dragOffsets.get(item.id) ?? 0}px)`,
    blockSize: `${Math.max(2, (duration / 1440) * 100)}%`
  }
}

function handleDragStart(event: DragEvent, item: ScheduleOccurrenceDto): void {
  dragStartOffsets.set(item.id, event.offsetY)
}

function handleDragEnd(event: DragEvent, item: ScheduleOccurrenceDto): void {
  const startOffset = dragStartOffsets.get(item.id) ?? event.offsetY
  dragOffsets.set(item.id, (dragOffsets.get(item.id) ?? 0) + event.offsetY - startOffset)
  dragStartOffsets.delete(item.id)
}
</script>

<template>
  <div
    data-testid="week-view"
    class="week-view"
  >
    <section
      v-for="day in days"
      :key="day"
      class="day-card"
    >
      <header>{{ day.replaceAll('-', '/') }}</header>
      <button
        v-for="item in items.filter((value) => occursOn(value, day))"
        :key="item.id"
        :data-occurrence-id="item.id"
        class="event-card"
        draggable="true"
        :style="eventStyle(item)"
        @click="emit('select', item.scheduleId)"
        @dragstart="handleDragStart($event, item)"
        @dragend="handleDragEnd($event, item)"
      >
        <span>{{ item.title }}</span>
        <span>{{ timeLabel(item) }}</span>
      </button>
      <NEmpty
        v-if="!items.some((value) => occursOn(value, day))"
        data-testid="no-events"
        class="day-empty"
        description="No Events"
      />
    </section>
  </div>
</template>

<style scoped>
.week-view { display: grid; block-size: calc(100% - 3rem); min-block-size: 70vh; grid-template-columns: repeat(5, minmax(0, 1fr)); }
.day-card { position: relative; border: 1px solid #eee; text-align: center; }
.day-card header { padding: 0.6rem; border-block-end: 1px solid #eee; background: color-mix(in srgb, var(--color-surface) 90%, var(--color-text)); }
.event-card { position: absolute; inset-inline: 0; display: flex; justify-content: space-between; inline-size: 100%; min-block-size: 2rem; padding: 0.5rem; overflow: hidden; border: 0; border-radius: 4px; background: #18a058; color: white; cursor: pointer; }
.day-empty { position: absolute; inset-block-start: 50%; inset-inline: 0; transform: translateY(-50%); }
</style>
