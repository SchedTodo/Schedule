import { and, desc, eq, isNotNull, isNull, like, type SQL } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'

import type {
  ScheduleDto,
  ScheduleDetailDto,
  ScheduleListQuery,
  ScheduleSearchQuery
} from '../../../src/contracts/schedule.contract'
import type { AppErrorDto, AppResult } from '../../../src/contracts/result'
import type { ScheduleOccurrenceDto } from '../../../src/contracts/occurrence.contract'
import type { ScheduleRepository } from '../../../src/platform/ports'
import { scheduleDtoToRow, scheduleRowToDetailDto, scheduleRowToDto } from './schedule-mapper'
import { concentrationRecords, databaseSchema, scheduleOccurrences, schedules } from './schema'

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

/**
 * 使用 Drizzle 和 SQLite 实现日程仓储端口。
 *
 * 除基本读写外，该仓储还定义日程与 occurrence、专注记录之间的事务边界，
 * 并把数据库异常转换为稳定的应用错误。
 */
export class DrizzleScheduleRepository implements ScheduleRepository {
  constructor(private readonly database: ScheduleDatabase) {}

  /** 新增或覆盖日程行，并在覆盖时恢复其未删除状态。 */
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

  /**
   * 在同一事务中保存日程及其全部 occurrence。
   *
   * 不再出现在目标集合中的旧 occurrence 会被软删除，保留历史记录而不污染当前查询。
   */
  async saveWithOccurrences(
    schedule: ScheduleDto,
    occurrences: readonly ScheduleOccurrenceDto[]
  ): Promise<AppResult<ScheduleDto>> {
    try {
      const row = scheduleDtoToRow(schedule)
      this.database.transaction((transaction) => {
        transaction.insert(schedules).values(row).onConflictDoUpdate({
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
        }).run()
        const existing = transaction
          .select({ id: scheduleOccurrences.id })
          .from(scheduleOccurrences)
          .where(eq(scheduleOccurrences.scheduleId, schedule.id))
          .all()
        const desiredIds = new Set(occurrences.map(({ id }) => id))
        for (const occurrence of occurrences) {
          transaction.insert(scheduleOccurrences).values({
            id: occurrence.id,
            scheduleId: occurrence.scheduleId,
            excluded: occurrence.excluded,
            start: occurrence.start === null ? null : new Date(occurrence.start),
            end: new Date(occurrence.end),
            startMark: occurrence.startMark,
            endMark: occurrence.endMark,
            comment: occurrence.comment,
            done: occurrence.done,
            deletedAt: null,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt
          }).onConflictDoUpdate({
            target: scheduleOccurrences.id,
            set: {
              excluded: occurrence.excluded,
              start: occurrence.start === null ? null : new Date(occurrence.start),
              end: new Date(occurrence.end),
              startMark: occurrence.startMark,
              endMark: occurrence.endMark,
              comment: occurrence.comment,
              done: occurrence.done,
              deletedAt: null,
              updatedAt: row.updatedAt
            }
          }).run()
        }
        for (const { id } of existing) {
          if (desiredIds.has(id)) continue
          transaction.update(scheduleOccurrences)
            .set({ deletedAt: row.updatedAt, updatedAt: row.updatedAt })
            .where(eq(scheduleOccurrences.id, id))
            .run()
        }
      })
      return { ok: true, value: schedule }
    } catch (error) {
      return { ok: false, error: persistenceError(error) }
    }
  }

  async findById(id: string): Promise<AppResult<ScheduleDetailDto | null>> {
    try {
      const row = this.database
        .select()
        .from(schedules)
        .where(eq(schedules.id, id))
        .get()
      return { ok: true, value: row === undefined ? null : scheduleRowToDetailDto(row) }
    } catch (error) {
      return { ok: false, error: persistenceError(error) }
    }
  }

  /** 按类型和标题过滤未删除日程，并按更新时间倒序分页。 */
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

  /** 软删除日程并同步更新时间。 */
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

  /** 更新收藏状态，并返回数据库中的最新日程。 */
  async setStarred(id: string, starred: boolean, updatedAt: string): Promise<AppResult<ScheduleDto>> {
    try {
      const changed = this.database.update(schedules)
        .set({ starred, updatedAt: new Date(updatedAt) }).where(eq(schedules.id, id)).run()
      if (changed.changes === 0) return { ok: false, error: { code: 'NOT_FOUND', message: '日程不存在' } }
      const row = this.database.select().from(schedules).where(eq(schedules.id, id)).get()!
      return { ok: true, value: scheduleRowToDto(row) }
    } catch (error) {
      return { ok: false, error: persistenceError(error) }
    }
  }

  /** 在同一事务中同步日程、occurrence 和专注记录的软删除状态。 */
  async setDeleted(id: string, deleted: boolean, updatedAt: string): Promise<AppResult<void>> {
    try {
      const timestamp = new Date(updatedAt)
      const changed = this.database.transaction((transaction) => {
        const result = transaction.update(schedules)
          .set({ deletedAt: deleted ? timestamp : null, updatedAt: timestamp })
          .where(eq(schedules.id, id)).run()
        transaction.update(scheduleOccurrences)
          .set({ deletedAt: deleted ? timestamp : null, updatedAt: timestamp })
          .where(eq(scheduleOccurrences.scheduleId, id)).run()
        transaction.update(concentrationRecords)
          .set({ deletedAt: deleted ? timestamp : null })
          .where(eq(concentrationRecords.scheduleId, id)).run()
        return result.changes
      })
      return changed === 0
        ? { ok: false, error: { code: 'NOT_FOUND', message: '日程不存在' } }
        : { ok: true, value: undefined }
    } catch (error) {
      return { ok: false, error: persistenceError(error) }
    }
  }

  /** 按数据库页筛选条件查询日程，并可进一步按 occurrence 时间范围过滤。 */
  async searchPage(query: ScheduleSearchQuery) {
    try {
      const conditions: SQL[] = []
      if (query.deleted !== undefined) {
        conditions.push(query.deleted ? isNotNull(schedules.deletedAt) : isNull(schedules.deletedAt))
      }
      if (query.kind !== undefined) conditions.push(eq(schedules.kind, query.kind))
      if (query.starred !== undefined) conditions.push(eq(schedules.starred, query.starred))
      if (query.search !== '') conditions.push(like(schedules.title, `%${query.search}%`))
      let rows = this.database.select().from(schedules).where(and(...conditions))
        .orderBy(desc(schedules.updatedAt)).all()
      if (query.start !== undefined || query.end !== undefined) {
        const occurrenceRows = this.database.select({ scheduleId: scheduleOccurrences.scheduleId, start: scheduleOccurrences.start, end: scheduleOccurrences.end })
          .from(scheduleOccurrences).where(isNull(scheduleOccurrences.deletedAt)).all()
        const ids = new Set(occurrenceRows.filter((value) =>
          (query.start === undefined || value.end.getTime() >= Date.parse(query.start)) &&
          (query.end === undefined || (value.start ?? value.end).getTime() <= Date.parse(query.end))
        ).map(({ scheduleId }) => scheduleId))
        rows = rows.filter(({ id }) => ids.has(id))
      }
      const total = rows.length
      const offset = (query.page - 1) * query.pageSize
      return {
        ok: true as const,
        value: {
          total,
          items: rows.slice(offset, offset + query.pageSize).map((row) => ({
            ...scheduleRowToDto(row), deleted: row.deletedAt !== null
          }))
        }
      }
    } catch (error) {
      return { ok: false as const, error: persistenceError(error) }
    }
  }
}
