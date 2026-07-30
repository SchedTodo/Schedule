<script setup lang="ts">
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { NButton, NIcon } from 'naive-ui'
import { Minus, Pin } from '@vicons/tabler'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { desktopWidgetKey, platformGatewayKey } from '../app/injection-keys'
import type {
  CalendarOccurrenceDto,
  ScheduleOccurrenceDto
} from '../contracts/occurrence.contract'
import { defaultSettings } from '../contracts/settings.contract'
import { Temporal } from '../domain/shared/temporal'
import WidgetTodoList from '../features/schedule/components/WidgetTodoList.vue'
import WeekScheduleView from '../features/schedule/components/WeekScheduleView.vue'
import {
  currentLogicalDayRange,
  type TimeDisplayMode
} from '../features/schedule/occurrence-time'
import { logicalDateForInstant } from '../features/schedule/week-presentation'
import { widgetFollowScrollTop } from '../features/schedule/widget-follow'

const gateway = inject(platformGatewayKey)
if (!gateway) throw new Error('Platform gateway is not available')
const platform = gateway
const desktop = inject(desktopWidgetKey)
const router = useRouter()
const { t, locale } = useI18n()

const settings = ref({ ...defaultSettings })
const now = ref(new Date().toISOString())
const events = ref<readonly CalendarOccurrenceDto[]>([])
const todos = ref<readonly ScheduleOccurrenceDto[]>([])
const timeDisplayMode = ref<TimeDisplayMode>('clock')
const timeDisplayOverrides = ref<string[]>([])
const alwaysOnTop = ref(false)
const passthrough = ref(false)
const following = ref(true)
const timeline = ref<HTMLElement>()
let timer: ReturnType<typeof setInterval> | undefined
let programmaticScroll = false
let ignored = false
let disposeDataChanged: (() => void) | undefined
type ResizeEdge = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw'
const resizeEdges: readonly ResizeEdge[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']
let resizing: ResizeEdge | undefined

const logicalDate = computed(() => logicalDateForInstant(
  now.value,
  settings.value.timeZone,
  settings.value.logicalDayStartHour,
  settings.value.logicalDayStartMinute
))
const dateLabel = computed(() => new Intl.DateTimeFormat(locale.value, {
  month: 'long',
  day: 'numeric',
  weekday: 'short',
  timeZone: 'UTC'
}).format(new Date(`${logicalDate.value}T00:00:00Z`)))

async function refresh(): Promise<void> {
  const settingsResult = await platform.settings.get()
  if (settingsResult.ok) settings.value = settingsResult.value
  const instant = new Date().toISOString()
  now.value = instant
  const current = settings.value
  const [eventResult, todoResult] = await Promise.all([
    platform.occurrences.listRange(currentLogicalDayRange(
      current.timeZone,
      current.logicalDayStartHour,
      current.logicalDayStartMinute,
      Temporal.Instant.from(instant)
    )),
    platform.occurrences.listTodos({
      now: instant,
      timeZone: current.timeZone,
      logicalDayStartHour: current.logicalDayStartHour,
      logicalDayStartMinute: current.logicalDayStartMinute
    })
  ])
  events.value = eventResult.ok
    ? eventResult.value.filter((item) => item.kind === 'event')
    : []
  todos.value = todoResult.ok ? todoResult.value : []
  await nextTick()
  if (following.value) followNow()
}

function toggleTime(id: string): void {
  timeDisplayOverrides.value = timeDisplayOverrides.value.includes(id)
    ? timeDisplayOverrides.value.filter((value) => value !== id)
    : [...timeDisplayOverrides.value, id]
}

async function setDone(id: string, done: boolean): Promise<void> {
  const result = await platform.occurrences.setDone(id, done)
  if (result.ok) await refresh()
}

function openSchedule(scheduleId: string): void {
  if (desktop) void desktop.openSchedule(scheduleId)
  else void router.push({ name: 'schedule-detail', params: { id: scheduleId } })
}

function followNow(): void {
  const container = timeline.value
  const marker = container?.querySelector<HTMLElement>('[data-testid="current-time-indicator"]')
  if (!container || !marker) return
  following.value = true
  programmaticScroll = true
  container.scrollTop = widgetFollowScrollTop(
    marker.offsetTop,
    container.clientHeight,
    container.scrollHeight
  )
  requestAnimationFrame(() => {
    requestAnimationFrame(() => { programmaticScroll = false })
  })
}

function onTimelineScroll(): void {
  if (!programmaticScroll) following.value = false
}

async function toggleTop(): Promise<void> {
  if (!desktop) return
  alwaysOnTop.value = (await desktop.setAlwaysOnTop(!alwaysOnTop.value)).alwaysOnTop
}

function setPassthrough(value: boolean): void {
  passthrough.value = value
  if (!value) void setIgnored(false)
}

async function setIgnored(value: boolean): Promise<void> {
  if (!desktop || ignored === value) return
  ignored = value
  await desktop.setIgnoreMouseEvents(value)
}

function onPointerMove(event: PointerEvent): void {
  if (!passthrough.value) return
  const target = event.target instanceof Element ? event.target : undefined
  void setIgnored(!target?.closest('[data-widget-interactive]'))
}

function onPointerLeave(): void {
  if (passthrough.value) void setIgnored(true)
}

function hide(): void {
  if (desktop) void desktop.hide()
}

function startResize(event: PointerEvent, edge: ResizeEdge): void {
  if (!desktop || passthrough.value) return
  event.preventDefault()
  resizing = edge
  void desktop.resize({
    edge,
    phase: 'start',
    screenX: event.screenX,
    screenY: event.screenY
  })
}

function moveResize(event: PointerEvent): void {
  if (!desktop || resizing === undefined) return
  void desktop.resize({
    edge: resizing,
    phase: 'move',
    screenX: event.screenX,
    screenY: event.screenY
  })
}

function endResize(event: PointerEvent): void {
  if (!desktop || resizing === undefined) return
  const edge = resizing
  resizing = undefined
  void desktop.resize({
    edge,
    phase: 'end',
    screenX: event.screenX,
    screenY: event.screenY
  })
}

function onFocus(): void {
  following.value = true
  void nextTick(followNow)
}

onMounted(() => {
  if (desktop) {
    void desktop.getState().then((state) => { alwaysOnTop.value = state.alwaysOnTop })
    disposeDataChanged = desktop.onDataChanged(() => { void refresh() })
  }
  void refresh()
  timer = setInterval(() => {
    const previousDate = logicalDate.value
    now.value = new Date().toISOString()
    if (logicalDate.value !== previousDate) {
      following.value = true
      void refresh()
    } else if (following.value) {
      void nextTick(followNow)
    }
  }, 60_000)
  window.addEventListener('focus', onFocus)
  window.addEventListener('pointermove', moveResize)
  window.addEventListener('pointerup', endResize)
})

onBeforeUnmount(() => {
  if (timer !== undefined) clearInterval(timer)
  window.removeEventListener('focus', onFocus)
  window.removeEventListener('pointermove', moveResize)
  window.removeEventListener('pointerup', endResize)
  disposeDataChanged?.()
  void setIgnored(false)
})
</script>

<template>
  <section
    :class="['desktop-widget', { passthrough }]"
    data-testid="desktop-widget"
    @pointermove="onPointerMove"
    @pointerleave="onPointerLeave"
  >
    <header class="widget-titlebar">
      <strong>{{ t('widget.today') }} · {{ dateLabel }}</strong>
      <div
        class="widget-window-actions widget-no-drag"
        data-widget-interactive
      >
        <NButton
          size="small"
          :type="passthrough ? 'primary' : 'default'"
          @click="setPassthrough(!passthrough)"
        >
          {{ t('widget.passthrough') }}
        </NButton>
        <NButton
          size="small"
          :type="alwaysOnTop ? 'primary' : 'default'"
          :aria-label="t('widget.alwaysOnTop')"
          @click="toggleTop"
        >
          <NIcon><Pin /></NIcon>
        </NButton>
        <NButton
          size="small"
          :aria-label="t('widget.hide')"
          @click="hide"
        >
          <NIcon><Minus /></NIcon>
        </NButton>
      </div>
    </header>

    <div class="widget-content">
      <section class="widget-pane widget-todos">
        <h2>{{ t('widget.todayTodo') }} <span>{{ todos.length }}</span></h2>
        <WidgetTodoList
          :items="todos"
          :time-zone="settings.timeZone"
          :now="now"
          :time-display-mode="timeDisplayMode"
          :time-display-overrides="timeDisplayOverrides"
          :interactive="!passthrough"
          @select="openSchedule"
          @done="setDone"
          @toggle-time="toggleTime"
        />
      </section>
      <section class="widget-pane widget-schedule">
        <h2>{{ t('widget.todaySchedule') }}</h2>
        <div
          ref="timeline"
          class="widget-timeline-scroll"
          @scroll.passive="onTimelineScroll"
        >
          <WeekScheduleView
            :items="events"
            :time-zone="settings.timeZone"
            :start-date="logicalDate"
            :day-count="1"
            :start-hour="settings.logicalDayStartHour"
            :start-minute="settings.logicalDayStartMinute"
            :time-display-mode="timeDisplayMode"
            :time-display-overrides="timeDisplayOverrides"
            :now="now"
            :hour-height="56"
            :draggable="false"
            :interactive="!passthrough"
            tooltip-transparent
            @select="openSchedule"
            @toggle-time="toggleTime"
          />
        </div>
        <NButton
          v-if="!following"
          class="back-to-now"
          size="small"
          type="primary"
          @click="followNow"
        >
          {{ t('widget.backToNow') }}
        </NButton>
      </section>
    </div>
    <div
      v-for="edge in resizeEdges"
      :key="edge"
      :class="['resize-handle', `resize-${edge}`]"
      :data-resize-edge="edge"
      @pointerdown="startResize($event, edge)"
    />
  </section>
</template>

<style scoped>
.desktop-widget { position: relative; block-size: calc(100vh - 20px); margin: 10px; overflow: hidden; border: 1px solid color-mix(in srgb, var(--color-border) 38%, transparent); border-radius: 16px; background: color-mix(in srgb, var(--color-surface) 38%, transparent); color: var(--color-text); backdrop-filter: blur(18px) saturate(120%); }
.widget-titlebar { -webkit-app-region: drag; display: grid; grid-template-columns: minmax(130px, 1fr) auto; align-items: center; gap: 10px; block-size: 52px; padding-inline: 12px; border-block-end: 1px solid color-mix(in srgb, var(--color-border) 35%, transparent); background: color-mix(in srgb, var(--color-surface) 28%, transparent); color: var(--color-text); }
.widget-no-drag, .widget-no-drag * { -webkit-app-region: no-drag; }
.widget-window-actions { display: flex; gap: 6px; }
.widget-content { display: grid; grid-template-columns: 36% 64%; block-size: calc(100% - 52px); min-block-size: 0; }
.widget-pane { position: relative; display: grid; grid-template-rows: 42px minmax(0, 1fr); min-block-size: 0; overflow: hidden; }
.widget-pane + .widget-pane { border-inline-start: 1px solid color-mix(in srgb, var(--color-border) 35%, transparent); }
.widget-pane h2 { margin: 0; padding-inline: 12px; border-block-end: 1px solid color-mix(in srgb, var(--color-border) 35%, transparent); background: color-mix(in srgb, var(--color-surface) 18%, transparent); font-size: 0.95rem; font-weight: 600; line-height: 42px; }
.widget-pane h2 span { color: var(--color-primary); font-weight: 400; }
.widget-timeline-scroll { position: relative; min-block-size: 0; overflow-y: auto; }
.widget-timeline-scroll { scrollbar-width: none; }
.widget-timeline-scroll::-webkit-scrollbar { display: none; }
.widget-timeline-scroll :deep(.week-view) { min-inline-size: 0; }
.widget-timeline-scroll :deep(.day-card),
.widget-timeline-scroll :deep(.day-card header) { background: color-mix(in srgb, var(--color-surface) 18%, transparent); }
.back-to-now { position: absolute; z-index: 2000; inset-inline-end: 22px; inset-block-end: 14px; }
.resize-handle { position: absolute; z-index: 5000; -webkit-app-region: no-drag; }
.resize-n, .resize-s { inset-inline: 14px; block-size: 7px; cursor: ns-resize; }
.resize-n { inset-block-start: 10px; }
.resize-s { inset-block-end: 10px; }
.resize-e, .resize-w { inset-block: 14px; inline-size: 7px; cursor: ew-resize; }
.resize-e { inset-inline-end: 10px; }
.resize-w { inset-inline-start: 10px; }
.resize-ne, .resize-se, .resize-sw, .resize-nw { inline-size: 14px; block-size: 14px; }
.resize-ne { inset-block-start: 10px; inset-inline-end: 10px; cursor: nesw-resize; }
.resize-se { inset-block-end: 10px; inset-inline-end: 10px; cursor: nwse-resize; }
.resize-sw { inset-block-end: 10px; inset-inline-start: 10px; cursor: nesw-resize; }
.resize-nw { inset-block-start: 10px; inset-inline-start: 10px; cursor: nwse-resize; }
.desktop-widget.passthrough .widget-titlebar,
.desktop-widget.passthrough .widget-content,
.desktop-widget.passthrough .resize-handle { pointer-events: none; }
.desktop-widget.passthrough .widget-window-actions { pointer-events: auto; }
</style>

<style>
html:has(.desktop-widget),
body:has(.desktop-widget),
#app:has(.desktop-widget),
[data-testid="app-shell"]:has(.desktop-widget) {
  background: transparent !important;
}
</style>
