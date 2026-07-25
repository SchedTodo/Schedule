import type { PlatformGateway } from '../../contracts/platform.contract'
import { HostScheduleApiSchema } from './host-api'

/** 校验宿主暴露的 API，并适配为 Web 层只依赖的 PlatformGateway。 */
export function createHostGateway(host: unknown): PlatformGateway {
  const api = HostScheduleApiSchema.parse(host)
  return {
    schedules: {
      create: (input) => api.createSchedule(input),
      findById: (id) => api.findScheduleById(id),
      list: (query) => api.listSchedules(query),
      update: (input) => api.updateSchedule(input),
      setStarred: (input) => api.setScheduleStarred(input),
      setDeleted: (input) => api.setScheduleDeleted(input),
      searchPage: (query) => api.searchSchedules(query)
    },
    occurrences: {
      listRange: (query) => api.listOccurrences(query),
      listVisibleBySchedule: (scheduleId) => api.listScheduleOccurrences(scheduleId),
      updateComment: (id, comment) => api.updateOccurrenceComment(id, comment),
      excludeMany: (input) => api.excludeOccurrences(input),
      listTodos: (query) => api.listTodos(query),
      setDone: (id, done) => api.setOccurrenceDone(id, done)
    },
    settings: {
      get: () => api.getSettings(),
      update: (input) => api.updateSettings(input)
    },
    records: {
      create: (input) => api.createRecord(input),
      listBySchedule: (scheduleId) => api.listRecords(scheduleId),
      delete: (id) => api.deleteRecord(id)
    },
    notifications: {
      show: (input) => api.showNotification(input)
    }
  }
}
