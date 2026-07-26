import { and, asc, eq, isNull } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'

import type { AppResult } from '../../../src/contracts/result'
import { CreateConcentrationRecordInputSchema, type ConcentrationRecordDto, type CreateConcentrationRecordInput } from '../../../src/contracts/record.contract'
import type { IdGenerator } from '../../../src/domain/shared/id-generator'
import { concentrationRecords, databaseSchema } from './schema'

type ScheduleDatabase = BetterSQLite3Database<typeof databaseSchema>

/** 使用 Drizzle 和 SQLite 持久化、查询及软删除 Todo 专注记录。 */
export class DrizzleRecordRepository {
  constructor(private readonly database: ScheduleDatabase, private readonly ids: IdGenerator) {}
  /** 校验并持久化一条新的专注记录。 */
  async create(input: CreateConcentrationRecordInput): Promise<AppResult<ConcentrationRecordDto>> {
    const parsed = CreateConcentrationRecordInputSchema.safeParse(input)
    if (!parsed.success) return { ok: false, error: { code: 'VALIDATION_FAILED', message: '专注记录无效' } }
    const value = { id: this.ids.next(), ...parsed.data }
    try {
      this.database.insert(concentrationRecords).values({
        id: value.id, scheduleId: value.scheduleId,
        start: new Date(value.start), end: new Date(value.end), deletedAt: null
      }).run()
      return { ok: true, value }
    } catch { return { ok: false, error: { code: 'PERSISTENCE_FAILED', message: '专注记录保存失败' } } }
  }
  /** 按开始时间升序返回指定日程的未删除专注记录。 */
  async listBySchedule(scheduleId: string): Promise<AppResult<readonly ConcentrationRecordDto[]>> {
    try {
      const rows = this.database.select().from(concentrationRecords)
        .where(and(eq(concentrationRecords.scheduleId, scheduleId), isNull(concentrationRecords.deletedAt)))
        .orderBy(asc(concentrationRecords.start)).all()
      return { ok: true, value: rows.map((row) => ({
        id: row.id, scheduleId: row.scheduleId,
        start: row.start.toISOString(), end: row.end.toISOString()
      })) }
    } catch { return { ok: false, error: { code: 'PERSISTENCE_FAILED', message: '专注记录读取失败' } } }
  }
  /** 软删除指定专注记录。 */
  async delete(id: string): Promise<AppResult<void>> {
    try {
      const result = this.database.update(concentrationRecords).set({ deletedAt: new Date() })
        .where(eq(concentrationRecords.id, id)).run()
      return result.changes === 0
        ? { ok: false, error: { code: 'NOT_FOUND', message: '专注记录不存在' } }
        : { ok: true, value: undefined }
    } catch { return { ok: false, error: { code: 'PERSISTENCE_FAILED', message: '专注记录删除失败' } } }
  }
}
