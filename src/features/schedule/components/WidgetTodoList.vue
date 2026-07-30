<script setup lang="ts">
import { computed } from 'vue'
import { NCheckbox, NEmpty, NTooltip } from 'naive-ui'
import { useI18n } from 'vue-i18n'

import type { ScheduleOccurrenceDto } from '../../../contracts/occurrence.contract'
import { Temporal } from '../../../domain/shared/temporal'
import { formatRelativeTime, type TimeDisplayMode } from '../occurrence-time'
import { formatTodoDeadline, todoTone } from '../todo-presentation'
import {
  widgetTooltipContentStyle,
  widgetTooltipThemeOverrides
} from '../widget-tooltip-theme'

const props = withDefaults(defineProps<{
  items: readonly ScheduleOccurrenceDto[]
  timeZone: string
  now: string
  timeDisplayMode: TimeDisplayMode
  timeDisplayOverrides: readonly string[]
  interactive?: boolean
}>(), {
  interactive: true
})
const emit = defineEmits<{
  select: [scheduleId: string]
  done: [id: string, done: boolean]
  'toggle-time': [id: string]
}>()
const { t, locale } = useI18n()
const nowInstant = computed(() => Temporal.Instant.from(props.now))

function deadline(item: ScheduleOccurrenceDto): string {
  const overridden = props.timeDisplayOverrides.includes(item.id)
  const relative = overridden
    ? props.timeDisplayMode === 'clock'
    : props.timeDisplayMode === 'relative'
  if (relative && item.endMark === '11') {
    return formatRelativeTime(item.end, props.now, 'todo', locale.value)
  }
  return formatTodoDeadline(item.end, props.timeZone, locale.value)
}
</script>

<template>
  <div class="widget-todo-list">
    <NEmpty
      v-if="items.length === 0"
      :description="t('widget.noTodos')"
    />
    <NTooltip
      v-for="item in items"
      v-else
      :key="item.id"
      :disabled="interactive === false"
      :theme-overrides="widgetTooltipThemeOverrides"
      :content-style="widgetTooltipContentStyle"
    >
      <template #trigger>
        <article
          :class="['widget-todo-item', `tone-${todoTone(item.end, item.done, timeZone, nowInstant)}`]"
        >
          <NCheckbox
            :checked="item.done"
            :aria-label="t('common.done')"
            @update:checked="emit('done', item.id, $event)"
          />
          <button
            type="button"
            class="widget-todo-title"
            @click="emit('select', item.scheduleId)"
          >
            {{ item.title }}
          </button>
          <button
            type="button"
            class="widget-todo-time"
            :disabled="item.endMark !== '11'"
            :aria-label="t('schedule.toggleTime', { title: item.title })"
            @click="emit('toggle-time', item.id)"
          >
            {{ deadline(item) }}
          </button>
        </article>
      </template>
      <template #header>
        {{ item.title }}
      </template>
      {{ deadline(item) }}
      <template
        v-if="item.comment"
        #footer
      >
        <div class="widget-todo-comment">
          {{ item.comment }}
        </div>
      </template>
    </NTooltip>
  </div>
</template>

<style scoped>
.widget-todo-list { display: flex; flex-direction: column; gap: 8px; padding: 10px; overflow: auto; }
.widget-todo-item { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 2px 8px; padding: 9px; border: 1px solid color-mix(in srgb, var(--color-border) 35%, transparent); border-radius: 8px; background: color-mix(in srgb, var(--color-surface) 24%, transparent); }
.widget-todo-title, .widget-todo-time { padding: 0; border: 0; overflow: hidden; background: transparent; color: inherit; font: inherit; text-align: start; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; }
.widget-todo-time { grid-column: 2; color: var(--color-primary); font-size: 0.85rem; }
.widget-todo-time:disabled { color: inherit; cursor: default; }
.tone-expired { color: var(--color-danger); }
.tone-today { color: var(--color-warning); }
.tone-done { opacity: 0.55; }
.widget-todo-comment { max-inline-size: 320px; white-space: pre-line; }
</style>
