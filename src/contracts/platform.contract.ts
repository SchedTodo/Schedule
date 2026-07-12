import type {
  CreateScheduleInput,
  ScheduleDto,
  ScheduleListQuery
} from './schedule.contract'
import type { AppResult } from './result'
import type {
  OccurrenceRangeQuery,
  ScheduleOccurrenceDto
} from './occurrence.contract'

export interface ScheduleGateway {
  create(input: CreateScheduleInput): Promise<AppResult<ScheduleDto>>
  findById(id: string): Promise<AppResult<ScheduleDto | null>>
  list(query: ScheduleListQuery): Promise<AppResult<readonly ScheduleDto[]>>
}

export interface OccurrenceGateway {
  listRange(query: OccurrenceRangeQuery): Promise<AppResult<readonly ScheduleOccurrenceDto[]>>
}

export interface PlatformGateway {
  readonly schedules: ScheduleGateway
  readonly occurrences: OccurrenceGateway
}
