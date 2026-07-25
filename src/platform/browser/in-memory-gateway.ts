import type { PlatformGateway } from '../../contracts/platform.contract'
import {
  ExcludeOccurrencesInputSchema,
  OccurrenceRangeQuerySchema,
  type ScheduleOccurrenceDto
} from '../../contracts/occurrence.contract'
import {
  CreateScheduleInputSchema,
  ScheduleSearchQuerySchema,
  ScheduleListQuerySchema,
  SetScheduleDeletedInputSchema,
  SetScheduleStarredInputSchema,
  UpdateScheduleInputSchema,
  type ScheduleDto
} from '../../contracts/schedule.contract'
import type { Clock } from '../../domain/shared/clock'
import { defaultSettings, SettingsDtoSchema, UpdateSettingsInputSchema } from '../../contracts/settings.contract'
import { CreateConcentrationRecordInputSchema, type ConcentrationRecordDto } from '../../contracts/record.contract'
import { NotificationInputSchema } from '../../contracts/notification.contract'
import { SystemClock } from '../../domain/shared/clock'
import type { IdGenerator } from '../../domain/shared/id-generator'
import { CryptoIdGenerator } from '../../domain/shared/id-generator'
import { todoLogicalDayRange } from '../../domain/schedule/logical-day'
import { serializeOccurrenceExclusion } from '../../features/schedule/occurrence-time'
import {
  expandScheduleOccurrences,
  normalizeScheduleOccurrences
} from '../../parser/parse-schedule'

export interface InMemoryGatewayDependencies {
  readonly clock: Clock
  readonly idGenerator: IdGenerator
}

const validationError = {
  code: 'VALIDATION_FAILED' as const,
  message: '日程数据无效'
}

/**
 * 创建供浏览器模式和测试使用的内存平台网关。
 *
 * 该实现遵循与宿主网关相同的契约，并在内存中维护日程、occurrence、设置和专注记录。
 */
export function createInMemoryGateway(
  seed: readonly ScheduleDto[] = [],
  dependencies: InMemoryGatewayDependencies = {
    clock: new SystemClock(),
    idGenerator: new CryptoIdGenerator()
  }
): PlatformGateway {
  const schedules = [...seed]
  const occurrences: ScheduleOccurrenceDto[] = []
  const deletedScheduleIds = new Set<string>()
  let settings = { ...defaultSettings }
  const records: ConcentrationRecordDto[] = []

  for (const schedule of seed) {
    if (schedule.recurrenceCode.trim() === '') continue
    const expanded = expandScheduleOccurrences(schedule.recurrenceCode, schedule.exclusionCode, {
      now: dependencies.clock.now(), defaultTimeZone: settings.timeZone, weekStartsOn: settings.weekStart,
      resolveTimeZoneAbbreviation: () => ({ kind: 'unknown' })
    })
    if (!expanded.ok) continue
    occurrences.push(...expanded.value.map((value) => ({
      ...value,
      id: dependencies.idGenerator.next(),
      scheduleId: schedule.id,
      kind: schedule.kind,
      title: schedule.title
    })))
  }

  function missing() {
    return { ok: false as const, error: { code: 'NOT_FOUND' as const, message: '日程不存在' } }
  }

  return {
    schedules: {
      /** 校验并创建日程，同时展开和保存其 occurrence。 */
      async create(input) {
        const parsed = CreateScheduleInputSchema.safeParse(input)
        if (!parsed.success) return { ok: false, error: validationError }

        const now = dependencies.clock.now().toString()
        const normalized = parsed.data.recurrenceCode === ''
          ? undefined
          : normalizeScheduleOccurrences(parsed.data.recurrenceCode, parsed.data.exclusionCode, {
            now: dependencies.clock.now(), defaultTimeZone: settings.timeZone, weekStartsOn: settings.weekStart,
            resolveTimeZoneAbbreviation: () => ({ kind: 'unknown' })
          })
        if (normalized !== undefined && !normalized.ok) return { ok: false, error: validationError }
        const normalizedValue = normalized?.ok === true ? normalized.value : undefined
        const schedule: ScheduleDto = {
          id: dependencies.idGenerator.next(),
          kind: normalizedValue?.kind ?? 'todo',
          title: parsed.data.title,
          recurrenceCode: normalizedValue?.recurrenceCode ?? '',
          exclusionCode: normalizedValue?.exclusionCode ?? '',
          comment: parsed.data.comment,
          starred: false,
          createdAt: now,
          updatedAt: now
        }
        schedules.push(schedule)
        if (normalizedValue !== undefined) {
          occurrences.push(...normalizedValue.occurrences.map((value) => ({
            ...value,
            id: dependencies.idGenerator.next(),
            scheduleId: schedule.id,
            kind: schedule.kind,
            title: schedule.title
          })))
        }
        return { ok: true, value: schedule }
      },

      async findById(id) {
        const schedule = schedules.find((value) => value.id === id)
        return {
          ok: true,
          value: schedule === undefined
            ? null
            : { ...schedule, deleted: deletedScheduleIds.has(id) }
        }
      },

      /** 按查询条件过滤未删除日程，并应用偏移量分页。 */
      async list(query) {
        const parsed = ScheduleListQuerySchema.safeParse(query)
        if (!parsed.success) return { ok: false, error: validationError }

        const { kind, search, offset, limit } = parsed.data
        const normalizedSearch = search?.toLocaleLowerCase()
        const matches = schedules.filter((schedule) => {
          if (deletedScheduleIds.has(schedule.id)) return false
          if (kind && schedule.kind !== kind) return false
          return normalizedSearch
            ? schedule.title.toLocaleLowerCase().includes(normalizedSearch)
            : true
        })
        return { ok: true, value: Object.freeze(matches.slice(offset, offset + limit)) }
      },

      /**
       * 更新日程及其 occurrence；时间身份未变化的实例会保留备注和完成状态。
       */
      async update(input) {
        const parsed = UpdateScheduleInputSchema.safeParse(input)
        if (!parsed.success) return { ok: false, error: validationError }
        const index = schedules.findIndex(({ id }) => id === parsed.data.id)
        const current = schedules[index]
        if (current === undefined || deletedScheduleIds.has(current.id)) return missing()
        const normalized = parsed.data.recurrenceCode === ''
          ? undefined
          : normalizeScheduleOccurrences(parsed.data.recurrenceCode, parsed.data.exclusionCode, {
            now: dependencies.clock.now(), defaultTimeZone: settings.timeZone, weekStartsOn: settings.weekStart,
            resolveTimeZoneAbbreviation: () => ({ kind: 'unknown' })
          })
        if (normalized !== undefined && !normalized.ok) return { ok: false, error: validationError }
        const normalizedValue = normalized?.ok === true ? normalized.value : undefined
        const nextKind: ScheduleDto['kind'] = normalizedValue?.kind ?? 'todo'
        if (nextKind !== current.kind) return { ok: false, error: validationError }
        const existing = occurrences.filter(({ scheduleId }) => scheduleId === current.id)
        const byKey = new Map(existing.map((value) => [
          JSON.stringify([value.start, value.end, value.startMark, value.endMark]), value
        ]))
        const nextOccurrences = (normalizedValue?.occurrences ?? []).map((value) => {
          const previous = byKey.get(JSON.stringify([value.start, value.end, value.startMark, value.endMark]))
          return {
            ...value,
            id: previous?.id ?? dependencies.idGenerator.next(),
            scheduleId: current.id,
            kind: current.kind,
            title: parsed.data.title,
            comment: previous?.comment ?? value.comment,
            done: previous?.done ?? value.done
          }
        })
        occurrences.splice(0, occurrences.length,
          ...occurrences.filter(({ scheduleId }) => scheduleId !== current.id), ...nextOccurrences)
        const updated: ScheduleDto = {
          ...current,
          title: parsed.data.title,
          recurrenceCode: normalizedValue?.recurrenceCode ?? '',
          exclusionCode: normalizedValue?.exclusionCode ?? '',
          comment: parsed.data.comment,
          updatedAt: dependencies.clock.now().toString()
        }
        schedules[index] = updated
        return { ok: true, value: updated }
      },

      async setStarred(input) {
        const parsed = SetScheduleStarredInputSchema.safeParse(input)
        if (!parsed.success) return { ok: false, error: validationError }
        const index = schedules.findIndex(({ id }) => id === parsed.data.id)
        const current = schedules[index]
        if (current === undefined) return missing()
        const updated = { ...current, starred: parsed.data.starred, updatedAt: dependencies.clock.now().toString() }
        schedules[index] = updated
        return { ok: true, value: updated }
      },

      async setDeleted(input) {
        const parsed = SetScheduleDeletedInputSchema.safeParse(input)
        if (!parsed.success) return { ok: false, error: validationError }
        if (!schedules.some(({ id }) => id === parsed.data.id)) return missing()
        if (parsed.data.deleted) deletedScheduleIds.add(parsed.data.id)
        else deletedScheduleIds.delete(parsed.data.id)
        return { ok: true, value: undefined }
      },

      /** 按删除、类型、收藏和关键字条件返回远程分页模型。 */
      async searchPage(query) {
        const parsed = ScheduleSearchQuerySchema.safeParse(query)
        if (!parsed.success) return { ok: false, error: validationError }
        const matches = schedules.filter((schedule) => {
          if (
            parsed.data.deleted !== undefined &&
            deletedScheduleIds.has(schedule.id) !== parsed.data.deleted
          ) return false
          if (parsed.data.kind && schedule.kind !== parsed.data.kind) return false
          if (parsed.data.starred !== undefined && schedule.starred !== parsed.data.starred) return false
          const search = parsed.data.search.toLocaleLowerCase()
          return search === '' || schedule.title.toLocaleLowerCase().includes(search) || schedule.comment.toLocaleLowerCase().includes(search)
        })
        const offset = (parsed.data.page - 1) * parsed.data.pageSize
        return {
          ok: true,
          value: {
            total: matches.length,
            items: matches.slice(offset, offset + parsed.data.pageSize).map((value) => ({
              ...value, deleted: deletedScheduleIds.has(value.id)
            }))
          }
        }
      }
    },
    occurrences: {
      /** 返回指定半开时间范围内可见、未完成的事件 occurrence。 */
      async listRange(query) {
        const parsed = OccurrenceRangeQuerySchema.safeParse(query)
        if (!parsed.success) return { ok: false, error: validationError }
        const start = Date.parse(parsed.data.start)
        const end = Date.parse(parsed.data.end)
        return {
          ok: true,
          value: occurrences
            .filter((value) =>
              !value.excluded && !value.done && value.start !== null &&
              Date.parse(value.start) >= start && Date.parse(value.start) < end
            )
            .sort((left, right) => Date.parse(left.start!) - Date.parse(right.start!))
            .slice(0, parsed.data.limit)
            .map((value) => ({
              ...value,
              scheduleComment: schedules.find(({ id }) => id === value.scheduleId)?.comment ?? ''
            }))
        }
      },
      async listVisibleBySchedule(scheduleId) {
        if (!schedules.some(({ id }) => id === scheduleId)) return missing()
        return {
          ok: true,
          value: occurrences.filter((value) => value.scheduleId === scheduleId && !value.excluded)
        }
      },
      async updateComment(id, comment) {
        const index = occurrences.findIndex((value) => value.id === id)
        const current = occurrences[index]
        if (current === undefined) return { ok: false, error: { code: 'NOT_FOUND', message: '时间实例不存在' } }
        const updated = { ...current, comment }
        occurrences[index] = updated
        return { ok: true, value: updated }
      },
      /** 批量排除同一日程的 occurrence，并把排除项追加到日程规则。 */
      async excludeMany(input) {
        const parsed = ExcludeOccurrencesInputSchema.safeParse(input)
        if (!parsed.success) return { ok: false, error: validationError }
        const selected = parsed.data.ids.map((id) => occurrences.find((value) => value.id === id))
        if (selected.some((value) => value === undefined)) {
          return { ok: false, error: { code: 'NOT_FOUND', message: '时间实例不存在' } }
        }
        const values = selected as ScheduleOccurrenceDto[]
        if (new Set(values.map(({ scheduleId }) => scheduleId)).size !== 1) {
          return { ok: false, error: validationError }
        }
        for (const current of values) {
          const index = occurrences.findIndex(({ id }) => id === current.id)
          occurrences[index] = { ...current, excluded: true }
        }
        const scheduleIndex = schedules.findIndex((value) => value.id === values[0]!.scheduleId)
        const schedule = schedules[scheduleIndex]
        if (schedule !== undefined) {
          const concrete = values.map(serializeOccurrenceExclusion).join(';')
          schedules[scheduleIndex] = {
            ...schedule,
            exclusionCode: schedule.exclusionCode === '' ? concrete : `${schedule.exclusionCode};${concrete}`,
            updatedAt: dependencies.clock.now().toString()
          }
        }
        return { ok: true, value: undefined }
      },
      /**
       * 返回逻辑日相关的 Todo：每个日程保留首个未过期实例，并补入窗口内其余实例。
       */
      async listTodos(query) {
        const { start: logicalStart, end: logicalEnd } = todoLogicalDayRange(query)
        const candidates = occurrences
          .filter((value) => value.kind === 'todo' && !value.excluded && Date.parse(value.end) >= logicalStart)
          .sort((left, right) => Date.parse(left.end) - Date.parse(right.end))
        const first = new Map<string, ScheduleOccurrenceDto>()
        for (const value of candidates) if (!first.has(value.scheduleId)) first.set(value.scheduleId, value)
        const result = new Map([...first.values()].map((value) => [value.id, value]))
        for (const value of candidates) {
          const end = Date.parse(value.end)
          if (end >= logicalStart && end <= logicalEnd) result.set(value.id, value)
        }
        return { ok: true, value: [...result.values()] }
      },
      async setDone(id, done) {
        const index = occurrences.findIndex((value) => value.id === id)
        const current = occurrences[index]
        if (current === undefined) return { ok: false, error: { code: 'NOT_FOUND', message: '时间实例不存在' } }
        const updated = { ...current, done }
        occurrences[index] = updated
        return { ok: true, value: updated }
      }
    },
    settings: {
      async get() {
        return { ok: true, value: settings }
      },
      /** 校验并合并设置；浏览器存储可用时同步持久化。 */
      async update(input) {
        const parsed = UpdateSettingsInputSchema.safeParse(input)
        if (!parsed.success) return { ok: false, error: validationError }
        settings = SettingsDtoSchema.parse({ ...settings, ...parsed.data })
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('schedule-v2-settings', JSON.stringify(settings))
        }
        return { ok: true, value: settings }
      }
    },
    records: {
      /** 校验并创建专注记录。 */
      async create(input) {
        const parsed = CreateConcentrationRecordInputSchema.safeParse(input)
        if (!parsed.success) return { ok: false, error: validationError }
        const record = { id: dependencies.idGenerator.next(), ...parsed.data }
        records.push(record)
        return { ok: true, value: record }
      },
      async listBySchedule(scheduleId) {
        return { ok: true, value: records.filter((value) => value.scheduleId === scheduleId) }
      },
      /** 删除指定专注记录，不存在时返回 NOT_FOUND。 */
      async delete(id) {
        const index = records.findIndex((value) => value.id === id)
        if (index < 0) return { ok: false, error: { code: 'NOT_FOUND', message: '专注记录不存在' } }
        records.splice(index, 1)
        return { ok: true, value: undefined }
      }
    },
    notifications: {
      async show(input) {
        const parsed = NotificationInputSchema.safeParse(input)
        return parsed.success
          ? { ok: true, value: undefined }
          : { ok: false, error: validationError }
      }
    }
  }
}
