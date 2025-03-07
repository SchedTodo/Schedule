<template>
  <div class="container">
    <div v-for="i in props.days" class="day-card">
      <div class="title">
        {{
          DateTime.now()
            .plus({ day: i - 1 })
            .setZone(settingsStore.getValue('rrule.timeZone'))
            .toFormat('yyyy/M/d')
        }}
      </div>
      <template v-if="getEventBriefsByOffset(i)">
        <n-tooltip
          v-for="event in getEventBriefsByOffset(i)"
          trigger="hover"
          :show="stateMap.get(event.id)?.isHover && stateMap.get(event.id)?.isDrag == false"
          @mouseover="handleMouseOver(event)"
          @mouseleave="handleMouseLeave(event)"
        >
          <template #trigger>
            <div
              :style="stateMap.get(event.id)?.styleObject"
              class="event-card"
              draggable="true"
              @click="handleClick(event)"
              @mouseover="handleMouseOver(event)"
              @mouseleave="handleMouseLeave(event)"
              @dragstart="handleDragStart($event, event)"
              @dragend="handleDragEnd($event, event)"
            >
              <div class="name">{{ event.name }}</div>
              <div class="time">
                {{
                  parseTimeWithUnknown(
                    event.start,
                    event.startMark,
                    settingsStore.getValue('rrule.timeZone')
                  )
                }}
                -
                {{
                  parseTimeWithUnknown(
                    event.end,
                    event.endMark,
                    settingsStore.getValue('rrule.timeZone')
                  )
                }}
              </div>
            </div>
          </template>
          <template #header> {{ event.name }} </template>
          {{
            DateTime.now()
              .plus({ day: i - 1 })
              .setZone(settingsStore.getValue('rrule.timeZone'))
              .toFormat('M/d')
          }}
          {{
            parseTimeWithUnknown(
              event.start,
              event.startMark,
              settingsStore.getValue('rrule.timeZone')
            )
          }}
          -
          {{
            parseTimeWithUnknown(event.end, event.endMark, settingsStore.getValue('rrule.timeZone'))
          }}
          <template #footer>
            <div class="comment" style="white-space: pre-line">
              {{ event.comment }}
            </div>
          </template>
        </n-tooltip>
      </template>
      <template v-else>
        <n-empty size="large" description="No Events" show-description style="padding-top: 140%">
        </n-empty>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, computed, onBeforeUnmount, StyleValue } from 'vue'
import { useRouter } from 'vue-router'
import { useEventBusStore, Event, useSettingsStore } from '@renderer/store'
import { NEmpty, NTooltip, useNotification } from 'naive-ui'
import { DateTime } from 'luxon'
import { EventBriefVO } from '@utils/vo'
import { toPx } from '@renderer/utils/css'
import { useDebounce } from '@renderer/utils/utils'
import { parseTimeWithUnknown, getStartAndDuration } from '../../../utils/unknownTime'
import { apiHandler } from '@renderer/apis/scheduleController'

type Props = {
  days?: number
  startTime?: {
    hour: number
    minute: number
  }
}

const props = withDefaults(defineProps<Props>(), {
  days: 5,
  startTime: () => ({ hour: 0, minute: 0 })
})

const router = useRouter()
const eventBusStore = useEventBusStore()
const settingsStore = useSettingsStore()
const notification = useNotification()

type State = {
  isHover: boolean
  isDrag: boolean
  mouseOffsetY: number
  dragOffsetY: number
  styleObject: StyleValue
}
const stateMap = reactive(new Map<string, State>()) // timeId -> State

const eventBriefIndexed = reactive(new Map<string, EventBriefVO[]>())
const getData = async (start: string | null, end: string | null) => {
  // ISO string
  if (!start || !end) {
    notification.error({
      title: 'Error',
      content: `Invalid time range: ${start} - ${end}`
    })
    return
  }

  const eventBriefs: EventBriefVO[] = await apiHandler({
    group: 'schedule',
    name: 'findEventsBetween',
    params: { start, end },
    notification: {
      composable: notification,
      successNotification: false,
      failureNotification: true
    }
  })
  for (const eventBrief of eventBriefs) {
    let start = DateTime.fromISO(eventBrief.start!).setZone(
      settingsStore.getValue('rrule.timeZone')
    )
    // start 在 startTime 之前，显示在前一天
    if (
      start.hour < settingsStore.getValue('preferences.startTime.hour') ||
      (start.hour === settingsStore.getValue('preferences.startTime.hour') &&
        start.minute < settingsStore.getValue('preferences.startTime.minute'))
    ) {
      start = start.minus({ day: 1 })
    }
    const key = start.toFormat('yyyy/M/d')
    if (!eventBriefIndexed.has(key)) {
      eventBriefIndexed.set(key, [])
    }
    eventBriefIndexed.get(key)!.push(eventBrief) // 一定不会是 undefined
    // 初始化
    if (!stateMap.has(eventBrief.id)) {
      stateMap.set(eventBrief.id, {
        isHover: false,
        isDrag: false,
        mouseOffsetY: 0,
        dragOffsetY: 0,
        styleObject: {}
      })
      stateMap.get(eventBrief.id)!.styleObject = getEventStyle(eventBrief) // 一定不会是 undefined
    }
  }
}

const handleDataUpdate = () => {
  let days = props.days
  // 如果 startTime 不是 0:0，这里要加 1 天
  if (
    settingsStore.getValue('preferences.startTime.hour') > 0 ||
    settingsStore.getValue('preferences.startTime.minute') > 0
  ) {
    days += 1
  }
  getData(
    DateTime.now().setZone(settingsStore.getValue('rrule.timeZone')).startOf('day').toISO(),
    DateTime.now()
      .plus({ day: days })
      .setZone(settingsStore.getValue('rrule.timeZone'))
      .endOf('day')
      .toISO()
  )
}
eventBusStore.subscribe(Event.DataUpdated, handleDataUpdate)
eventBusStore.subscribe(Event.TimeZoneUpdated, handleDataUpdate)
handleDataUpdate()

onBeforeUnmount(() => {
  eventBusStore.unsubscribe(Event.DataUpdated, handleDataUpdate)
  eventBusStore.unsubscribe(Event.TimeZoneUpdated, handleDataUpdate)
})

const getEventBriefsByOffset = computed(() => {
  return (offset: number) => {
    return eventBriefIndexed.get(
      DateTime.now()
        .plus({ day: offset - 1 })
        .setZone(settingsStore.getValue('rrule.timeZone'))
        .toFormat('yyyy/M/d')
    )
  }
})

const colors = [
  '#f56c6c',
  '#e6a23c',
  '#409eff',
  '#67c23a',
  '#909399',
  '#FFC0CB',
  '#E6E6FA',
  '#00BFFF',
  '#FF7F50',
  '#98FB98',
  '#87CEEB',
  '#FFFF00',
  '#800080',
  '#FFB6C1',
  '#808000'
]
const colorMap = new Map<string, number>() // scheduleId -> colorIndex

const handleMouseOver = (event: EventBriefVO) => {
  if (stateMap.has(event.id)) {
    // @ts-ignore
    stateMap.get(event.id).isHover = true // 一定不会是 undefined
    // @ts-ignore
    stateMap.get(event.id).styleObject = getEventStyle(event) // 一定不会是 undefined
  }
}

const handleMouseLeave = (event: EventBriefVO) => {
  if (stateMap.has(event.id)) {
    // @ts-ignore
    stateMap.get(event.id).isHover = false // 一定不会是 undefined
    // @ts-ignore
    stateMap.get(event.id).styleObject = getEventStyle(event) // 一定不会是 undefined
  }
}

const titleHeight = '4.8vh'
const dayCardContainerHeight = '81vh'

const getEventStyle = (event: EventBriefVO) => {
  const minutePerDay = 1440
  const dayCardHeight = toPx(dayCardContainerHeight) - toPx(titleHeight)
  const pxPerMinute = dayCardHeight / minutePerDay
  const start = DateTime.fromISO(event.start!).setZone(settingsStore.getValue('rrule.timeZone')) // 一定不会是 null
  const end = DateTime.fromISO(event.end).setZone(settingsStore.getValue('rrule.timeZone'))
  const { start: _start, duration } = getStartAndDuration(
    start,
    event.startMark,
    end,
    event.endMark
  )
  const top =
    ((_start.diff(_start.startOf('day').set(props.startTime), 'minutes').minutes + minutePerDay) %
      minutePerDay) *
      pxPerMinute +
    toPx(titleHeight)
  const height = duration * pxPerMinute
  let colorIndex = 0
  if (colorMap.has(event.scheduleId)) {
    colorIndex = colorMap.get(event.scheduleId)! // 一定不会是 undefined
  } else {
    colorIndex = Math.floor(Math.random() * colors.length)
    colorMap.set(event.scheduleId, colorIndex)
  }
  let styleObject: StyleValue = {}
  if (stateMap.has(event.id)) {
    const dragOffset = stateMap.get(event.id)!.dragOffsetY // 一定不会是 undefined
    styleObject = {
      top: `${top + dragOffset}px`,
      height: `${height}px`,
      lineHeight: `${height}px`,
      backgroundColor: `${colors[colorIndex]}${65}`,
      border: `1.5px solid ${colors[colorIndex]}`
    }
    if (stateMap.get(event.id)!.isHover) {
      // 一定不会是 undefined
      styleObject['z-index'] = 999
      styleObject['background-color'] = `${colors[colorIndex]}${90}`
      styleObject['box-shadow'] = '5px 5px 10px #eee'
    }
  }
  return styleObject
}

const handleClick = (event: EventBriefVO) => {
  router.push({ name: 'schedule', params: { id: event.scheduleId } })
}

const handleDragStart = (event, eventBrief: EventBriefVO) => {
  if (stateMap.has(eventBrief.id)) {
    stateMap.get(eventBrief.id)!.isDrag = true // 一定不会是 undefined
    stateMap.get(eventBrief.id)!.mouseOffsetY = event.offsetY // 一定不会是 undefined
  }
}

const handleDragEnd = (event, eventBrief: EventBriefVO) => {
  if (stateMap.has(eventBrief.id)) {
    // 拖动结束 isHover 还是 true，不延时就会在拖动开始处出现 tooltip
    setTimeout(() => {
      stateMap.get(eventBrief.id)!.isDrag = false // 一定不会是 undefined
    }, 300)
    stateMap.get(eventBrief.id)!.dragOffsetY +=
      event.offsetY - stateMap.get(eventBrief.id)!.mouseOffsetY // 一定不会是 undefined
  }
}

// 监听窗口大小变化
const handleResize = () => {
  // 更新每个 event 的 styleObject
  for (const eventBriefs of eventBriefIndexed.values()) {
    for (const eventBrief of eventBriefs) {
      if (stateMap.has(eventBrief.id)) {
        stateMap.get(eventBrief.id)!.styleObject = getEventStyle(eventBrief) // 一定不会是 undefined
      }
    }
  }
}

const debouncedHandleResize = useDebounce(handleResize, 500)

window.addEventListener('resize', debouncedHandleResize)

onBeforeUnmount(() => {
  window.removeEventListener('resize', debouncedHandleResize)
})
</script>

<style scoped lang="less">
.container {
  display: flex;
  flex-wrap: nowrap;
  height: v-bind(dayCardContainerHeight);
}

.day-card {
  display: flex;
  flex-direction: column;
  position: relative;
  width: 100%;
  text-align: center;
  border: 1px solid #eee;
  border-radius: 4px;
  box-sizing: border-box;
  word-break: break-word;

  .title {
    height: v-bind(titleHeight);
    line-height: v-bind(titleHeight);
    border-bottom: 1px solid #eee;
    background-color: #fafafc;
  }

  :deep(.event-card) {
    position: absolute;
    display: flex;
    justify-content: space-between;
    left: 0;
    width: 100%;
    border-radius: 4px;
    box-sizing: border-box;
    padding: 0 10px 0 10px;
    cursor: pointer;
    overflow: hidden;

    .name {
      text-align: left;
      min-width: 50%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .time {
      max-width: 50%;
      min-width: 40px;
      text-align: right;
    }
  }
}

.comment {
  max-width: 50vh;
  white-space: pre-line;
}
</style>
