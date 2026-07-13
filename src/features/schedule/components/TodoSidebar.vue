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

const props = defineProps<{
  items: readonly ScheduleOccurrenceDto[]
  timeZone: string
  now?: string
}>()
const emit = defineEmits<{
  select: [id: string]
  done: [id: string, done: boolean]
  concentrate: [id: string]
}>()
const hideExpired = ref(false)
const hideDone = ref(false)
const activeButtonStyle = {
  backgroundColor: 'rgba(0, 14, 28, 0.1)',
  boxShadow: '1px 1px 1px 1px rgba(0, 14, 28, 0.6) inset'
}
const nowInstant = computed(() => props.now === undefined
  ? Temporal.Now.instant()
  : Temporal.Instant.from(props.now))
const visibleItems = computed(() => props.items.filter((item) => {
  if (hideExpired.value && tone(item) === 'expired') return false
  if (hideDone.value && item.done) return false
  return true
}))

function tone(item: ScheduleOccurrenceDto) {
  return todoTone(item.end, item.done, props.timeZone, nowInstant.value)
}

function title(value: string) {
  return h('span', {
    style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
  }, value)
}

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
    render: (item) => h('span', {
      class: 'todo-link',
      'data-action': 'deadline',
      onClick: () => emit('select', item.scheduleId)
    }, formatTodoDeadline(item.end, props.timeZone))
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
:deep(.row-done span) { color: #ccc; }
:deep(.row-expired span) { color: red !important; }
:deep(.row-tdy span) { color: #f90; }
:deep(.row-tmr span) { color: #000; }
:deep(.row-after-tmr span) { color: #999; }
</style>
