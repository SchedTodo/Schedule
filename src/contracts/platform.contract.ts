import type {
  CreateScheduleInput,
  ScheduleDto,
  ScheduleListQuery
} from './schedule.contract'
import type { AppResult } from './result'

export interface ScheduleGateway {
  create(input: CreateScheduleInput): Promise<AppResult<ScheduleDto>>
  findById(id: string): Promise<AppResult<ScheduleDto | null>>
  list(query: ScheduleListQuery): Promise<AppResult<readonly ScheduleDto[]>>
}

export interface PlatformGateway {
  readonly schedules: ScheduleGateway
}
