import type { z } from 'zod'

import type { AppResult } from '../../src/contracts/result'
import type {
  OccurrenceRangeQuery,
  ScheduleOccurrenceDto
} from '../../src/contracts/occurrence.contract'
import type {
  ScheduleDto
} from '../../src/contracts/schedule.contract'
import {
  CreateScheduleInputSchema,
  ScheduleListQuerySchema
} from '../../src/contracts/schedule.contract'
import { scheduleIpcChannels, scheduleIpcContracts } from '../ipc/schedule-ipc'

export type IpcInvoke = (channel: string, input: unknown) => Promise<unknown>
type CreateScheduleRequest = z.input<typeof CreateScheduleInputSchema>
type ScheduleListRequest = z.input<typeof ScheduleListQuerySchema>

export interface ScheduleHostApi {
  createSchedule(input: CreateScheduleRequest): Promise<AppResult<ScheduleDto>>
  findScheduleById(id: string): Promise<AppResult<ScheduleDto | null>>
  listSchedules(query: ScheduleListRequest): Promise<AppResult<ScheduleDto[]>>
  listOccurrences(query: OccurrenceRangeQuery): Promise<AppResult<ScheduleOccurrenceDto[]>>
}

export function createScheduleHostApi(invoke: IpcInvoke): ScheduleHostApi {
  return {
    async createSchedule(input) {
      const value = await invoke(scheduleIpcChannels.create, input)
      return scheduleIpcContracts[scheduleIpcChannels.create].output.parse(value)
    },
    async findScheduleById(id) {
      const value = await invoke(scheduleIpcChannels.findById, { id })
      return scheduleIpcContracts[scheduleIpcChannels.findById].output.parse(value)
    },
    async listSchedules(query) {
      const value = await invoke(scheduleIpcChannels.list, query)
      return scheduleIpcContracts[scheduleIpcChannels.list].output.parse(value)
    },
    async listOccurrences(query) {
      const value = await invoke(scheduleIpcChannels.listOccurrences, query)
      return scheduleIpcContracts[scheduleIpcChannels.listOccurrences].output.parse(value)
    }
  }
}
