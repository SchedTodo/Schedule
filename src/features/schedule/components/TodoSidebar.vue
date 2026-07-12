<script setup lang="ts">
import { computed, ref } from 'vue'
import { NEmpty } from 'naive-ui'

import type { ScheduleOccurrenceDto } from '../../../contracts/occurrence.contract'

const props = defineProps<{ items: readonly ScheduleOccurrenceDto[] }>()
const emit = defineEmits<{
  select: [id: string]
  done: [id: string, done: boolean]
  concentrate: [id: string]
}>()
const hideExpired = ref(false)
const hideDone = ref(false)
const visibleItems = computed(() => props.items.filter((item) => {
  if (hideExpired.value && Date.parse(item.end) < Date.now()) return false
  if (hideDone.value && item.done) return false
  return true
}))
</script>

<template>
  <section class="todo-sidebar">
    <div class="todo-toolbar">
      <button
        :class="{ active: hideExpired }"
        @click="hideExpired = !hideExpired"
      >
        Not Expired
      </button>
      <button
        :class="{ active: hideDone }"
        @click="hideDone = !hideDone"
      >
        Not Done
      </button>
    </div>
    <table>
      <thead>
        <tr><th>Name</th><th>Deadline</th><th>Action</th><th>Done</th></tr>
      </thead>
      <tbody>
        <tr
          v-for="item in visibleItems"
          :key="item.id"
        >
          <td>
            <button
              class="cell-link"
              @click="emit('select', item.scheduleId)"
            >
              {{ item.title }}
            </button>
          </td>
          <td>{{ new Date(item.end).toLocaleString() }}</td>
          <td>
            <button
              aria-label="Concentrate"
              @click="emit('concentrate', item.id)"
            >
              ▶
            </button>
          </td>
          <td>
            <input
              type="checkbox"
              :checked="item.done"
              aria-label="Done"
              @change="emit('done', item.id, ($event.target as HTMLInputElement).checked)"
            >
          </td>
        </tr>
      </tbody>
    </table>
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
.todo-toolbar button { padding: 0.55rem 0.8rem; border: 1px solid var(--color-border); background: var(--color-surface); color: inherit; }
.todo-toolbar button.active { box-shadow: 1px 1px 1px rgb(0 14 28 / 60%) inset; }
table { inline-size: 100%; border-collapse: collapse; }
th, td { padding: 0.7rem 0.4rem; border-block-end: 1px solid var(--color-border); text-align: start; }
.cell-link { border: 0; background: transparent; color: inherit; cursor: pointer; }
.todo-empty { position: absolute; inset-block-start: 50%; inset-inline: 0; transform: translateY(-50%); }
</style>
