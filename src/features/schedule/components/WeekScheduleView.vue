<script setup lang="ts">
import type { CalendarOccurrenceDto } from '../../../contracts/occurrence.contract'
import { NEmpty } from 'naive-ui'
import { computed, reactive } from 'vue'
import { formatOccurrenceRange, occurrenceWallTime } from '../occurrence-time'
import { logicalDateForInstant, scheduleColor } from '../week-presentation'
import OccurrenceTooltip from './OccurrenceTooltip.vue'

const props = withDefaults(defineProps<{
  items: readonly CalendarOccurrenceDto[]
  timeZone: string
  startDate?: string
  dayCount?: number
  startHour?: number
  startMinute?: number
}>(), {
  startDate: () => new Date().toISOString().slice(0, 10),
  dayCount: 5,
  startHour: 0,
  startMinute: 0
})
const emit = defineEmits<{ select: [id: string] }>()
const dragStartOffsets = reactive(new Map<string, number>())
const dragOffsets = reactive(new Map<string, number>())
const hovered = reactive(new Set<string>())
const days = computed(() => Array.from({ length: props.dayCount }, (_, offset) => {
  const date = new Date(`${props.startDate}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + offset)
  return date.toISOString().slice(0, 10)
}))

function occursOn(item: CalendarOccurrenceDto, day: string): boolean {
  return item.start !== null && logicalDateForInstant(
    item.start,
    props.timeZone,
    props.startHour,
    props.startMinute
  ) === day
}

function timeLabel(item: CalendarOccurrenceDto): string {
  return formatOccurrenceRange(item, props.timeZone)
}
function eventStyle(item: CalendarOccurrenceDto) {
  if (item.start === null) return {}
  const start = occurrenceWallTime(item.start, props.timeZone)
  const wallMinutes = start.hour * 60 + start.minute
  const logicalStartMinutes = props.startHour * 60 + props.startMinute
  const startMinutes = (wallMinutes - logicalStartMinutes + 1440) % 1440
  const duration = Math.max(30, (Date.parse(item.end) - Date.parse(item.start)) / 60_000)
  const color = scheduleColor(item.scheduleId)
  const isHovered = hovered.has(item.id)
  return {
    insetBlockStart: `calc(3rem + ${(startMinutes / 1440) * 100}% + ${dragOffsets.get(item.id) ?? 0}px)`,
    blockSize: `${Math.max(2, (duration / 1440) * 100)}%`,
    backgroundColor: `${color}${isHovered ? '90' : '65'}`,
    border: `1.5px solid ${color}`,
    ...(isHovered
      ? { zIndex: 999, boxShadow: '5px 5px 10px #eee' }
      : {})
  }
}

function handleDragStart(event: DragEvent, item: CalendarOccurrenceDto): void {
  dragStartOffsets.set(item.id, event.offsetY)
}

function handleDragEnd(event: DragEvent, item: CalendarOccurrenceDto): void {
  const startOffset = dragStartOffsets.get(item.id) ?? event.offsetY
  dragOffsets.set(item.id, (dragOffsets.get(item.id) ?? 0) + event.offsetY - startOffset)
  dragStartOffsets.delete(item.id)
}
</script>

<template>
  <div
    data-testid="week-view"
    class="week-view"
    :style="{ gridTemplateColumns: `repeat(${dayCount}, minmax(0, 1fr))` }"
  >
    <section
      v-for="day in days"
      :key="day"
      class="day-card"
    >
      <header>{{ day.replaceAll('-', '/') }}</header>
      <OccurrenceTooltip
        v-for="item in items.filter((value) => occursOn(value, day))"
        :key="item.id"
        :item="item"
        :time-zone="timeZone"
      >
        <button
          :data-occurrence-id="item.id"
          class="event-card"
          draggable="true"
          :style="eventStyle(item)"
          @click="emit('select', item.scheduleId)"
          @mouseenter="hovered.add(item.id)"
          @mouseleave="hovered.delete(item.id)"
          @dragstart="handleDragStart($event, item)"
          @dragend="handleDragEnd($event, item)"
        >
          <span>{{ item.title }}</span>
          <span>{{ timeLabel(item) }}</span>
        </button>
      </OccurrenceTooltip>
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
.week-view { display: grid; flex: 1; block-size: 100%; min-block-size: 0; }
.day-card { position: relative; overflow: hidden; border: 1px solid #eee; text-align: center; }
.day-card header { padding: 0.6rem; border-block-end: 1px solid #eee; background: color-mix(in srgb, var(--color-surface) 90%, var(--color-text)); }
.event-card { position: absolute; inset-inline: 0; display: flex; justify-content: space-between; inline-size: 100%; min-block-size: 2rem; padding: 0.5rem; overflow: hidden; border-radius: 4px; color: inherit; cursor: pointer; }
.day-empty { position: absolute; inset-block-start: 50%; inset-inline: 0; transform: translateY(-50%); }
</style>
