import { z } from 'zod'

import type { AppResult } from '../../contracts/result'
import type { SettingsDto, UpdateSettingsInput } from '../../contracts/settings.contract'
import type { ConcentrationRecordDto, CreateConcentrationRecordInput } from '../../contracts/record.contract'
import type {
  CalendarOccurrenceDto,
  OccurrenceRangeQuery,
  ScheduleOccurrenceDto,
  TodoOccurrenceQuery
} from '../../contracts/occurrence.contract'
import type {
  CreateScheduleInput,
  ScheduleDto,
  ScheduleListQuery,
  SchedulePageDto,
  ScheduleSearchQuery,
  SetScheduleDeletedInput,
  SetScheduleStarredInput,
  UpdateScheduleInput
} from '../../contracts/schedule.contract'

export interface HostScheduleApi {
  createSchedule(input: CreateScheduleInput): Promise<AppResult<ScheduleDto>>
  findScheduleById(id: string): Promise<AppResult<ScheduleDto | null>>
  listSchedules(query: ScheduleListQuery): Promise<AppResult<readonly ScheduleDto[]>>
  updateSchedule(input: UpdateScheduleInput): Promise<AppResult<ScheduleDto>>
  setScheduleStarred(input: SetScheduleStarredInput): Promise<AppResult<ScheduleDto>>
  setScheduleDeleted(input: SetScheduleDeletedInput): Promise<AppResult<void>>
  searchSchedules(query: ScheduleSearchQuery): Promise<AppResult<SchedulePageDto>>
  listOccurrences(query: OccurrenceRangeQuery): Promise<AppResult<readonly CalendarOccurrenceDto[]>>
  listScheduleOccurrences(scheduleId: string): Promise<AppResult<readonly ScheduleOccurrenceDto[]>>
  updateOccurrenceComment(id: string, comment: string): Promise<AppResult<ScheduleOccurrenceDto>>
  excludeOccurrence(id: string): Promise<AppResult<void>>
  listTodos(query: TodoOccurrenceQuery): Promise<AppResult<readonly ScheduleOccurrenceDto[]>>
  setOccurrenceDone(id: string, done: boolean): Promise<AppResult<ScheduleOccurrenceDto>>
  getSettings(): Promise<AppResult<SettingsDto>>
  updateSettings(input: UpdateSettingsInput): Promise<AppResult<SettingsDto>>
  createRecord(input: CreateConcentrationRecordInput): Promise<AppResult<ConcentrationRecordDto>>
  listRecords(scheduleId: string): Promise<AppResult<readonly ConcentrationRecordDto[]>>
  deleteRecord(id: string): Promise<AppResult<void>>
}

function method<T extends (...arguments_: never[]) => unknown>() {
  return z.custom<T>((value) => typeof value === 'function')
}

export const HostScheduleApiSchema = z
  .object({
    createSchedule: method<HostScheduleApi['createSchedule']>(),
    findScheduleById: method<HostScheduleApi['findScheduleById']>(),
    listSchedules: method<HostScheduleApi['listSchedules']>(),
    updateSchedule: method<HostScheduleApi['updateSchedule']>(),
    setScheduleStarred: method<HostScheduleApi['setScheduleStarred']>(),
    setScheduleDeleted: method<HostScheduleApi['setScheduleDeleted']>(),
    searchSchedules: method<HostScheduleApi['searchSchedules']>(),
    listOccurrences: method<HostScheduleApi['listOccurrences']>(),
    listScheduleOccurrences: method<HostScheduleApi['listScheduleOccurrences']>(),
    updateOccurrenceComment: method<HostScheduleApi['updateOccurrenceComment']>(),
    excludeOccurrence: method<HostScheduleApi['excludeOccurrence']>()
    ,listTodos: method<HostScheduleApi['listTodos']>()
    ,setOccurrenceDone: method<HostScheduleApi['setOccurrenceDone']>()
    ,getSettings: method<HostScheduleApi['getSettings']>()
    ,updateSettings: method<HostScheduleApi['updateSettings']>()
    ,createRecord: method<HostScheduleApi['createRecord']>()
    ,listRecords: method<HostScheduleApi['listRecords']>()
    ,deleteRecord: method<HostScheduleApi['deleteRecord']>()
  })
  .strict()
