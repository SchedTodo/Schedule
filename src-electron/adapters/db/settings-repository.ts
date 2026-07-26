import { eq } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'

import type { AppResult } from '../../../src/contracts/result'
import {
  defaultSettings,
  SettingsDtoSchema,
  UpdateSettingsInputSchema,
  type SettingsDto,
  type UpdateSettingsInput
} from '../../../src/contracts/settings.contract'
import { appSettings, databaseSchema } from './schema'

type ScheduleDatabase = BetterSQLite3Database<typeof databaseSchema>

/**
 * 使用 SQLite 单行 JSON 存储应用设置。
 *
 * 仓储在读取和更新边界执行 Zod 校验，并在首次读取时初始化默认设置。
 */
export class DrizzleSettingsRepository {
  constructor(private readonly database: ScheduleDatabase) {}

  /** 读取并校验设置；首次访问时写入默认设置。 */
  async get(): Promise<AppResult<SettingsDto>> {
    try {
      const row = this.database.select().from(appSettings).where(eq(appSettings.id, 1)).get()
      if (row === undefined) {
        this.database.insert(appSettings).values({ id: 1, value: JSON.stringify(defaultSettings), updatedAt: new Date() }).run()
        return { ok: true, value: defaultSettings }
      }
      return { ok: true, value: SettingsDtoSchema.parse(JSON.parse(row.value)) }
    } catch {
      return { ok: false, error: { code: 'PERSISTENCE_FAILED', message: '本地设置读取失败' } }
    }
  }

  /** 校验增量设置、与现值合并后执行 upsert。 */
  async update(input: UpdateSettingsInput): Promise<AppResult<SettingsDto>> {
    const parsed = UpdateSettingsInputSchema.safeParse(input)
    if (!parsed.success) return { ok: false, error: { code: 'VALIDATION_FAILED', message: '设置数据无效' } }
    const current = await this.get()
    if (!current.ok) return current
    const value = SettingsDtoSchema.parse({ ...current.value, ...parsed.data })
    try {
      this.database.insert(appSettings).values({ id: 1, value: JSON.stringify(value), updatedAt: new Date() })
        .onConflictDoUpdate({ target: appSettings.id, set: { value: JSON.stringify(value), updatedAt: new Date() } }).run()
      return { ok: true, value }
    } catch {
      return { ok: false, error: { code: 'PERSISTENCE_FAILED', message: '本地设置保存失败' } }
    }
  }
}
