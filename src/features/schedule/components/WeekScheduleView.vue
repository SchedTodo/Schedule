<script setup lang="ts">
import type { CalendarOccurrenceDto } from '../../../contracts/occurrence.contract'
import { NEmpty } from 'naive-ui'
import { computed, reactive, type CSSProperties } from 'vue'
import {
  formatOccurrenceRange,
  formatRelativeTime,
  type TimeDisplayMode
} from '../occurrence-time'
import {
  scheduleColor,
  type WeekEventSegment,
  weekCurrentTimePosition,
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
  timeDisplayMode?: TimeDisplayMode
  timeDisplayOverrides?: readonly string[]
  now?: string
}>(), {
  startDate: () => new Date().toISOString().slice(0, 10),
  dayCount: 5,
  startHour: 0,
  startMinute: 0,
  timeDisplayMode: 'clock',
  timeDisplayOverrides: () => [],
  now: () => new Date().toISOString()
})
const emit = defineEmits<{
  select: [id: string]
  'toggle-time': [id: string]
}>()
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
const currentTime = computed(() => weekCurrentTimePosition(
  props.now,
  props.timeZone,
  props.startHour,
  props.startMinute
))
const currentTimeText = computed(() => new Intl.DateTimeFormat('en-GB', {
  timeZone: props.timeZone,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23'
}).format(new Date(props.now)))

function timeLabel(item: CalendarOccurrenceDto): string {
  const overridden = props.timeDisplayOverrides.includes(item.id)
  const relative = overridden
    ? props.timeDisplayMode === 'clock'
    : props.timeDisplayMode === 'relative'
  if (relative && item.start !== null && item.startMark === '11') {
    return formatRelativeTime(item.start, props.now, 'event')
  }
  return formatOccurrenceRange(item, props.timeZone)
}

function positionInDay(startMinutes: number, offsetPixels = 0): string {
  return `calc(4.8vh + (100% - 4.8vh) * ${startMinutes / 1440} + ${offsetPixels}px)`
}

function currentTimeLabel(): string {
  return `Current time ${currentTimeText.value}`
}

function currentTimeStyle(): CSSProperties {
  return {
    insetBlockStart: positionInDay(currentTime.value.startMinutes),
    pointerEvents: 'none'
  }
}

/** 根据分段在逻辑日中的时间位置计算周视图卡片布局。 */
function eventStyle(segment: WeekEventSegment) {
  const { item } = segment
  const duration = Math.max(30, segment.durationMinutes)
  const color = scheduleColor(item.scheduleId)
  const isHovered = hovered.has(item.id)
  return {
    insetBlockStart: positionInDay(
      segment.startMinutes,
      dragOffsets.get(item.id) ?? 0
    ),
    blockSize: `max(2%, calc((100% - 4.8vh) * ${duration / 1440}))`,
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
        <div
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
          <button
            type="button"
            class="event-name"
            @click.stop="emit('select', segment.item.scheduleId)"
          >
            {{ segment.item.title }}
          </button>
          <button
            type="button"
            class="event-time"
            :disabled="segment.item.startMark !== '11'"
            :aria-label="`Toggle time display for ${segment.item.title}`"
            @click.stop="emit('toggle-time', segment.item.id)"
          >
            {{ timeLabel(segment.item) }}
          </button>
        </div>
      </OccurrenceTooltip>
      <NEmpty
        v-if="!segments.some((value) => value.logicalDate === day)"
        data-testid="no-events"
        class="day-empty"
        description="No Events"
      />
      <div
        v-if="currentTime.logicalDate === day"
        data-testid="current-time-indicator"
        class="current-time-indicator"
        role="img"
        :aria-label="currentTimeLabel()"
        :style="currentTimeStyle()"
      >
        <span class="current-time-label">{{ currentTimeText }}</span>
      </div>
    </section>
  </div>
</template>

<style scoped>
.week-view { display: grid; flex: 1 1 0; min-block-size: 0; }
.day-card { position: relative; min-block-size: 0; overflow: hidden; border: 1px solid var(--color-border); border-radius: 4px; text-align: center; word-break: break-word; }
.day-card header { block-size: 4.8vh; line-height: 4.8vh; padding: 0; border-block-end: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text); }
.event-card { position: absolute; inset-inline: 0; display: flex; align-items: center; justify-content: space-between; inline-size: 100%; padding-inline: 10px; overflow: hidden; border-radius: 4px; box-sizing: border-box; color: inherit; cursor: pointer; }
.current-time-indicator { --time-label-width: 3.25rem; position: absolute; z-index: 1000; inset-inline: 0; block-size: 1px; }
.current-time-indicator::before { position: absolute; z-index: 1; inset-block-start: 50%; inset-inline-start: calc(var(--time-label-width) + 7px); inline-size: 7px; block-size: 7px; border-radius: 50%; box-shadow: 0 0 0 2px var(--color-surface); background: var(--color-danger); content: ''; transform: translate(-50%, -50%); }
.current-time-indicator::after { position: absolute; inset-block-start: 50%; inset-inline-start: calc(var(--time-label-width) + 7px); inset-inline-end: 0; block-size: 2px; background: var(--color-danger); content: ''; transform: translateY(-50%); }
.current-time-label { position: absolute; z-index: 1; inset-block-start: 50%; inset-inline-start: 2px; min-inline-size: var(--time-label-width); padding: 1px 3px; border: 1px solid var(--color-danger); border-radius: 4px; box-sizing: border-box; background: var(--color-surface); color: var(--color-danger); font-size: 0.6875rem; font-variant-numeric: tabular-nums; font-weight: 600; letter-spacing: 0.02em; line-height: 1.25; text-align: center; transform: translateY(-50%); }
.event-name, .event-time { padding: 0; border: 0; background: transparent; color: inherit; font: inherit; cursor: pointer; }
.event-name { min-inline-size: 50%; overflow: hidden; text-align: start; text-overflow: ellipsis; white-space: nowrap; }
.event-time { min-inline-size: 40px; max-inline-size: 60%; color: var(--color-primary); text-align: end; white-space: nowrap; }
.event-time:disabled { color: inherit; cursor: default; }
.day-empty { position: absolute; inset-block-start: 50%; inset-inline: 0; transform: translateY(-50%); }
</style>
