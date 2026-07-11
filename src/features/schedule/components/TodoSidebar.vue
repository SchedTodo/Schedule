<script setup lang="ts">
import { computed, ref } from 'vue'

import type { ScheduleDto } from '../../../contracts/schedule.contract'
import { parseFirstScheduleDate } from '../recurrence-presentation'

const props = defineProps<{ items: readonly ScheduleDto[] }>()
const emit = defineEmits<{ select: [id: string] }>()
const hideExpired = ref(false)
const hideDone = ref(false)
const visibleItems = computed(() => props.items)
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
              @click="emit('select', item.id)"
            >
              {{ item.title }}
            </button>
          </td>
          <td>{{ parseFirstScheduleDate(item.recurrenceCode)?.timeLabel ?? '-' }}</td>
          <td>
            <button
              disabled
              aria-label="Concentrate"
            >
              ▶
            </button>
          </td>
          <td>
            <input
              type="checkbox"
              disabled
              aria-label="Done"
            >
          </td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<style scoped>
.todo-sidebar { block-size: 100%; padding: 2vh 1vw; }
.todo-toolbar { display: flex; padding-block-end: 1vh; }
.todo-toolbar button { padding: 0.55rem 0.8rem; border: 1px solid var(--color-border); background: var(--color-surface); color: inherit; }
.todo-toolbar button.active { box-shadow: 1px 1px 1px rgb(0 14 28 / 60%) inset; }
table { inline-size: 100%; border-collapse: collapse; }
th, td { padding: 0.7rem 0.4rem; border-block-end: 1px solid var(--color-border); text-align: start; }
.cell-link { border: 0; background: transparent; color: inherit; cursor: pointer; }
</style>
