import type { Temporal } from '../shared/temporal'
import type { Clock } from '../shared/clock'
import type { IdGenerator } from '../shared/id-generator'
import type { RecurrenceSpec } from './recurrence'

export type ScheduleKind = 'event' | 'todo'

export interface CreateSchedule {
  readonly kind: ScheduleKind
  readonly title: string
  readonly recurrenceCode: string
  readonly exclusionCode: string
  readonly comment: string
}

export interface ScheduleDependencies {
  readonly clock: Clock
  readonly idGenerator: IdGenerator
}

export class Schedule {
  readonly id: string
  readonly kind: ScheduleKind
  readonly title: string
  readonly recurrence: RecurrenceSpec
  readonly comment: string
  readonly starred: boolean
  readonly createdAt: Temporal.Instant
  readonly updatedAt: Temporal.Instant

  private constructor(
    input: CreateSchedule,
    id: string,
    now: Temporal.Instant
  ) {
    this.id = id
    this.kind = input.kind
    this.title = input.title.trim()
    this.recurrence = Object.freeze({
      recurrenceCode: input.recurrenceCode,
      exclusionCode: input.exclusionCode
    })
    this.comment = input.comment
    this.starred = false
    this.createdAt = now
    this.updatedAt = now
    Object.freeze(this)
  }

  /** 校验标题并使用注入的时钟与 ID 生成器创建不可变日程实体。 */
  static create(input: CreateSchedule, dependencies: ScheduleDependencies): Schedule {
    if (input.title.trim().length === 0) {
      throw new Error('SCHEDULE_TITLE_EMPTY')
    }

    const now = dependencies.clock.now()
    return new Schedule(input, dependencies.idGenerator.next(), now)
  }
}
