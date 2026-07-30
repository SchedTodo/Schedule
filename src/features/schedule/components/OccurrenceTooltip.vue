<script setup lang="ts">
import { NTooltip } from 'naive-ui'

import type { CalendarOccurrenceDto } from '../../../contracts/occurrence.contract'
import {
  formatOccurrenceRange
} from '../occurrence-time'
import { useI18n } from 'vue-i18n'
import {
  widgetTooltipContentStyle,
  widgetTooltipThemeOverrides
} from '../widget-tooltip-theme'

const props = withDefaults(defineProps<{
  item: CalendarOccurrenceDto
  timeZone: string
  disabled?: boolean
  transparent?: boolean
}>(), {
  disabled: false,
  transparent: false
})
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
  <NTooltip
    trigger="hover"
    :disabled="disabled"
    v-bind="transparent
      ? {
        themeOverrides: widgetTooltipThemeOverrides,
        contentStyle: widgetTooltipContentStyle
      }
      : {}"
  >
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
