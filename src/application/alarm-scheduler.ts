import type { ScheduleOccurrenceDto } from '../contracts/occurrence.contract'
import type { SettingsDto } from '../contracts/settings.contract'

export interface DueAlarm {
  readonly occurrence: ScheduleOccurrenceDto
  readonly alarmAt: string
}

export function dueAlarms(
  occurrences: readonly ScheduleOccurrenceDto[],
  settings: SettingsDto,
  now: string,
  pollingSeconds: number
): readonly DueAlarm[] {
  const start = Date.parse(now)
  const end = start + pollingSeconds * 1000
  return occurrences.flatMap((occurrence) => {
    const enabled = occurrence.kind === 'todo'
      ? settings.todoAlarmEnabled
      : settings.eventAlarmEnabled
    if (!enabled || occurrence.done || occurrence.excluded) return []
    const target = occurrence.kind === 'todo' ? occurrence.end : occurrence.start
    if (target === null) return []
    const before = occurrence.kind === 'todo'
      ? settings.todoAlarmBeforeMinutes
      : settings.eventAlarmBeforeMinutes
    const alarm = Date.parse(target) - before * 60_000
    return alarm > start && alarm <= end
      ? [{ occurrence, alarmAt: new Date(alarm).toISOString() }]
      : []
  })
}
