import { z } from 'zod'

export const WeekStartSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
  z.literal(7)
])

export type WeekStart = z.infer<typeof WeekStartSchema>

const scheduleKeywords = new Set([
  'TDY', 'TMR', 'NOW', 'START', 'S', 'END', 'E',
  'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY',
  'BY', 'MONTH', 'WEEKNO', 'YEARDAY', 'MONTHDAY', 'DAY', 'SETPOS',
  'I', 'C', 'H', 'M', 'UTC'
])

function isValidTimeZone(value: string): boolean {
  if (value !== 'UTC' && !value.includes('/')) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(0)
    return true
  } catch {
    return false
  }
}

export const TimeZoneAbbreviationsSchema = z
  .record(z.string(), z.string())
  .default({})
  .superRefine((value, context) => {
    const normalized = new Set<string>()
    for (const [abbreviation, timeZone] of Object.entries(value)) {
      const key = abbreviation.toUpperCase()
      if (!/^[A-Z][A-Z0-9_]{0,31}$/u.test(key)) {
        context.addIssue({
          code: 'custom',
          message: 'Invalid time zone abbreviation',
          path: [abbreviation]
        })
      } else if (
        scheduleKeywords.has(key) ||
        /^[IC][0-9]+$/u.test(key) ||
        normalized.has(key)
      ) {
        context.addIssue({
          code: 'custom',
          message: 'Conflicting time zone abbreviation',
          path: [abbreviation]
        })
      }
      if (!isValidTimeZone(timeZone)) {
        context.addIssue({
          code: 'custom',
          message: 'Invalid abbreviation target time zone',
          path: [abbreviation]
        })
      }
      normalized.add(key)
    }
  })
  .transform((value) => Object.fromEntries(
    Object.entries(value).map(([abbreviation, timeZone]) => [
      abbreviation.toUpperCase(),
      timeZone
    ])
  ))

export const SettingsDtoSchema = z.object({
  timeZone: z.string().min(1).max(100),
  timeZoneAbbreviations: TimeZoneAbbreviationsSchema,
  weekStart: WeekStartSchema,
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
  timeZone: 'UTC', timeZoneAbbreviations: {}, weekStart: 1,
  todoAlarmEnabled: true, todoAlarmBeforeMinutes: 5,
  eventAlarmEnabled: true, eventAlarmBeforeMinutes: 5,
  calendarMode: 'month', weekViewDays: 5,
  logicalDayStartHour: 0, logicalDayStartMinute: 0,
  openAtLogin: false, focusMinutes: 25,
  smallBreakMinutes: 5, bigBreakMinutes: 20
})
