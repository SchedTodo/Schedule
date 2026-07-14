import type { z } from 'zod'

import type { AppResult } from '../../src/contracts/result'
import type { SettingsDto, UpdateSettingsInput } from '../../src/contracts/settings.contract'
import type { ConcentrationRecordDto, CreateConcentrationRecordInput } from '../../src/contracts/record.contract'
import type {
  CalendarOccurrenceDto,
  OccurrenceRangeQuery,
  ScheduleOccurrenceDto,
  TodoOccurrenceQuery
} from '../../src/contracts/occurrence.contract'
import type {
  ScheduleDetailDto,
  ScheduleDto
} from '../../src/contracts/schedule.contract'
import {
  CreateScheduleInputSchema,
  ScheduleListQuerySchema,
  type SchedulePageDto,
  type ScheduleSearchQuery,
  type SetScheduleDeletedInput,
  type SetScheduleStarredInput,
  type UpdateScheduleInput
} from '../../src/contracts/schedule.contract'
import { scheduleIpcChannels, scheduleIpcContracts } from '../ipc/schedule-ipc'

export type IpcInvoke = (channel: string, input: unknown) => Promise<unknown>
type CreateScheduleRequest = z.input<typeof CreateScheduleInputSchema>
type ScheduleListRequest = z.input<typeof ScheduleListQuerySchema>

export interface ScheduleHostApi {
  createSchedule(input: CreateScheduleRequest): Promise<AppResult<ScheduleDto>>
  findScheduleById(id: string): Promise<AppResult<ScheduleDetailDto | null>>
  listSchedules(query: ScheduleListRequest): Promise<AppResult<ScheduleDto[]>>
  updateSchedule(input: UpdateScheduleInput): Promise<AppResult<ScheduleDto>>
  setScheduleStarred(input: SetScheduleStarredInput): Promise<AppResult<ScheduleDto>>
  setScheduleDeleted(input: SetScheduleDeletedInput): Promise<AppResult<void>>
  searchSchedules(query: ScheduleSearchQuery): Promise<AppResult<SchedulePageDto>>
  listOccurrences(query: OccurrenceRangeQuery): Promise<AppResult<CalendarOccurrenceDto[]>>
  listScheduleOccurrences(scheduleId: string): Promise<AppResult<ScheduleOccurrenceDto[]>>
  updateOccurrenceComment(id: string, comment: string): Promise<AppResult<ScheduleOccurrenceDto>>
  excludeOccurrence(id: string): Promise<AppResult<void>>
  listTodos(query: TodoOccurrenceQuery): Promise<AppResult<ScheduleOccurrenceDto[]>>
  setOccurrenceDone(id: string, done: boolean): Promise<AppResult<ScheduleOccurrenceDto>>
  getSettings(): Promise<AppResult<SettingsDto>>
  updateSettings(input: UpdateSettingsInput): Promise<AppResult<SettingsDto>>
  createRecord(input: CreateConcentrationRecordInput): Promise<AppResult<ConcentrationRecordDto>>
  listRecords(scheduleId: string): Promise<AppResult<ConcentrationRecordDto[]>>
  deleteRecord(id: string): Promise<AppResult<void>>
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
    async updateSchedule(input) {
      return scheduleIpcContracts[scheduleIpcChannels.update].output.parse(
        await invoke(scheduleIpcChannels.update, input)
      )
    },
    async setScheduleStarred(input) {
      return scheduleIpcContracts[scheduleIpcChannels.setStarred].output.parse(
        await invoke(scheduleIpcChannels.setStarred, input)
      )
    },
    async setScheduleDeleted(input) {
      return scheduleIpcContracts[scheduleIpcChannels.setDeleted].output.parse(
        await invoke(scheduleIpcChannels.setDeleted, input)
      )
    },
    async searchSchedules(query) {
      return scheduleIpcContracts[scheduleIpcChannels.search].output.parse(
        await invoke(scheduleIpcChannels.search, query)
      )
    },
    async listOccurrences(query) {
      const value = await invoke(scheduleIpcChannels.listOccurrences, query)
      return scheduleIpcContracts[scheduleIpcChannels.listOccurrences].output.parse(value)
    },
    async listScheduleOccurrences(scheduleId) {
      return scheduleIpcContracts[scheduleIpcChannels.listScheduleOccurrences].output.parse(
        await invoke(scheduleIpcChannels.listScheduleOccurrences, { scheduleId })
      )
    },
    async updateOccurrenceComment(id, comment) {
      return scheduleIpcContracts[scheduleIpcChannels.updateOccurrenceComment].output.parse(
        await invoke(scheduleIpcChannels.updateOccurrenceComment, { id, comment })
      )
    },
    async excludeOccurrence(id) {
      return scheduleIpcContracts[scheduleIpcChannels.excludeOccurrence].output.parse(
        await invoke(scheduleIpcChannels.excludeOccurrence, { id })
      )
    },
    async listTodos(query) {
      return scheduleIpcContracts[scheduleIpcChannels.listTodos].output.parse(
        await invoke(scheduleIpcChannels.listTodos, query)
      )
    },
    async setOccurrenceDone(id, done) {
      return scheduleIpcContracts[scheduleIpcChannels.setOccurrenceDone].output.parse(
        await invoke(scheduleIpcChannels.setOccurrenceDone, { id, done })
      )
    },
    async getSettings() {
      return scheduleIpcContracts[scheduleIpcChannels.getSettings].output.parse(
        await invoke(scheduleIpcChannels.getSettings, {})
      )
    },
    async updateSettings(input) {
      return scheduleIpcContracts[scheduleIpcChannels.updateSettings].output.parse(
        await invoke(scheduleIpcChannels.updateSettings, input)
      )
    },
    async createRecord(input) {
      return scheduleIpcContracts[scheduleIpcChannels.createRecord].output.parse(
        await invoke(scheduleIpcChannels.createRecord, input)
      )
    },
    async listRecords(scheduleId) {
      return scheduleIpcContracts[scheduleIpcChannels.listRecords].output.parse(
        await invoke(scheduleIpcChannels.listRecords, { scheduleId })
      )
    },
    async deleteRecord(id) {
      return scheduleIpcContracts[scheduleIpcChannels.deleteRecord].output.parse(
        await invoke(scheduleIpcChannels.deleteRecord, { id })
      )
    }
  }
}
