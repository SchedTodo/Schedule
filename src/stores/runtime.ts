import { defineStore } from 'pinia'

import type { Preferences } from './preferences'
import type { TimeDisplayMode } from '../features/schedule/occurrence-time'

type CalendarMode = Preferences['calendarMode']

export const useRuntimeStore = defineStore('runtime', {
  state: () => ({
    homepage: {
      priority: 'month' as CalendarMode,
      timeDisplayMode: 'clock' as TimeDisplayMode,
      timeDisplayOverrides: [] as string[]
    }
  }),
  actions: {
    init(priority: CalendarMode) {
      this.homepage.priority = priority
    },
    setTimeDisplayMode(mode: TimeDisplayMode) {
      this.homepage.timeDisplayMode = mode
      this.homepage.timeDisplayOverrides = []
    },
    toggleOccurrenceTime(id: string) {
      const overrides = this.homepage.timeDisplayOverrides
      this.homepage.timeDisplayOverrides = overrides.includes(id)
        ? overrides.filter((value) => value !== id)
        : [...overrides, id]
    }
  }
})
