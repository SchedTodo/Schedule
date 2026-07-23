import type { ScheduleOccurrenceDto } from '../contracts/occurrence.contract'
import type { SettingsDto } from '../contracts/settings.contract'

export interface ScheduledAlarm {
  readonly occurrence: ScheduleOccurrenceDto
  readonly alarmAt: string
}

export type DueAlarm = ScheduledAlarm

export function scheduledAlarms(
  occurrences: readonly ScheduleOccurrenceDto[],
  settings: SettingsDto
): readonly ScheduledAlarm[] {
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
    return [{
      occurrence,
      alarmAt: new Date(alarm).toISOString()
    }]
  })
}

export function alarmKey(alarm: ScheduledAlarm): string {
  return `${alarm.occurrence.id}:${alarm.alarmAt}`
}

export function isAlarmDue(
  alarm: ScheduledAlarm,
  previous: string,
  current: string
): boolean {
  const alarmTime = Date.parse(alarm.alarmAt)
  return alarmTime > Date.parse(previous) && alarmTime <= Date.parse(current)
}

export function dueAlarms(
  occurrences: readonly ScheduleOccurrenceDto[],
  settings: SettingsDto,
  now: string,
  pollingSeconds: number
): readonly DueAlarm[] {
  const start = Date.parse(now)
  const end = start + pollingSeconds * 1000
  return scheduledAlarms(occurrences, settings).filter((alarm) =>
    isAlarmDue(alarm, new Date(start).toISOString(), new Date(end).toISOString())
  )
}
