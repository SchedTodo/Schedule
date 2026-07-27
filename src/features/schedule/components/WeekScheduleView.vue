<script setup lang="ts">
import type { CalendarOccurrenceDto } from '../../../contracts/occurrence.contract'
import { NEmpty } from 'naive-ui'
import { computed, reactive } from 'vue'
import { formatOccurrenceRange } from '../occurrence-time'
import {
  scheduleColor,
  type WeekEventSegment,
  weekSegmentsForOccurrence
} from '../week-presentation'
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
const segments = computed(() => props.items.flatMap((item) =>
  weekSegmentsForOccurrence(
    item,
    props.timeZone,
    props.startHour,
    props.startMinute
  )
))

function timeLabel(item: CalendarOccurrenceDto): string {
  return formatOccurrenceRange(item, props.timeZone)
}
/** 根据分段在逻辑日中的时间位置计算周视图卡片布局。 */
function eventStyle(segment: WeekEventSegment) {
  const { item } = segment
  const duration = Math.max(30, segment.durationMinutes)
  const color = scheduleColor(item.scheduleId)
  const isHovered = hovered.has(item.id)
  return {
    insetBlockStart: `calc(4.8vh + ${(segment.startMinutes / 1440) * 100}% + ${dragOffsets.get(item.id) ?? 0}px)`,
    blockSize: `${Math.max(2, (duration / 1440) * 100)}%`,
    backgroundColor: `${color}${isHovered ? '90' : '65'}`,
    border: `1.5px solid ${color}`,
    ...(isHovered
      ? { zIndex: 999, boxShadow: '5px 5px 10px #eee' }
      : {})
  }
}

/** 记录拖拽起点，使卡片拖动时只改变视觉偏移。 */
function handleDragStart(event: DragEvent, item: CalendarOccurrenceDto): void {
  dragStartOffsets.set(item.id, event.offsetY)
}

/** 清除拖拽视觉偏移；当前交互不会修改 occurrence 时间。 */
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
        v-for="segment in segments.filter((value) => value.logicalDate === day)"
        :key="segment.key"
        :item="segment.item"
        :time-zone="timeZone"
      >
        <button
          :data-occurrence-id="segment.item.id"
          :data-segment-date="segment.logicalDate"
          class="event-card"
          draggable="true"
          :style="eventStyle(segment)"
          @click="emit('select', segment.item.scheduleId)"
          @mouseenter="hovered.add(segment.item.id)"
          @mouseleave="hovered.delete(segment.item.id)"
          @dragstart="handleDragStart($event, segment.item)"
          @dragend="handleDragEnd($event, segment.item)"
        >
          <span>{{ segment.item.title }}</span>
          <span>{{ timeLabel(segment.item) }}</span>
        </button>
      </OccurrenceTooltip>
      <NEmpty
        v-if="!segments.some((value) => value.logicalDate === day)"
        data-testid="no-events"
        class="day-empty"
        description="No Events"
      />
    </section>
  </div>
</template>

<style scoped>
.week-view { display: grid; flex: 1 1 0; min-block-size: 0; }
.day-card { position: relative; min-block-size: 0; overflow: hidden; border: 1px solid var(--color-border); border-radius: 4px; text-align: center; word-break: break-word; }
.day-card header { block-size: 4.8vh; line-height: 4.8vh; padding: 0; border-block-end: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text); }
.event-card { position: absolute; inset-inline: 0; display: flex; align-items: center; justify-content: space-between; inline-size: 100%; padding-inline: 10px; overflow: hidden; border-radius: 4px; box-sizing: border-box; color: inherit; cursor: pointer; }
.event-card span:first-child { min-inline-size: 50%; overflow: hidden; text-align: start; text-overflow: ellipsis; white-space: nowrap; }
.event-card span:last-child { min-inline-size: 40px; max-inline-size: 50%; text-align: end; white-space: nowrap; }
.day-empty { position: absolute; inset-block-start: 50%; inset-inline: 0; transform: translateY(-50%); }
</style>
