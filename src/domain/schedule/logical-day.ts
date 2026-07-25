import type { TodoOccurrenceQuery } from '../../contracts/occurrence.contract'
import { Temporal } from '../shared/temporal'

/**
 * 计算 Todo 查询使用的逻辑日时间窗。
 *
 * 时间窗覆盖“昨天逻辑日起点”到“明天逻辑日起点”，以容纳跨自然日的当前逻辑日。
 */
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
