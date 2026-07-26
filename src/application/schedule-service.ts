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
import {
  normalizeScheduleOccurrences,
  type NormalizedScheduleOccurrences
} from '../parser/parse-schedule'
import type { TimeZoneResolution } from '../parser/evaluator'

export interface ScheduleServiceDependencies {
  readonly clock: Clock
  readonly idGenerator: IdGenerator
  readonly defaultTimeZone?: string
  readonly weekStartsOn?: 1 | 2 | 3 | 4 | 5 | 6 | 7
  readonly resolveTimeZoneAbbreviation?: (value: string) => TimeZoneResolution
}

/**
 * 执行日程相关的应用用例，并实现渲染进程使用的日程网关。
 *
 * 服务负责输入校验、领域实体创建、时间规则规范化及 occurrence 对账；
 * 实际持久化由注入的仓储完成，因此该层不依赖 Electron 或数据库实现。
 */
export class ScheduleService implements ScheduleGateway {
  constructor(
    private readonly repository: ScheduleRepository,
    private readonly dependencies: ScheduleServiceDependencies,
    private readonly occurrenceRepository?: OccurrenceRepository
  ) {}

  /**
   * 校验并创建日程；存在时间规则时同步规范化规则并原子保存展开后的 occurrence。
   */
  async create(input: Parameters<ScheduleGateway['create']>[0]) {
    const parsed = CreateScheduleInputSchema.safeParse(input)
    if (!parsed.success) {
      return {
        ok: false as const,
        error: { code: 'VALIDATION_FAILED' as const, message: '日程数据无效' }
      }
    }

    let kind: 'event' | 'todo' = parsed.data.recurrenceCode === '' ? 'todo' : 'event'
    let normalized: NormalizedScheduleOccurrences | undefined
    if (
      parsed.data.recurrenceCode !== '' &&
      this.dependencies.defaultTimeZone !== undefined &&
      this.dependencies.weekStartsOn !== undefined &&
      this.dependencies.resolveTimeZoneAbbreviation !== undefined
    ) {
      const result = normalizeScheduleOccurrences(parsed.data.recurrenceCode, parsed.data.exclusionCode, {
        now: this.dependencies.clock.now(),
        defaultTimeZone: this.dependencies.defaultTimeZone,
        weekStartsOn: this.dependencies.weekStartsOn,
        resolveTimeZoneAbbreviation: this.dependencies.resolveTimeZoneAbbreviation
      })
      if (!result.ok) {
        return { ok: false as const, error: { code: 'VALIDATION_FAILED' as const, message: '日程时间规则无效' } }
      }
      normalized = result.value
      kind = result.value.kind
    }

    const schedule = Schedule.create(
      {
        kind,
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
      recurrenceCode: normalized?.recurrenceCode ?? schedule.recurrence.recurrenceCode,
      exclusionCode: normalized?.exclusionCode ?? schedule.recurrence.exclusionCode,
      comment: schedule.comment,
      starred: schedule.starred,
      createdAt: schedule.createdAt.toString(),
      updatedAt: schedule.updatedAt.toString()
    }
    if (normalized === undefined) {
      return this.repository.save(dto)
    }
    return this.repository.saveWithOccurrences(
      dto,
      normalized.occurrences.map((occurrence) => ({
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

  /**
   * 更新未删除的日程，并在规则变化时重新展开 occurrence。
   *
   * 与旧 occurrence 时间键一致的记录会保留 ID、备注和完成状态，避免编辑规则时
   * 丢失用户已经写入的实例级数据。
   */
  async update(input: Parameters<ScheduleGateway['update']>[0]) {
    const parsed = UpdateScheduleInputSchema.safeParse(input)
    if (!parsed.success) return { ok: false as const, error: { code: 'VALIDATION_FAILED' as const, message: '日程数据无效' } }
    const found = await this.repository.findById(parsed.data.id)
    if (!found.ok) return found
    if (found.value === null) return { ok: false as const, error: { code: 'NOT_FOUND' as const, message: '日程不存在' } }
    const { deleted, ...current } = found.value
    if (deleted) {
      return { ok: false as const, error: { code: 'VALIDATION_FAILED' as const, message: '不能修改已删除的日程' } }
    }
    let kind: 'event' | 'todo' = parsed.data.recurrenceCode === '' ? 'todo' : found.value.kind
    let normalized: NormalizedScheduleOccurrences | undefined
    if (parsed.data.recurrenceCode !== '' && this.dependencies.defaultTimeZone !== undefined && this.dependencies.weekStartsOn !== undefined && this.dependencies.resolveTimeZoneAbbreviation !== undefined) {
      const result = normalizeScheduleOccurrences(parsed.data.recurrenceCode, parsed.data.exclusionCode, {
        now: this.dependencies.clock.now(), defaultTimeZone: this.dependencies.defaultTimeZone,
        weekStartsOn: this.dependencies.weekStartsOn,
        resolveTimeZoneAbbreviation: this.dependencies.resolveTimeZoneAbbreviation
      })
      if (!result.ok) return { ok: false as const, error: { code: 'VALIDATION_FAILED' as const, message: '日程时间规则无效' } }
      normalized = result.value
      kind = result.value.kind
    }
    if (kind !== found.value.kind) return { ok: false as const, error: { code: 'VALIDATION_FAILED' as const, message: '不能更改日程类型' } }
    const now = this.dependencies.clock.now().toString()
    const updated: ScheduleDto = {
      ...current,
      ...parsed.data,
      recurrenceCode: normalized?.recurrenceCode ?? parsed.data.recurrenceCode,
      exclusionCode: normalized?.exclusionCode ?? parsed.data.exclusionCode,
      kind,
      updatedAt: now
    }
    if (normalized === undefined) {
      return this.repository.save(updated)
    }
    const existingResult = this.occurrenceRepository === undefined
      ? { ok: true as const, value: [] }
      : await this.occurrenceRepository.listAllBySchedule(parsed.data.id)
    if (!existingResult.ok) return existingResult
    const existing = new Map(existingResult.value.map((value) => [JSON.stringify([value.start, value.end, value.startMark, value.endMark]), value]))
    return this.repository.saveWithOccurrences(updated, normalized.occurrences.map((value) => {
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

  /** 校验收藏请求，并禁止收藏已经软删除的日程。 */
  async setStarred(input: Parameters<ScheduleGateway['setStarred']>[0]) {
    const parsed = SetScheduleStarredInputSchema.safeParse(input)
    if (!parsed.success) return { ok: false as const, error: { code: 'VALIDATION_FAILED' as const, message: '收藏状态无效' } }
    const found = await this.repository.findById(parsed.data.id)
    if (!found.ok) return found
    if (found.value === null) return { ok: false as const, error: { code: 'NOT_FOUND' as const, message: '日程不存在' } }
    if (found.value.deleted) {
      return { ok: false as const, error: { code: 'VALIDATION_FAILED' as const, message: '不能收藏已删除的日程' } }
    }
    return this.repository.setStarred(parsed.data.id, parsed.data.starred, this.dependencies.clock.now().toString())
  }

  /** 校验并更新日程的软删除状态。 */
  async setDeleted(input: Parameters<ScheduleGateway['setDeleted']>[0]) {
    const parsed = SetScheduleDeletedInputSchema.safeParse(input)
    if (!parsed.success) return { ok: false as const, error: { code: 'VALIDATION_FAILED' as const, message: '删除状态无效' } }
    return this.repository.setDeleted(parsed.data.id, parsed.data.deleted, this.dependencies.clock.now().toString())
  }

  /** 校验分页搜索条件后交由仓储执行查询。 */
  searchPage(query: Parameters<ScheduleGateway['searchPage']>[0]) {
    const parsed = ScheduleSearchQuerySchema.safeParse(query)
    if (!parsed.success) return Promise.resolve({ ok: false as const, error: { code: 'VALIDATION_FAILED' as const, message: '查询条件无效' } })
    return this.repository.searchPage(parsed.data)
  }
}
