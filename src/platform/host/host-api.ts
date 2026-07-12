import { z } from 'zod'

import type { AppResult } from '../../contracts/result'
import type {
  OccurrenceRangeQuery,
  ScheduleOccurrenceDto
} from '../../contracts/occurrence.contract'
import type {
  CreateScheduleInput,
  ScheduleDto,
  ScheduleListQuery
} from '../../contracts/schedule.contract'

export interface HostScheduleApi {
  createSchedule(input: CreateScheduleInput): Promise<AppResult<ScheduleDto>>
  findScheduleById(id: string): Promise<AppResult<ScheduleDto | null>>
  listSchedules(query: ScheduleListQuery): Promise<AppResult<readonly ScheduleDto[]>>
  listOccurrences(query: OccurrenceRangeQuery): Promise<AppResult<readonly ScheduleOccurrenceDto[]>>
}

function method<T extends (...arguments_: never[]) => unknown>() {
  return z.custom<T>((value) => typeof value === 'function')
}

export const HostScheduleApiSchema = z
  .object({
    createSchedule: method<HostScheduleApi['createSchedule']>(),
    findScheduleById: method<HostScheduleApi['findScheduleById']>(),
    listSchedules: method<HostScheduleApi['listSchedules']>(),
    listOccurrences: method<HostScheduleApi['listOccurrences']>()
  })
  .strict()
