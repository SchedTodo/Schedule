<script setup lang="ts">
import type { ScheduleDto } from '../../../contracts/schedule.contract'
import { NEmpty } from 'naive-ui'
import { parseFirstScheduleDate } from '../recurrence-presentation'

defineProps<{ items: readonly ScheduleDto[] }>()
const emit = defineEmits<{ select: [id: string] }>()
const days = Array.from({ length: 5 }, (_, offset) => {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return date.toISOString().slice(0, 10)
})
</script>

<template>
  <div
    data-testid="week-view"
    class="week-view"
  >
    <section
      v-for="day in days"
      :key="day"
      class="day-card"
    >
      <header>{{ day.replaceAll('-', '/') }}</header>
      <button
        v-for="item in items.filter((value) => parseFirstScheduleDate(value.recurrenceCode)?.dateKey === day)"
        :key="item.id"
        class="event-card"
        @click="emit('select', item.id)"
      >
        <span>{{ item.title }}</span>
        <span>{{ parseFirstScheduleDate(item.recurrenceCode)?.timeLabel }}</span>
      </button>
      <NEmpty
        v-if="!items.some((value) => parseFirstScheduleDate(value.recurrenceCode)?.dateKey === day)"
        data-testid="no-events"
        class="day-empty"
        description="No Events"
      />
    </section>
  </div>
</template>

<style scoped>
.week-view { display: grid; block-size: calc(100% - 3rem); min-block-size: 70vh; grid-template-columns: repeat(5, minmax(0, 1fr)); }
.day-card { position: relative; border: 1px solid #eee; text-align: center; }
.day-card header { padding: 0.6rem; border-block-end: 1px solid #eee; background: color-mix(in srgb, var(--color-surface) 90%, var(--color-text)); }
.event-card { display: flex; justify-content: space-between; inline-size: 100%; padding: 0.5rem; border: 0; border-radius: 4px; background: #18a058; color: white; cursor: pointer; }
.day-empty { position: absolute; inset-block-start: 50%; inset-inline: 0; transform: translateY(-50%); }
</style>
