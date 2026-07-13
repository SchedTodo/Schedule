<script setup lang="ts">
import { Play } from '@vicons/ionicons5'
import { computed, ref } from 'vue'
import { NButton, NButtonGroup, NCheckbox, NEmpty, NIcon, NTable } from 'naive-ui'

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
</script>

<template>
  <section class="todo-sidebar">
    <NButtonGroup class="todo-toolbar segmented-control">
      <NButton
        data-filter="expired"
        :class="{ active: hideExpired }"
        @click="hideExpired = !hideExpired"
      >
        Not Expired
      </NButton>
      <NButton
        data-filter="done"
        :class="{ active: hideDone }"
        @click="hideDone = !hideDone"
      >
        Not Done
      </NButton>
    </NButtonGroup>
    <NTable
      size="small"
      :single-line="false"
    >
      <thead>
        <tr><th>Name</th><th>Deadline</th><th>Action</th><th>Done</th></tr>
      </thead>
      <tbody>
        <tr
          v-for="item in visibleItems"
          :key="item.id"
          :data-todo-tone="tone(item)"
          :class="`todo-${tone(item)}`"
        >
          <td class="todo-name-cell">
            <NButton
              text
              data-action="name"
              class="todo-content todo-name"
              @click="emit('select', item.scheduleId)"
            >
              {{ item.title }}
            </NButton>
          </td>
          <td>
            <NButton
              text
              data-action="deadline"
              class="todo-content todo-deadline"
              @click="emit('select', item.scheduleId)"
            >
              {{ formatTodoDeadline(item.end, timeZone) }}
            </NButton>
          </td>
          <td>
            <NButton
              text
              class="todo-content todo-action"
              aria-label="Concentrate"
              @click="emit('concentrate', item.id)"
            >
              <NIcon><Play /></NIcon>
            </NButton>
          </td>
          <td>
            <NCheckbox
              :checked="item.done"
              aria-label="Done"
              @update:checked="emit('done', item.id, Boolean($event))"
            />
          </td>
        </tr>
      </tbody>
    </NTable>
    <NEmpty
      v-if="visibleItems.length === 0"
      class="todo-empty"
      description="No Data"
    />
  </section>
</template>

<style scoped>
.todo-sidebar { position: relative; block-size: 100%; padding: 2vh 1vw; }
.todo-toolbar { display: flex; padding-block-end: 1vh; }
.todo-name-cell { max-inline-size: 0; }
.todo-name { display: block; max-inline-size: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.todo-deadline { white-space: nowrap; }
.todo-content { color: inherit; }
.todo-expired { color: red !important; }
.todo-today { color: #f90; }
.todo-tomorrow { color: #000; }
.todo-future, .todo-done { color: #999; }
.todo-empty { position: absolute; inset-block-start: 50%; inset-inline: 0; transform: translateY(-50%); }
</style>
