import { z } from 'zod'

export const SettingsDtoSchema = z.object({
  timeZone: z.string().min(1).max(100),
  weekStart: z.union([z.literal(0), z.literal(1)]),
  todoAlarmEnabled: z.boolean(),
  todoAlarmBeforeMinutes: z.number().int().min(0).max(1440),
  eventAlarmEnabled: z.boolean(),
  eventAlarmBeforeMinutes: z.number().int().min(0).max(1440),
  calendarMode: z.enum(['month', 'week']),
  weekViewDays: z.number().int().min(1).max(7),
  logicalDayStartHour: z.number().int().min(0).max(23),
  logicalDayStartMinute: z.number().int().min(0).max(59),
  openAtLogin: z.boolean(),
  focusMinutes: z.number().int().positive().max(1440),
  smallBreakMinutes: z.number().int().positive().max(1440),
  bigBreakMinutes: z.number().int().positive().max(1440)
}).strict()

export const UpdateSettingsInputSchema = SettingsDtoSchema.partial().strict()

export type SettingsDto = z.infer<typeof SettingsDtoSchema>
export type UpdateSettingsInput = z.infer<typeof UpdateSettingsInputSchema>

export const defaultSettings: SettingsDto = Object.freeze({
  timeZone: 'UTC', weekStart: 1,
  todoAlarmEnabled: true, todoAlarmBeforeMinutes: 5,
  eventAlarmEnabled: true, eventAlarmBeforeMinutes: 5,
  calendarMode: 'month', weekViewDays: 5,
  logicalDayStartHour: 0, logicalDayStartMinute: 0,
  openAtLogin: false, focusMinutes: 25,
  smallBreakMinutes: 5, bigBreakMinutes: 20
})
