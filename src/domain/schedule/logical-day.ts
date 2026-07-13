import type { TodoOccurrenceQuery } from '../../contracts/occurrence.contract'
import { Temporal } from '../shared/temporal'

export function todoLogicalDayRange(query: TodoOccurrenceQuery): {
  readonly start: number
  readonly end: number
} {
  const zonedNow = Temporal.Instant.from(query.now).toZonedDateTimeISO(query.timeZone)
  const logicalStartToday = zonedNow.toPlainDate().toZonedDateTime({
    timeZone: query.timeZone,
    plainTime: Temporal.PlainTime.from({
      hour: query.logicalDayStartHour,
      minute: query.logicalDayStartMinute
    })
  })
  return {
    start: logicalStartToday.subtract({ days: 1 }).toInstant().epochMilliseconds,
    end: logicalStartToday.add({ days: 1 }).toInstant().epochMilliseconds
  }
}
