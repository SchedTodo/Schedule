import { defineStore } from 'pinia'

import type { Preferences } from './preferences'

type CalendarMode = Preferences['calendarMode']

export const useRuntimeStore = defineStore('runtime', {
  state: () => ({
    homepage: {
      priority: 'month' as CalendarMode
    }
  }),
  actions: {
    init(priority: CalendarMode) {
      this.homepage.priority = priority
    }
  }
})
