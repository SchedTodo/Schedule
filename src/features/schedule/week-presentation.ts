import type { CalendarOccurrenceDto } from '../../contracts/occurrence.contract'
import { Temporal } from '../../domain/shared/temporal'

const colors = [
  '#f56c6c',
  '#e6a23c',
  '#409eff',
  '#67c23a',
  '#909399',
  '#FFC0CB',
  '#E6E6FA',
  '#00BFFF',
  '#FF7F50',
  '#98FB98',
  '#87CEEB',
  '#FFFF00',
  '#800080',
  '#FFB6C1',
  '#808000'
] as const

/** 根据用户配置的逻辑日起点，将 instant 归属到对应的逻辑日期。 */
export function logicalDateForInstant(
  instant: string,
  timeZone: string,
  startHour: number,
  startMinute: number
): string {
  const wall = Temporal.Instant.from(instant).toZonedDateTimeISO(timeZone)
  const beforeStart =
    wall.hour < startHour || (wall.hour === startHour && wall.minute < startMinute)
  return wall.toPlainDate().subtract({ days: beforeStart ? 1 : 0 }).toString()
}

export interface WeekEventSegment {
  readonly item: CalendarOccurrenceDto
  readonly key: string
  readonly logicalDate: string
  readonly startMinutes: number
  readonly durationMinutes: number
}

function logicalDayBoundary(
  logicalDate: string,
  timeZone: string,
  startHour: number,
  startMinute: number
): number {
  return Temporal.PlainDate.from(logicalDate)
    .toZonedDateTime({
      timeZone,
      plainTime: Temporal.PlainTime.from({ hour: startHour, minute: startMinute })
    })
    .toInstant()
    .epochMilliseconds
}

/** 将 occurrence 按配置的逻辑日边界拆分为周视图卡片。 */
export function weekSegmentsForOccurrence(
  item: CalendarOccurrenceDto,
  timeZone: string,
  startHour: number,
  startMinute: number
): readonly WeekEventSegment[] {
  if (item.start === null) return []

  const start = Temporal.Instant.from(item.start).epochMilliseconds
  const end = Temporal.Instant.from(item.end).epochMilliseconds
  let logicalDate = logicalDateForInstant(item.start, timeZone, startHour, startMinute)
  const firstBoundary = logicalDayBoundary(logicalDate, timeZone, startHour, startMinute)

  if (start === end) {
    return [{
      item,
      key: `${item.id}:${logicalDate}`,
      logicalDate,
      startMinutes: (start - firstBoundary) / 60_000,
      durationMinutes: 0
    }]
  }

  const segments: WeekEventSegment[] = []
  let segmentStart = start
  while (segmentStart < end) {
    const boundary = logicalDayBoundary(logicalDate, timeZone, startHour, startMinute)
    const nextDate = Temporal.PlainDate.from(logicalDate).add({ days: 1 }).toString()
    const nextBoundary = logicalDayBoundary(nextDate, timeZone, startHour, startMinute)
    const segmentEnd = Math.min(end, nextBoundary)
    segments.push({
      item,
      key: `${item.id}:${logicalDate}`,
      logicalDate,
      startMinutes: (segmentStart - boundary) / 60_000,
      durationMinutes: (segmentEnd - segmentStart) / 60_000
    })
    segmentStart = segmentEnd
    logicalDate = nextDate
  }
  return segments
}

/** 将日程 ID 稳定映射到固定调色板，保证跨渲染颜色一致。 */
export function scheduleColor(scheduleId: string): string {
  let hash = 0
  for (const character of scheduleId) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  }
  return colors[hash % colors.length]!
}
