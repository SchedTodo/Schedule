import { and, desc, eq, isNull, like, type SQL } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'

import type {
  ScheduleDto,
  ScheduleListQuery
} from '../../../src/contracts/schedule.contract'
import type { AppErrorDto, AppResult } from '../../../src/contracts/result'
import type { ScheduleRepository } from '../../../src/platform/ports'
import { scheduleDtoToRow, scheduleRowToDto } from './schedule-mapper'
import { databaseSchema, schedules } from './schema'

type ScheduleDatabase = BetterSQLite3Database<typeof databaseSchema>

function persistenceError(error: unknown): AppErrorDto {
  return {
    code: 'PERSISTENCE_FAILED',
    message: '本地日程数据库操作失败',
    details: {
      cause: error instanceof Error ? error.message : String(error)
    }
  }
}

export class DrizzleScheduleRepository implements ScheduleRepository {
  constructor(private readonly database: ScheduleDatabase) {}

  async save(schedule: ScheduleDto): Promise<AppResult<ScheduleDto>> {
    try {
      const row = scheduleDtoToRow(schedule)
      this.database
        .insert(schedules)
        .values(row)
        .onConflictDoUpdate({
          target: schedules.id,
          set: {
            kind: row.kind,
            title: row.title,
            recurrenceCode: row.recurrenceCode,
            exclusionCode: row.exclusionCode,
            comment: row.comment,
            starred: row.starred,
            deletedAt: null,
            updatedAt: row.updatedAt
          }
        })
        .run()
      return { ok: true, value: schedule }
    } catch (error) {
      return { ok: false, error: persistenceError(error) }
    }
  }

  async findById(id: string): Promise<AppResult<ScheduleDto | null>> {
    try {
      const row = this.database
        .select()
        .from(schedules)
        .where(and(eq(schedules.id, id), isNull(schedules.deletedAt)))
        .get()
      return { ok: true, value: row === undefined ? null : scheduleRowToDto(row) }
    } catch (error) {
      return { ok: false, error: persistenceError(error) }
    }
  }

  async list(query: ScheduleListQuery): Promise<AppResult<readonly ScheduleDto[]>> {
    try {
      const conditions: SQL[] = [isNull(schedules.deletedAt)]
      if (query.kind !== undefined) conditions.push(eq(schedules.kind, query.kind))
      if (query.search !== undefined && query.search.length > 0) {
        conditions.push(like(schedules.title, `%${query.search}%`))
      }

      const rows = this.database
        .select()
        .from(schedules)
        .where(and(...conditions))
        .orderBy(desc(schedules.updatedAt))
        .limit(query.limit)
        .offset(query.offset)
        .all()
      return { ok: true, value: rows.map(scheduleRowToDto) }
    } catch (error) {
      return { ok: false, error: persistenceError(error) }
    }
  }

  async deleteById(id: string, deletedAt: string): Promise<AppResult<void>> {
    try {
      const timestamp = new Date(deletedAt)
      this.database
        .update(schedules)
        .set({ deletedAt: timestamp, updatedAt: timestamp })
        .where(eq(schedules.id, id))
        .run()
      return { ok: true, value: undefined }
    } catch (error) {
      return { ok: false, error: persistenceError(error) }
    }
  }
}
