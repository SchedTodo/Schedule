import type {
  CreateScheduleInput,
  ScheduleDto,
  ScheduleListQuery,
  SchedulePageDto,
  ScheduleSearchQuery,
  SetScheduleDeletedInput,
  SetScheduleStarredInput,
  UpdateScheduleInput
} from './schedule.contract'
import type { AppResult } from './result'
import type { SettingsDto, UpdateSettingsInput } from './settings.contract'
import type { ConcentrationRecordDto, CreateConcentrationRecordInput } from './record.contract'
import type {
  CalendarOccurrenceDto,
  OccurrenceRangeQuery,
  ScheduleOccurrenceDto,
  TodoOccurrenceQuery
} from './occurrence.contract'

export interface ScheduleGateway {
  create(input: CreateScheduleInput): Promise<AppResult<ScheduleDto>>
  findById(id: string): Promise<AppResult<ScheduleDto | null>>
  list(query: ScheduleListQuery): Promise<AppResult<readonly ScheduleDto[]>>
  update(input: UpdateScheduleInput): Promise<AppResult<ScheduleDto>>
  setStarred(input: SetScheduleStarredInput): Promise<AppResult<ScheduleDto>>
  setDeleted(input: SetScheduleDeletedInput): Promise<AppResult<void>>
  searchPage(query: ScheduleSearchQuery): Promise<AppResult<SchedulePageDto>>
}

export interface OccurrenceGateway {
  listRange(query: OccurrenceRangeQuery): Promise<AppResult<readonly CalendarOccurrenceDto[]>>
  listBySchedule(scheduleId: string): Promise<AppResult<readonly ScheduleOccurrenceDto[]>>
  updateComment(id: string, comment: string): Promise<AppResult<ScheduleOccurrenceDto>>
  exclude(id: string): Promise<AppResult<void>>
  listTodos(query: TodoOccurrenceQuery): Promise<AppResult<readonly ScheduleOccurrenceDto[]>>
  setDone(id: string, done: boolean): Promise<AppResult<ScheduleOccurrenceDto>>
}

export interface PlatformGateway {
  readonly schedules: ScheduleGateway
  readonly occurrences: OccurrenceGateway
  readonly settings: {
    get(): Promise<AppResult<SettingsDto>>
    update(input: UpdateSettingsInput): Promise<AppResult<SettingsDto>>
  }
  readonly records: {
    create(input: CreateConcentrationRecordInput): Promise<AppResult<ConcentrationRecordDto>>
    listBySchedule(scheduleId: string): Promise<AppResult<readonly ConcentrationRecordDto[]>>
    delete(id: string): Promise<AppResult<void>>
  }
}
