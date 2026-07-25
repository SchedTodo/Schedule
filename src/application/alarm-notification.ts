import type {
  KnownTimeMark,
  ScheduleOccurrenceDto
} from '../contracts/occurrence.contract'
import type { NotificationInput } from '../contracts/notification.contract'
import { Temporal } from '../domain/shared/temporal'
import type { ScheduledAlarm } from './alarm-scheduler'

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function localDate(instant: string, timeZone: string): string {
  const value = Temporal.Instant.from(instant).toZonedDateTimeISO(timeZone)
  return `${value.year}-${pad(value.month)}-${pad(value.day)}`
}

/** 按精度标记格式化本地时分，未知分量以问号显示。 */
function localMarkedTime(
  instant: string,
  mark: KnownTimeMark,
  timeZone: string
): string {
  const value = Temporal.Instant.from(instant).toZonedDateTimeISO(timeZone)
  const hour = mark[0] === '1' ? pad(value.hour) : '?'
  const minute = mark[1] === '1' ? pad(value.minute) : '?'
  return `${hour}:${minute}`
}

/** 按用户时区和时间精度标记，生成适合通知正文显示的 occurrence 时间范围。 */
function occurrenceTime(
  occurrence: ScheduleOccurrenceDto,
  timeZone: string
): string {
  const endDate = localDate(occurrence.end, timeZone)
  const endTime = localMarkedTime(occurrence.end, occurrence.endMark, timeZone)
  if (occurrence.kind === 'todo' || occurrence.start === null) {
    return `${endDate} ${endTime}`
  }

  const startDate = localDate(occurrence.start, timeZone)
  const startTime = localMarkedTime(
    occurrence.start,
    occurrence.startMark,
    timeZone
  )
  return startDate === endDate
    ? `${startDate} ${startTime}–${endTime}`
    : `${startDate} ${startTime}–${endDate} ${endTime}`
}

/** 将计划提醒转换为系统通知使用的标题和正文。 */
export function notificationForAlarm(
  alarm: ScheduledAlarm,
  timeZone: string
): NotificationInput {
  const type = alarm.occurrence.kind === 'todo' ? 'Todo' : 'Event'
  const time = occurrenceTime(alarm.occurrence, timeZone)
  const comment = alarm.occurrence.comment.trim()
  return {
    title: `${type}: ${alarm.occurrence.title}`,
    body: comment === '' ? time : `${comment}\n${time}`
  }
}
