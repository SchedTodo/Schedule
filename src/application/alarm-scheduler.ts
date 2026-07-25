import type { ScheduleOccurrenceDto } from '../contracts/occurrence.contract'
import type { SettingsDto } from '../contracts/settings.contract'

export interface ScheduledAlarm {
  readonly occurrence: ScheduleOccurrenceDto
  readonly alarmAt: string
}

export type DueAlarm = ScheduledAlarm

/** 根据 occurrence 类型、完成状态和提醒设置生成有效的提醒计划。 */
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

/** 判断提醒触发点是否落在左开右闭的检查时间窗内。 */
export function isAlarmDue(
  alarm: ScheduledAlarm,
  previous: string,
  current: string
): boolean {
  const alarmTime = Date.parse(alarm.alarmAt)
  return alarmTime > Date.parse(previous) && alarmTime <= Date.parse(current)
}

/** 返回从指定时刻开始、给定轮询周期内到期的提醒。 */
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
