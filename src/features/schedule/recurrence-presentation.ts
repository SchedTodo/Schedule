export interface ScheduleDatePresentation {
  readonly dateKey: string
  readonly timeLabel: string
}

export function parseFirstScheduleDate(code: string): ScheduleDatePresentation | null {
  const match = /(\d{4})[-/](\d{1,2})[-/](\d{1,2})\s+(\d{1,2}):(\d{2})/.exec(code)
  if (!match) return null
  const [, year, month, day, hour, minute] = match
  if (!year || !month || !day || !hour || !minute) return null
  return {
    dateKey: `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`,
    timeLabel: `${hour.padStart(2, '0')}:${minute}`
  }
}
