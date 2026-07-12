import { and, asc, eq, gte, isNull, lt } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'

import type {
  KnownTimeMark,
  OccurrenceRangeQuery,
  ScheduleOccurrenceDto
} from '../../../src/contracts/occurrence.contract'
import type { AppErrorDto, AppResult } from '../../../src/contracts/result'
import type { OccurrenceRepository } from '../../../src/platform/ports'
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
    message: '本地时间实例数据库操作失败',
    details: { cause: error instanceof Error ? error.message : String(error) }
  }
}

export class DrizzleOccurrenceRepository implements OccurrenceRepository {
  constructor(private readonly database: ScheduleDatabase) {}

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

  async listRange(query: OccurrenceRangeQuery): Promise<AppResult<readonly ScheduleOccurrenceDto[]>> {
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
          done: occurrence.done
        }))
      }
    } catch (error) {
      return { ok: false, error: persistenceError(error) }
    }
  }

  async listBySchedule(scheduleId: string): Promise<AppResult<readonly ScheduleOccurrenceDto[]>> {
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

  async updateComment(id: string, comment: string): Promise<AppResult<ScheduleOccurrenceDto>> {
    try {
      this.database.update(scheduleOccurrences).set({ comment, updatedAt: new Date() })
        .where(eq(scheduleOccurrences.id, id)).run()
      const row = this.database
        .select({ occurrence: scheduleOccurrences, schedule: schedules })
        .from(scheduleOccurrences)
        .innerJoin(schedules, eq(scheduleOccurrences.scheduleId, schedules.id))
        .where(eq(scheduleOccurrences.id, id)).get()
      if (row === undefined) return { ok: false, error: { code: 'NOT_FOUND', message: '时间实例不存在' } }
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

  async exclude(id: string): Promise<AppResult<void>> {
    try {
      const result = this.database.update(scheduleOccurrences)
        .set({ excluded: true, updatedAt: new Date() })
        .where(eq(scheduleOccurrences.id, id)).run()
      if (result.changes === 0) return { ok: false, error: { code: 'NOT_FOUND', message: '时间实例不存在' } }
      return { ok: true, value: undefined }
    } catch (error) {
      return { ok: false, error: persistenceError(error) }
    }
  }
}
