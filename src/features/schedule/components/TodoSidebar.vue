<script setup lang="ts">
import { Play } from '@vicons/ionicons5'
import { computed, h, ref } from 'vue'
import {
  NButton,
  NButtonGroup,
  NCheckbox,
  NDataTable,
  NIcon,
  type DataTableColumns
} from 'naive-ui'

import type { ScheduleOccurrenceDto } from '../../../contracts/occurrence.contract'
import { Temporal } from '../../../domain/shared/temporal'
import { formatTodoDeadline, todoTone } from '../todo-presentation'
import {
  formatRelativeTime,
  type TimeDisplayMode
} from '../occurrence-time'

const props = withDefaults(defineProps<{
  items: readonly ScheduleOccurrenceDto[]
  timeZone: string
  now?: string
  timeDisplayMode?: TimeDisplayMode
  timeDisplayOverrides?: readonly string[]
}>(), {
  now: () => Temporal.Now.instant().toString(),
  timeDisplayMode: 'clock',
  timeDisplayOverrides: () => []
})
const emit = defineEmits<{
  select: [id: string]
  done: [id: string, done: boolean]
  concentrate: [id: string]
  'toggle-time': [id: string]
}>()
const hideExpired = ref(false)
const hideDone = ref(false)
const activeButtonStyle = {
  backgroundColor: 'var(--color-control-pressed-background)',
  boxShadow: 'var(--shadow-control-pressed)'
}
const nowInstant = computed(() => Temporal.Instant.from(props.now))
const nowValue = computed(() => nowInstant.value.toString())
/** 根据“隐藏过期”和“隐藏完成”开关筛选侧栏数据。 */
const visibleItems = computed(() => props.items.filter((item) => {
  if (hideExpired.value && tone(item) === 'expired') return false
  if (hideDone.value && item.done) return false
  return true
}))

function tone(item: ScheduleOccurrenceDto) {
  return todoTone(item.end, item.done, props.timeZone, nowInstant.value)
}

function deadlineLabel(item: ScheduleOccurrenceDto): string {
  const overridden = props.timeDisplayOverrides.includes(item.id)
  const relative = overridden
    ? props.timeDisplayMode === 'clock'
    : props.timeDisplayMode === 'relative'
  if (relative && item.endMark === '11') {
    return formatRelativeTime(item.end, nowValue.value, 'todo')
  }
  return formatTodoDeadline(item.end, props.timeZone)
}

function title(value: string) {
  return h('span', {
    style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
  }, value)
}

/** 将 Todo 展示状态转换为表格行样式类名。 */
function rowClassName(item: ScheduleOccurrenceDto): string {
  const classes: string[] = []
  if (item.done) classes.push('row-done')
  switch (todoTone(item.end, false, props.timeZone, nowInstant.value)) {
    case 'expired': classes.push('row-expired'); break
    case 'today': classes.push('row-tdy'); break
    case 'tomorrow': classes.push('row-tmr'); break
    case 'future': classes.push('row-after-tmr'); break
  }
  return classes.join(' ')
}

const columns: DataTableColumns<ScheduleOccurrenceDto> = [
  {
    key: 'name',
    title: () => title('Name'),
    render: (item) => h('span', {
      class: 'todo-link',
      'data-action': 'name',
      onClick: () => emit('select', item.scheduleId)
    }, item.title)
  },
  {
    key: 'end',
    title: () => title('Deadline'),
    render: (item) => h('button', {
      type: 'button',
      class: ['todo-link', 'todo-time'],
      'data-action': 'deadline',
      disabled: item.endMark !== '11',
      'aria-label': `Toggle time display for ${item.title}`,
      onClick: () => emit('toggle-time', item.id)
    }, deadlineLabel(item))
  },
  {
    key: 'action',
    title: () => title('Action'),
    width: '100px',
    render: (item) => h(NButton, {
      text: true,
      'aria-label': 'Concentrate',
      style: { fontSize: '20px', padding: '5px 0 0 0' },
      onClick: () => emit('concentrate', item.id)
    }, { default: () => h(NIcon, null, { default: () => h(Play) }) })
  },
  {
    key: 'done',
    title: () => title('Done'),
    width: '100px',
    render: (item) => h(NCheckbox, {
      checked: item.done,
      'aria-label': 'Done',
      onUpdateChecked: (checked) => emit('done', item.id, checked)
    })
  }
]
</script>

<template>
  <section class="todo-sidebar">
    <NButtonGroup class="todo-toolbar segmented-control">
      <NButton
        data-filter="expired"
        :style="hideExpired ? activeButtonStyle : undefined"
        @click="hideExpired = !hideExpired"
      >
        Not Expired
      </NButton>
      <NButton
        data-filter="done"
        :style="hideDone ? activeButtonStyle : undefined"
        @click="hideDone = !hideDone"
      >
        Not Done
      </NButton>
    </NButtonGroup>
    <NDataTable
      :columns="columns"
      :data="visibleItems"
      :row-class-name="rowClassName"
      max-height="76vh"
      min-height="76vh"
    />
  </section>
</template>

<style scoped>
.todo-sidebar { display: flex; flex-direction: column; block-size: 100%; padding: 2vh 1vw; }
.todo-toolbar { display: flex; padding-block-end: 1vh; }
.todo-link { cursor: pointer; }
:deep(.todo-time) { padding: 0; border: 0; box-shadow: none; background: transparent; color: inherit; font: inherit; line-height: inherit; white-space: nowrap; appearance: none; }
:deep(.todo-time:disabled) { color: inherit; cursor: default; }
:deep(.row-done span) { color: #ccc; }
:deep(.row-done .todo-time) { color: #ccc; }
:deep(.row-expired span) { color: red !important; }
:deep(.row-expired .todo-time) { color: red !important; }
:deep(.row-tdy span) { color: #f90; }
:deep(.row-tdy .todo-time) { color: #f90; }
:deep(.row-tmr span) { color: #000; }
:deep(.row-tmr .todo-time) { color: #000; }
:deep(.row-after-tmr span) { color: #999; }
:deep(.row-after-tmr .todo-time) { color: #999; }
</style>
