import {
  and,
  asc,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  or
} from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'

import type {
  AlarmCandidateQuery,
  CalendarOccurrenceDto,
  ExcludeOccurrencesInput,
  KnownTimeMark,
  OccurrenceRangeQuery,
  ScheduleOccurrenceDto,
  StoredScheduleOccurrenceDto
} from '../../../src/contracts/occurrence.contract'
import { AlarmCandidateQuerySchema } from '../../../src/contracts/occurrence.contract'
import type { AppErrorDto, AppResult } from '../../../src/contracts/result'
import type { OccurrenceRepository } from '../../../src/platform/ports'
import { todoLogicalDayRange } from '../../../src/domain/schedule/logical-day'
import { serializeOccurrenceExclusion } from '../../../src/features/schedule/occurrence-time'
import { databaseSchema, scheduleOccurrences, schedules } from './schema'

type ScheduleDatabase = BetterSQLite3Database<typeof databaseSchema>

export interface StoredOccurrenceInput {
  readonly id: string
  readonly excluded: boolean
  readonly start: string | null
  readonly end: string
  readonly startMark: KnownTimeMark
  readonly endMark: KnownTimeMark
  readonly comment: string
  readonly done: boolean
  readonly deletedAt?: string
}

function persistenceError(error: unknown): AppErrorDto {
  return {
    code: 'PERSISTENCE_FAILED',
    messageKey: 'error.persistenceFailed',
    message: '本地时间实例数据库操作失败',
    details: { cause: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * 使用 Drizzle 和 SQLite 持久化日程 occurrence。
 *
 * 仓储负责数据库行与稳定 DTO 之间的映射，并实现可见范围、提醒候选、
 * 逻辑日 Todo、排除和实例级状态等查询与事务边界。
 */
export class DrizzleOccurrenceRepository implements OccurrenceRepository {
  constructor(private readonly database: ScheduleDatabase) {}

  /** 在事务中用给定集合完整替换某日程的 occurrence。 */
  async replaceForSchedule(
    scheduleId: string,
    values: readonly StoredOccurrenceInput[]
  ): Promise<AppResult<void>> {
    try {
      const now = new Date()
      this.database.transaction((transaction) => {
        transaction.delete(scheduleOccurrences).where(eq(scheduleOccurrences.scheduleId, scheduleId)).run()
        if (values.length === 0) return
        transaction.insert(scheduleOccurrences).values(values.map((value) => ({
          id: value.id,
          scheduleId,
          excluded: value.excluded,
          start: value.start === null ? null : new Date(value.start),
          end: new Date(value.end),
          startMark: value.startMark,
          endMark: value.endMark,
          comment: value.comment,
          done: value.done,
          deletedAt: value.deletedAt === undefined ? null : new Date(value.deletedAt),
          createdAt: now,
          updatedAt: now
        }))).run()
      })
      return { ok: true, value: undefined }
    } catch (error) {
      return { ok: false, error: persistenceError(error) }
    }
  }

  /** 查询半开时间范围内可见、未完成的事件 occurrence。 */
  async listRange(query: OccurrenceRangeQuery): Promise<AppResult<readonly CalendarOccurrenceDto[]>> {
    try {
      const rows = this.database
        .select({ occurrence: scheduleOccurrences, schedule: schedules })
        .from(scheduleOccurrences)
        .innerJoin(schedules, eq(scheduleOccurrences.scheduleId, schedules.id))
        .where(and(
          isNull(scheduleOccurrences.deletedAt),
          isNull(schedules.deletedAt),
          eq(scheduleOccurrences.excluded, false),
          eq(scheduleOccurrences.done, false),
          gte(scheduleOccurrences.start, new Date(query.start)),
          lt(scheduleOccurrences.start, new Date(query.end))
        ))
        .orderBy(asc(scheduleOccurrences.start))
        .limit(query.limit)
        .all()
      return {
        ok: true,
        value: rows.map(({ occurrence, schedule }) => ({
          id: occurrence.id,
          scheduleId: occurrence.scheduleId,
          kind: schedule.kind,
          title: schedule.title,
          excluded: occurrence.excluded,
          start: occurrence.start?.toISOString() ?? null,
          end: occurrence.end.toISOString(),
          startMark: occurrence.startMark,
          endMark: occurrence.endMark,
          comment: occurrence.comment,
          scheduleComment: schedule.comment,
          done: occurrence.done
        }))
      }
    } catch (error) {
      return { ok: false, error: persistenceError(error) }
    }
  }

  /** 查询可能在检查时刻至候选上界间触发的 Event 和 Todo 提醒候选。 */
  async listAlarmCandidates(
    query: AlarmCandidateQuery
  ): Promise<AppResult<readonly ScheduleOccurrenceDto[]>> {
    const parsed = AlarmCandidateQuerySchema.safeParse(query)
    if (!parsed.success) {
      return {
        ok: false,
        error: { code: 'VALIDATION_FAILED', messageKey: 'error.validationFailed', message: '提醒候选查询无效' }
      }
    }
    try {
      const rows = this.database
        .select({ occurrence: scheduleOccurrences, schedule: schedules })
        .from(scheduleOccurrences)
        .innerJoin(schedules, eq(scheduleOccurrences.scheduleId, schedules.id))
        .where(and(
          isNull(scheduleOccurrences.deletedAt),
          isNull(schedules.deletedAt),
          eq(scheduleOccurrences.excluded, false),
          eq(scheduleOccurrences.done, false),
          or(
            and(
              eq(schedules.kind, 'event'),
              isNotNull(scheduleOccurrences.start),
              gt(scheduleOccurrences.end, new Date(parsed.data.checkedAt)),
              lte(scheduleOccurrences.start, new Date(parsed.data.through))
            ),
            and(
              eq(schedules.kind, 'todo'),
              lte(scheduleOccurrences.end, new Date(parsed.data.through))
            )
          )
        ))
        .orderBy(asc(scheduleOccurrences.end))
        .all()
      return {
        ok: true,
        value: rows.map(({ occurrence, schedule }) => ({
          id: occurrence.id,
          scheduleId: occurrence.scheduleId,
          kind: schedule.kind,
          title: schedule.title,
          excluded: occurrence.excluded,
          start: occurrence.start?.toISOString() ?? null,
          end: occurrence.end.toISOString(),
          startMark: occurrence.startMark,
          endMark: occurrence.endMark,
          comment: occurrence.comment,
          done: occurrence.done
        }))
      }
    } catch (error) {
      return { ok: false, error: persistenceError(error) }
    }
  }

  /** 返回指定未删除日程中未排除、未删除的 occurrence。 */
  async listVisibleBySchedule(scheduleId: string): Promise<AppResult<readonly ScheduleOccurrenceDto[]>> {
    try {
      const rows = this.database
        .select({ occurrence: scheduleOccurrences, schedule: schedules })
        .from(scheduleOccurrences)
        .innerJoin(schedules, eq(scheduleOccurrences.scheduleId, schedules.id))
        .where(and(
          eq(scheduleOccurrences.scheduleId, scheduleId),
          eq(scheduleOccurrences.excluded, false),
          isNull(scheduleOccurrences.deletedAt),
          isNull(schedules.deletedAt)
        ))
        .orderBy(asc(scheduleOccurrences.end))
        .all()
      return { ok: true, value: rows.map(({ occurrence, schedule }) => ({
        id: occurrence.id,
        scheduleId: occurrence.scheduleId,
        kind: schedule.kind,
        title: schedule.title,
        excluded: occurrence.excluded,
        start: occurrence.start?.toISOString() ?? null,
        end: occurrence.end.toISOString(),
        startMark: occurrence.startMark,
        endMark: occurrence.endMark,
        comment: occurrence.comment,
        done: occurrence.done
      })) }
    } catch (error) {
      return { ok: false, error: persistenceError(error) }
    }
  }

  /** 返回指定日程的全部 occurrence，包括软删除记录，供重新展开时对账。 */
  async listAllBySchedule(
    scheduleId: string
  ): Promise<AppResult<readonly StoredScheduleOccurrenceDto[]>> {
    try {
      const rows = this.database
        .select({ occurrence: scheduleOccurrences, schedule: schedules })
        .from(scheduleOccurrences)
        .innerJoin(schedules, eq(scheduleOccurrences.scheduleId, schedules.id))
        .where(eq(scheduleOccurrences.scheduleId, scheduleId))
        .orderBy(asc(scheduleOccurrences.end))
        .all()
      return {
        ok: true,
        value: rows.map(({ occurrence, schedule }) => ({
          id: occurrence.id,
          scheduleId: occurrence.scheduleId,
          kind: schedule.kind,
          title: schedule.title,
          excluded: occurrence.excluded,
          start: occurrence.start?.toISOString() ?? null,
          end: occurrence.end.toISOString(),
          startMark: occurrence.startMark,
          endMark: occurrence.endMark,
          comment: occurrence.comment,
          done: occurrence.done,
          deleted: occurrence.deletedAt !== null
        }))
      }
    } catch (error) {
      return { ok: false, error: persistenceError(error) }
    }
  }

  /** 更新 occurrence 备注并返回联结日程信息后的最新 DTO。 */
  async updateComment(id: string, comment: string): Promise<AppResult<ScheduleOccurrenceDto>> {
    try {
      this.database.update(scheduleOccurrences).set({ comment, updatedAt: new Date() })
        .where(eq(scheduleOccurrences.id, id)).run()
      const row = this.database
        .select({ occurrence: scheduleOccurrences, schedule: schedules })
        .from(scheduleOccurrences)
        .innerJoin(schedules, eq(scheduleOccurrences.scheduleId, schedules.id))
        .where(eq(scheduleOccurrences.id, id)).get()
      if (row === undefined) return { ok: false, error: { code: 'NOT_FOUND', messageKey: 'error.notFound', message: '时间实例不存在' } }
      return { ok: true, value: {
        id: row.occurrence.id,
        scheduleId: row.occurrence.scheduleId,
        kind: row.schedule.kind,
        title: row.schedule.title,
        excluded: row.occurrence.excluded,
        start: row.occurrence.start?.toISOString() ?? null,
        end: row.occurrence.end.toISOString(),
        startMark: row.occurrence.startMark,
        endMark: row.occurrence.endMark,
        comment: row.occurrence.comment,
        done: row.occurrence.done
      } }
    } catch (error) {
      return { ok: false, error: persistenceError(error) }
    }
  }

  /** 原子排除同一日程的多个 occurrence，并把具体时间追加到排除规则。 */
  async excludeMany(input: ExcludeOccurrencesInput): Promise<AppResult<void>> {
    try {
      return this.database.transaction((transaction): AppResult<void> => {
        const rows = transaction
          .select({ occurrence: scheduleOccurrences, schedule: schedules })
          .from(scheduleOccurrences)
          .innerJoin(schedules, eq(scheduleOccurrences.scheduleId, schedules.id))
          .where(inArray(scheduleOccurrences.id, input.ids))
          .all()
        if (rows.length !== input.ids.length) {
          return { ok: false, error: { code: 'NOT_FOUND', messageKey: 'error.notFound', message: '时间实例不存在' } }
        }
        if (new Set(rows.map(({ occurrence }) => occurrence.scheduleId)).size !== 1) {
          return { ok: false, error: { code: 'VALIDATION_FAILED', messageKey: 'error.validationFailed', message: '所选时间不属于同一日程' } }
        }
        const now = new Date()
        transaction.update(scheduleOccurrences)
          .set({ excluded: true, updatedAt: now })
          .where(inArray(scheduleOccurrences.id, input.ids))
          .run()
        const schedule = rows[0]!.schedule
        const concrete = rows.map(({ occurrence }) => serializeOccurrenceExclusion({
          id: occurrence.id,
          scheduleId: occurrence.scheduleId,
          kind: schedule.kind,
          title: schedule.title,
          excluded: occurrence.excluded,
          start: occurrence.start?.toISOString() ?? null,
          end: occurrence.end.toISOString(),
          startMark: occurrence.startMark,
          endMark: occurrence.endMark,
          comment: occurrence.comment,
          done: occurrence.done
        })).join(';')
        transaction.update(schedules).set({
          exclusionCode: schedule.exclusionCode === ''
            ? concrete
            : `${schedule.exclusionCode};${concrete}`,
          updatedAt: now
        }).where(eq(schedules.id, schedule.id)).run()
        return { ok: true, value: undefined }
      })
    } catch (error) {
      return { ok: false, error: persistenceError(error) }
    }
  }

  /**
   * 返回逻辑日相关的 Todo：每个日程保留首个未过期实例，并补入窗口内其余实例。
   */
  async listTodos(query: import('../../../src/contracts/occurrence.contract').TodoOccurrenceQuery): Promise<AppResult<readonly ScheduleOccurrenceDto[]>> {
    try {
      const { start: logicalStart, end: logicalEnd } = todoLogicalDayRange(query)
      const rows = this.database
        .select({ occurrence: scheduleOccurrences, schedule: schedules })
        .from(scheduleOccurrences)
        .innerJoin(schedules, eq(scheduleOccurrences.scheduleId, schedules.id))
        .where(and(
          eq(schedules.kind, 'todo'), eq(scheduleOccurrences.excluded, false),
          isNull(scheduleOccurrences.deletedAt), isNull(schedules.deletedAt),
          gte(scheduleOccurrences.end, new Date(logicalStart))
        ))
        .orderBy(asc(scheduleOccurrences.end)).all()
        .map(({ occurrence, schedule }) => ({
          id: occurrence.id, scheduleId: occurrence.scheduleId, kind: schedule.kind,
          title: schedule.title, excluded: occurrence.excluded,
          start: occurrence.start?.toISOString() ?? null, end: occurrence.end.toISOString(),
          startMark: occurrence.startMark, endMark: occurrence.endMark,
          comment: occurrence.comment, done: occurrence.done
        }))
      const first = new Map<string, ScheduleOccurrenceDto>()
      for (const value of rows) if (!first.has(value.scheduleId)) first.set(value.scheduleId, value)
      const result = new Map([...first.values()].map((value) => [value.id, value]))
      for (const value of rows) {
        const end = Date.parse(value.end)
        if (end >= logicalStart && end <= logicalEnd) result.set(value.id, value)
      }
      return { ok: true, value: [...result.values()] }
    } catch (error) {
      return { ok: false, error: persistenceError(error) }
    }
  }

  /** 更新 occurrence 完成状态并返回最新 DTO。 */
  async setDone(id: string, done: boolean): Promise<AppResult<ScheduleOccurrenceDto>> {
    try {
      const changed = this.database.update(scheduleOccurrences).set({ done, updatedAt: new Date() })
        .where(eq(scheduleOccurrences.id, id)).run()
      if (changed.changes === 0) return { ok: false, error: { code: 'NOT_FOUND', messageKey: 'error.notFound', message: '时间实例不存在' } }
      const listed = this.database.select({ occurrence: scheduleOccurrences, schedule: schedules })
        .from(scheduleOccurrences).innerJoin(schedules, eq(scheduleOccurrences.scheduleId, schedules.id))
        .where(eq(scheduleOccurrences.id, id)).get()!
      return { ok: true, value: {
        id: listed.occurrence.id, scheduleId: listed.occurrence.scheduleId,
        kind: listed.schedule.kind, title: listed.schedule.title,
        excluded: listed.occurrence.excluded, start: listed.occurrence.start?.toISOString() ?? null,
        end: listed.occurrence.end.toISOString(), startMark: listed.occurrence.startMark,
        endMark: listed.occurrence.endMark, comment: listed.occurrence.comment, done: listed.occurrence.done
      } }
    } catch (error) {
      return { ok: false, error: persistenceError(error) }
    }
  }
}
