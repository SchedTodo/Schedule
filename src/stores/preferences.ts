import { defineStore } from 'pinia'
import { z } from 'zod'

const PreferencesSchema = z
  .object({
    themeMode: z.enum(['system', 'light', 'dark']),
    calendarMode: z.enum(['month', 'week']),
    weekStart: z.union([z.literal(0), z.literal(1)]),
    compactDensity: z.boolean()
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
  weekStart: 1,
  compactDensity: false
}

function browserStorage(): PreferencesStorage | undefined {
  return typeof localStorage === 'undefined' ? undefined : localStorage
}

export const usePreferencesStore = defineStore('preferences', {
  state: (): Preferences => ({ ...defaults }),
  actions: {
    hydrate(storage: PreferencesStorage | undefined = browserStorage()) {
      const serialized = storage?.getItem(storageKey)
      if (!serialized) return

      try {
        const parsed = PreferencesSchema.safeParse(JSON.parse(serialized))
        if (parsed.success) this.$patch(parsed.data)
      } catch {
        // Invalid client preferences fall back to stable defaults.
      }
    },
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
      if (parsed.data.compactDensity !== undefined) {
        this.compactDensity = parsed.data.compactDensity
      }
      storage?.setItem(storageKey, JSON.stringify(this.$state))
    }
  }
})
