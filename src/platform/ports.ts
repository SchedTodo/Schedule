import type {
  ScheduleDetailDto,
  ScheduleDto,
  ScheduleListQuery,
  SchedulePageDto,
  ScheduleSearchQuery
} from '../contracts/schedule.contract'
import type { AppResult } from '../contracts/result'
import type {
  AlarmCandidateQuery,
  CalendarOccurrenceDto,
  ExcludeOccurrencesInput,
  OccurrenceRangeQuery,
  ScheduleOccurrenceDto,
  StoredScheduleOccurrenceDto
} from '../contracts/occurrence.contract'

export interface ScheduleRepository {
  findById(id: string): Promise<AppResult<ScheduleDetailDto | null>>
  list(query: ScheduleListQuery): Promise<AppResult<readonly ScheduleDto[]>>
  save(schedule: ScheduleDto): Promise<AppResult<ScheduleDto>>
  saveWithOccurrences(
    schedule: ScheduleDto,
    occurrences: readonly ScheduleOccurrenceDto[]
  ): Promise<AppResult<ScheduleDto>>
  deleteById(id: string, deletedAt: string): Promise<AppResult<void>>
  setStarred(id: string, starred: boolean, updatedAt: string): Promise<AppResult<ScheduleDto>>
  setDeleted(id: string, deleted: boolean, updatedAt: string): Promise<AppResult<void>>
  searchPage(query: ScheduleSearchQuery): Promise<AppResult<SchedulePageDto>>
}

export interface OccurrenceRepository {
  listRange(query: OccurrenceRangeQuery): Promise<AppResult<readonly CalendarOccurrenceDto[]>>
  listAlarmCandidates(
    query: AlarmCandidateQuery
  ): Promise<AppResult<readonly ScheduleOccurrenceDto[]>>
  listVisibleBySchedule(scheduleId: string): Promise<AppResult<readonly ScheduleOccurrenceDto[]>>
  listAllBySchedule(scheduleId: string): Promise<AppResult<readonly StoredScheduleOccurrenceDto[]>>
  updateComment(id: string, comment: string): Promise<AppResult<ScheduleOccurrenceDto>>
  excludeMany(input: ExcludeOccurrencesInput): Promise<AppResult<void>>
  listTodos(query: import('../contracts/occurrence.contract').TodoOccurrenceQuery): Promise<AppResult<readonly ScheduleOccurrenceDto[]>>
  setDone(id: string, done: boolean): Promise<AppResult<ScheduleOccurrenceDto>>
}
