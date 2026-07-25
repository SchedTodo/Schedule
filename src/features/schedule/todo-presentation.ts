import { Temporal } from '../../domain/shared/temporal'

export type TodoTone = 'expired' | 'done' | 'today' | 'tomorrow' | 'future'

/** 按截止 instant、完成状态和用户时区计算 Todo 的展示色调。 */
export function todoTone(
  end: string,
  done: boolean,
  timeZone: string,
  now: Temporal.Instant = Temporal.Now.instant()
): TodoTone {
  const deadline = Temporal.Instant.from(end)
  if (Temporal.Instant.compare(deadline, now) < 0) return 'expired'
  if (done) return 'done'
  const today = now.toZonedDateTimeISO(timeZone).toPlainDate()
  const deadlineDate = deadline.toZonedDateTimeISO(timeZone).toPlainDate()
  const days = today.until(deadlineDate, { largestUnit: 'days' }).days
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  return 'future'
}

/** 将 Todo 截止 instant 格式化为指定时区中的月日和时分。 */
export function formatTodoDeadline(end: string, timeZone: string): string {
  const value = Temporal.Instant.from(end).toZonedDateTimeISO(timeZone)
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${pad(value.month)}-${pad(value.day)} ${pad(value.hour)}:${pad(value.minute)}`
}
