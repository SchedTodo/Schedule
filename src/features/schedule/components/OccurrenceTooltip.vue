<script setup lang="ts">
import { NTooltip } from 'naive-ui'

import type { CalendarOccurrenceDto } from '../../../contracts/occurrence.contract'
import {
  formatOccurrenceRange,
  occurrenceWallTime
} from '../occurrence-time'

const props = defineProps<{
  item: CalendarOccurrenceDto
  timeZone: string
}>()

function dateLabel(): string {
  const instant = props.item.start ?? props.item.end
  const [, month, day] = occurrenceWallTime(instant, props.timeZone).date.split('-')
  return `${Number(month)}/${Number(day)}`
}
</script>

<template>
  <NTooltip trigger="hover">
    <template #trigger>
      <slot />
    </template>
    <template #header>
      {{ item.title }}
    </template>
    {{ dateLabel() }} {{ formatOccurrenceRange(item, timeZone) }}
    <template #footer>
      <div class="occurrence-comment">
        {{ item.scheduleComment }}
      </div>
    </template>
  </NTooltip>
</template>

<style scoped>
.occurrence-comment { max-inline-size: 50vh; white-space: pre-line; }
</style>
