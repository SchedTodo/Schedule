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

export function scheduleColor(scheduleId: string): string {
  let hash = 0
  for (const character of scheduleId) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  }
  return colors[hash % colors.length]!
}
