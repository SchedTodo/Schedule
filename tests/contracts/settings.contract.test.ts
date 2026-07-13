import { describe, expect, it } from 'vitest'

import { SettingsDtoSchema, defaultSettings } from '../../src/contracts/settings.contract'

describe('settings contract', () => {
  it('contains legacy-compatible defaults', () => {
    expect(SettingsDtoSchema.parse(defaultSettings)).toMatchObject({
      weekStart: 1,
      todoAlarmEnabled: true,
      todoAlarmBeforeMinutes: 5,
      eventAlarmEnabled: true,
      eventAlarmBeforeMinutes: 5,
      weekViewDays: 5,
      logicalDayStartHour: 0,
      logicalDayStartMinute: 0,
      openAtLogin: false,
      focusMinutes: 25,
      smallBreakMinutes: 5,
      bigBreakMinutes: 20
    })
  })

  it('rejects invalid settings and unknown fields', () => {
    expect(SettingsDtoSchema.safeParse({ ...defaultSettings, weekViewDays: 8 }).success).toBe(false)
    expect(SettingsDtoSchema.safeParse({ ...defaultSettings, extra: true }).success).toBe(false)
  })

  it('accepts exactly the seven ISO week starts', () => {
    for (const weekStart of [1, 2, 3, 4, 5, 6, 7]) {
      expect(SettingsDtoSchema.safeParse({ ...defaultSettings, weekStart }).success).toBe(true)
    }
    for (const weekStart of [0, 8]) {
      expect(SettingsDtoSchema.safeParse({ ...defaultSettings, weekStart }).success).toBe(false)
    }
  })
})
