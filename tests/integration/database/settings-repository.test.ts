// @vitest-environment node

import { readFileSync } from 'node:fs'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { DrizzleSettingsRepository } from '../../../src-electron/adapters/db/settings-repository'

describe('DrizzleSettingsRepository', () => {
  let sqlite: Database.Database
  let repository: DrizzleSettingsRepository
  beforeEach(() => {
    sqlite = new Database(':memory:')
    sqlite.exec(readFileSync(new URL('../../../src-electron/adapters/db/migrations/0001_v2_schema.sql', import.meta.url), 'utf8'))
    sqlite.exec(readFileSync(new URL('../../../src-electron/adapters/db/migrations/0003_settings.sql', import.meta.url), 'utf8'))
    repository = new DrizzleSettingsRepository(drizzle(sqlite))
  })
  afterEach(() => sqlite.close())

  it('initializes defaults and persists validated updates', async () => {
    await expect(repository.get()).resolves.toMatchObject({ ok: true, value: { weekViewDays: 5 } })
    await repository.update({ timeZone: 'Asia/Shanghai', weekStart: 7, openAtLogin: true })
    await expect(repository.get()).resolves.toMatchObject({
      ok: true, value: { timeZone: 'Asia/Shanghai', weekStart: 7, openAtLogin: true }
    })
  })
})
