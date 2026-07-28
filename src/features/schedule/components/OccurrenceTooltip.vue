<script setup lang="ts">
import { NTooltip } from 'naive-ui'

import type { CalendarOccurrenceDto } from '../../../contracts/occurrence.contract'
import {
  formatOccurrenceRange
} from '../occurrence-time'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  item: CalendarOccurrenceDto
  timeZone: string
}>()
const { locale } = useI18n()

function dateLabel(): string {
  const instant = props.item.start ?? props.item.end
  return new Intl.DateTimeFormat(locale.value, {
    month: 'numeric',
    day: 'numeric',
    timeZone: props.timeZone
  }).format(new Date(instant))
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
