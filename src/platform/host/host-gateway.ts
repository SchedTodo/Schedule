import type { PlatformGateway } from '../../contracts/platform.contract'
import { HostScheduleApiSchema } from './host-api'

export function createHostGateway(host: unknown): PlatformGateway {
  const api = HostScheduleApiSchema.parse(host)
  return {
    schedules: {
      create: (input) => api.createSchedule(input),
      findById: (id) => api.findScheduleById(id),
      list: (query) => api.listSchedules(query)
    }
  }
}
