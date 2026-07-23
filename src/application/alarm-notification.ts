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
