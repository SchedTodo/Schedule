import type { ScheduleDetailDto, ScheduleDto } from '../../../src/contracts/schedule.contract'
import { Temporal } from '../../../src/domain/shared/temporal'
import type { NewScheduleRow, ScheduleRow } from './schema'

export function scheduleDtoToRow(schedule: ScheduleDto): NewScheduleRow {
  return {
    id: schedule.id,
    kind: schedule.kind,
    title: schedule.title,
    recurrenceCode: schedule.recurrenceCode,
    exclusionCode: schedule.exclusionCode,
    comment: schedule.comment,
    starred: schedule.starred,
    deletedAt: null,
    createdAt: new Date(schedule.createdAt),
    updatedAt: new Date(schedule.updatedAt)
  }
}

export function scheduleRowToDto(row: ScheduleRow): ScheduleDto {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    recurrenceCode: row.recurrenceCode,
    exclusionCode: row.exclusionCode,
    comment: row.comment,
    starred: row.starred,
    createdAt: Temporal.Instant.from(row.createdAt.toISOString()).toString(),
    updatedAt: Temporal.Instant.from(row.updatedAt.toISOString()).toString()
  }
}

export function scheduleRowToDetailDto(row: ScheduleRow): ScheduleDetailDto {
  return {
    ...scheduleRowToDto(row),
    deleted: row.deletedAt !== null
  }
}
