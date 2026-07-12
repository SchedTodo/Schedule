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
})
