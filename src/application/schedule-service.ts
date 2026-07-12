import type { ScheduleGateway } from '../contracts/platform.contract'
import {
  CreateScheduleInputSchema,
  ScheduleSearchQuerySchema,
  SetScheduleDeletedInputSchema,
  SetScheduleStarredInputSchema,
  UpdateScheduleInputSchema,
  type ScheduleDto
} from '../contracts/schedule.contract'
import { Schedule } from '../domain/schedule/schedule'
import type { Clock } from '../domain/shared/clock'
import type { IdGenerator } from '../domain/shared/id-generator'
import type { OccurrenceRepository, ScheduleRepository } from '../platform/ports'
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
    private readonly dependencies: ScheduleServiceDependencies,
    private readonly occurrenceRepository?: OccurrenceRepository
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

  async update(input: Parameters<ScheduleGateway['update']>[0]) {
    const parsed = UpdateScheduleInputSchema.safeParse(input)
    if (!parsed.success) return { ok: false as const, error: { code: 'VALIDATION_FAILED' as const, message: '日程数据无效' } }
    const found = await this.repository.findById(parsed.data.id)
    if (!found.ok) return found
    if (found.value === null) return { ok: false as const, error: { code: 'NOT_FOUND' as const, message: '日程不存在' } }
    const kind = parsed.data.recurrenceCode === '' ? 'todo' : 'event'
    if (kind !== found.value.kind) return { ok: false as const, error: { code: 'VALIDATION_FAILED' as const, message: '不能更改日程类型' } }
    const now = this.dependencies.clock.now().toString()
    const updated: ScheduleDto = { ...found.value, ...parsed.data, kind, updatedAt: now }
    if (parsed.data.recurrenceCode === '' || this.dependencies.defaultTimeZone === undefined || this.dependencies.weekStartsOn === undefined || this.dependencies.resolveTimeZoneAbbreviation === undefined) {
      return this.repository.save(updated)
    }
    const expanded = expandScheduleOccurrences(parsed.data.recurrenceCode, parsed.data.exclusionCode, {
      now: this.dependencies.clock.now(),
      defaultTimeZone: this.dependencies.defaultTimeZone,
      weekStartsOn: this.dependencies.weekStartsOn,
      resolveTimeZoneAbbreviation: this.dependencies.resolveTimeZoneAbbreviation
    })
    if (!expanded.ok) return { ok: false as const, error: { code: 'VALIDATION_FAILED' as const, message: '日程时间规则无效' } }
    const existingResult = this.occurrenceRepository === undefined
      ? { ok: true as const, value: [] }
      : await this.occurrenceRepository.listBySchedule(parsed.data.id)
    if (!existingResult.ok) return existingResult
    const existing = new Map(existingResult.value.map((value) => [JSON.stringify([value.start, value.end, value.startMark, value.endMark]), value]))
    return this.repository.saveWithOccurrences(updated, expanded.value.map((value) => {
      const previous = existing.get(JSON.stringify([value.start, value.end, value.startMark, value.endMark]))
      return {
        ...value,
        id: previous?.id ?? this.dependencies.idGenerator.next(),
        scheduleId: updated.id,
        kind: updated.kind,
        title: updated.title,
        comment: previous?.comment ?? value.comment,
        done: previous?.done ?? value.done
      }
    }))
  }

  async setStarred(input: Parameters<ScheduleGateway['setStarred']>[0]) {
    const parsed = SetScheduleStarredInputSchema.safeParse(input)
    if (!parsed.success) return { ok: false as const, error: { code: 'VALIDATION_FAILED' as const, message: '收藏状态无效' } }
    return this.repository.setStarred(parsed.data.id, parsed.data.starred, this.dependencies.clock.now().toString())
  }

  async setDeleted(input: Parameters<ScheduleGateway['setDeleted']>[0]) {
    const parsed = SetScheduleDeletedInputSchema.safeParse(input)
    if (!parsed.success) return { ok: false as const, error: { code: 'VALIDATION_FAILED' as const, message: '删除状态无效' } }
    return this.repository.setDeleted(parsed.data.id, parsed.data.deleted, this.dependencies.clock.now().toString())
  }

  searchPage(query: Parameters<ScheduleGateway['searchPage']>[0]) {
    const parsed = ScheduleSearchQuerySchema.safeParse(query)
    if (!parsed.success) return Promise.resolve({ ok: false as const, error: { code: 'VALIDATION_FAILED' as const, message: '查询条件无效' } })
    return this.repository.searchPage(parsed.data)
  }
}
