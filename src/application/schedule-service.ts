import type { ScheduleGateway } from '../contracts/platform.contract'
import { CreateScheduleInputSchema, type ScheduleDto } from '../contracts/schedule.contract'
import { Schedule } from '../domain/schedule/schedule'
import type { Clock } from '../domain/shared/clock'
import type { IdGenerator } from '../domain/shared/id-generator'
import type { ScheduleRepository } from '../platform/ports'
import { expandScheduleOccurrences } from '../parser/parse-schedule'
import type { TimeZoneResolution } from '../parser/evaluator'

export interface ScheduleServiceDependencies {
  readonly clock: Clock
  readonly idGenerator: IdGenerator
  readonly defaultTimeZone?: string
  readonly weekStartsOn?: 1 | 2 | 3 | 4 | 5 | 6 | 7
  readonly resolveTimeZoneAbbreviation?: (value: string) => TimeZoneResolution
}

export class ScheduleService implements ScheduleGateway {
  constructor(
    private readonly repository: ScheduleRepository,
    private readonly dependencies: ScheduleServiceDependencies
  ) {}

  async create(input: Parameters<ScheduleGateway['create']>[0]) {
    const parsed = CreateScheduleInputSchema.safeParse(input)
    if (!parsed.success) {
      return {
        ok: false as const,
        error: { code: 'VALIDATION_FAILED' as const, message: '日程数据无效' }
      }
    }

    const schedule = Schedule.create(
      {
        kind: parsed.data.recurrenceCode === '' ? 'todo' : 'event',
        title: parsed.data.title,
        recurrenceCode: parsed.data.recurrenceCode,
        exclusionCode: parsed.data.exclusionCode,
        comment: parsed.data.comment
      },
      this.dependencies
    )
    const dto: ScheduleDto = {
      id: schedule.id,
      kind: schedule.kind,
      title: schedule.title,
      recurrenceCode: schedule.recurrence.recurrenceCode,
      exclusionCode: schedule.recurrence.exclusionCode,
      comment: schedule.comment,
      starred: schedule.starred,
      createdAt: schedule.createdAt.toString(),
      updatedAt: schedule.updatedAt.toString()
    }
    const {
      defaultTimeZone,
      weekStartsOn,
      resolveTimeZoneAbbreviation
    } = this.dependencies
    if (
      parsed.data.recurrenceCode.trim() === '' ||
      defaultTimeZone === undefined ||
      weekStartsOn === undefined ||
      resolveTimeZoneAbbreviation === undefined
    ) {
      return this.repository.save(dto)
    }

    const expanded = expandScheduleOccurrences(
      parsed.data.recurrenceCode,
      parsed.data.exclusionCode,
      {
        now: this.dependencies.clock.now(),
        defaultTimeZone,
        weekStartsOn,
        resolveTimeZoneAbbreviation
      }
    )
    if (!expanded.ok) {
      return {
        ok: false as const,
        error: { code: 'VALIDATION_FAILED' as const, message: '日程时间规则无效' }
      }
    }
    return this.repository.saveWithOccurrences(
      dto,
      expanded.value.map((occurrence) => ({
        ...occurrence,
        id: this.dependencies.idGenerator.next(),
        scheduleId: dto.id,
        kind: dto.kind,
        title: dto.title
      }))
    )
  }

  findById(id: string) {
    return this.repository.findById(id)
  }

  list(query: Parameters<ScheduleGateway['list']>[0]) {
    return this.repository.list(query)
  }
}
