// @vitest-environment node

import { readFileSync } from 'node:fs'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { DrizzleSettingsRepository } from '../../../src-electron/adapters/db/settings-repository'
import { defaultSettings } from '../../../src/contracts/settings.contract'

describe('DrizzleSettingsRepository', () => {
  let sqlite: Database.Database
  let repository: DrizzleSettingsRepository
  beforeEach(() => {
    sqlite = new Database(':memory:')
    sqlite.exec(readFileSync(new URL('../../../src-electron/adapters/db/schema.sql', import.meta.url), 'utf8'))
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

  it('defaults an abbreviation table when reading existing settings JSON', async () => {
    const existing = Object.fromEntries(
      Object.entries(defaultSettings)
        .filter(([key]) => key !== 'timeZoneAbbreviations')
    )
    sqlite.prepare(
      'INSERT INTO app_settings (id, value, updated_at) VALUES (1, ?, ?)'
    ).run(JSON.stringify(existing), Date.now())

    await expect(repository.get()).resolves.toMatchObject({
      ok: true,
      value: { timeZoneAbbreviations: {} }
    })
  })
})
