import { createI18n } from 'vue-i18n'

import type { SupportedLocale } from './locale'
import { messages } from './messages'

export function createScheduleI18n(locale: SupportedLocale) {
  return createI18n({
    legacy: false,
    locale,
    fallbackLocale: 'en-US',
    messages
  })
}

export type ScheduleI18n = ReturnType<typeof createScheduleI18n>
