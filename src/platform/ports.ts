import type {
  ScheduleDto,
  ScheduleListQuery,
  SchedulePageDto,
  ScheduleSearchQuery
} from '../contracts/schedule.contract'
import type { AppResult } from '../contracts/result'
import type {
  OccurrenceRangeQuery,
  ScheduleOccurrenceDto
} from '../contracts/occurrence.contract'

export interface ScheduleRepository {
  findById(id: string): Promise<AppResult<ScheduleDto | null>>
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
  listRange(query: OccurrenceRangeQuery): Promise<AppResult<readonly ScheduleOccurrenceDto[]>>
  listBySchedule(scheduleId: string): Promise<AppResult<readonly ScheduleOccurrenceDto[]>>
  updateComment(id: string, comment: string): Promise<AppResult<ScheduleOccurrenceDto>>
  exclude(id: string): Promise<AppResult<void>>
}
