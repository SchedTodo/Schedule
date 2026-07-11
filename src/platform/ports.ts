import type { ScheduleDto, ScheduleListQuery } from '../contracts/schedule.contract'
import type { AppResult } from '../contracts/result'

export interface ScheduleRepository {
  findById(id: string): Promise<AppResult<ScheduleDto | null>>
  list(query: ScheduleListQuery): Promise<AppResult<readonly ScheduleDto[]>>
  save(schedule: ScheduleDto): Promise<AppResult<ScheduleDto>>
  deleteById(id: string, deletedAt: string): Promise<AppResult<void>>
}
