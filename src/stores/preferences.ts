import { defineStore } from 'pinia'
import { z } from 'zod'

import { WeekStartSchema } from '../contracts/settings.contract'

const PreferencesSchema = z
  .object({
    themeMode: z.enum(['system', 'light', 'dark']),
    calendarMode: z.enum(['month', 'week']),
    weekStart: WeekStartSchema
  })
  .strict()

export type Preferences = z.infer<typeof PreferencesSchema>
export type PreferencesUpdate = Partial<Preferences>

export interface PreferencesStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

const storageKey = 'schedule-v2-preferences'
const defaults: Preferences = {
  themeMode: 'system',
  calendarMode: 'month',
  weekStart: 1
}

function browserStorage(): PreferencesStorage | undefined {
  return typeof localStorage === 'undefined' ? undefined : localStorage
}

export const usePreferencesStore = defineStore('preferences', {
  state: (): Preferences => ({ ...defaults }),
  actions: {
    /** 从浏览器存储恢复通过契约校验的偏好，损坏数据保持默认值。 */
    hydrate(storage: PreferencesStorage | undefined = browserStorage()) {
      const serialized = storage?.getItem(storageKey)
      if (!serialized) return

      try {
        const parsed = PreferencesSchema.safeParse(JSON.parse(serialized))
        if (parsed.success) this.$patch(parsed.data)
      } catch {
        // 无效的客户端偏好继续使用稳定默认值。
      }
    },
    /** 合并并持久化通过契约校验的偏好字段。 */
    update(
      update: PreferencesUpdate,
      storage: PreferencesStorage | undefined = browserStorage()
    ) {
      const parsed = PreferencesSchema.partial().safeParse(update)
      if (!parsed.success) return
      if (parsed.data.themeMode !== undefined) this.themeMode = parsed.data.themeMode
      if (parsed.data.calendarMode !== undefined) {
        this.calendarMode = parsed.data.calendarMode
      }
      if (parsed.data.weekStart !== undefined) this.weekStart = parsed.data.weekStart
      storage?.setItem(storageKey, JSON.stringify(this.$state))
    }
  }
})
