import type { ScheduleDto, ScheduleListQuery } from '../contracts/schedule.contract'
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
}

export interface OccurrenceRepository {
  listRange(query: OccurrenceRangeQuery): Promise<AppResult<readonly ScheduleOccurrenceDto[]>>
}
