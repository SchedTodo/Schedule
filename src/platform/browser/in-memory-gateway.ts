import type { PlatformGateway } from '../../contracts/platform.contract'
import {
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
import { SystemClock } from '../../domain/shared/clock'
import type { IdGenerator } from '../../domain/shared/id-generator'
import { CryptoIdGenerator } from '../../domain/shared/id-generator'
import { expandScheduleOccurrences } from '../../parser/parse-schedule'

export interface InMemoryGatewayDependencies {
  readonly clock: Clock
  readonly idGenerator: IdGenerator
}

const validationError = {
  code: 'VALIDATION_FAILED' as const,
  message: '日程数据无效'
}

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

  function missing() {
    return { ok: false as const, error: { code: 'NOT_FOUND' as const, message: '日程不存在' } }
  }

  return {
    schedules: {
      async create(input) {
        const parsed = CreateScheduleInputSchema.safeParse(input)
        if (!parsed.success) return { ok: false, error: validationError }

        const now = dependencies.clock.now().toString()
        const schedule: ScheduleDto = {
          id: dependencies.idGenerator.next(),
          kind: parsed.data.recurrenceCode === '' ? 'todo' : 'event',
          title: parsed.data.title,
          recurrenceCode: parsed.data.recurrenceCode,
          exclusionCode: parsed.data.exclusionCode,
          comment: parsed.data.comment,
          starred: false,
          createdAt: now,
          updatedAt: now
        }
        schedules.push(schedule)
        if (parsed.data.recurrenceCode.trim() !== '') {
          const expanded = expandScheduleOccurrences(
            parsed.data.recurrenceCode,
            parsed.data.exclusionCode,
            {
              now: dependencies.clock.now(),
              defaultTimeZone: 'UTC',
              weekStartsOn: 1,
              resolveTimeZoneAbbreviation: () => ({ kind: 'unknown' })
            }
          )
          if (!expanded.ok) return { ok: false, error: validationError }
          occurrences.push(...expanded.value.map((value) => ({
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
        return {
          ok: true,
          value: deletedScheduleIds.has(id)
            ? null
            : schedules.find((schedule) => schedule.id === id) ?? null
        }
      },

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

      async update(input) {
        const parsed = UpdateScheduleInputSchema.safeParse(input)
        if (!parsed.success) return { ok: false, error: validationError }
        const index = schedules.findIndex(({ id }) => id === parsed.data.id)
        const current = schedules[index]
        if (current === undefined || deletedScheduleIds.has(current.id)) return missing()
        const nextKind = parsed.data.recurrenceCode === '' ? 'todo' : 'event'
        if (nextKind !== current.kind) return { ok: false, error: validationError }
        const expanded = parsed.data.recurrenceCode === ''
          ? { ok: true as const, value: [] }
          : expandScheduleOccurrences(parsed.data.recurrenceCode, parsed.data.exclusionCode, {
              now: dependencies.clock.now(), defaultTimeZone: 'UTC', weekStartsOn: 1,
              resolveTimeZoneAbbreviation: () => ({ kind: 'unknown' })
            })
        if (!expanded.ok) return { ok: false, error: validationError }
        const existing = occurrences.filter(({ scheduleId }) => scheduleId === current.id)
        const byKey = new Map(existing.map((value) => [
          JSON.stringify([value.start, value.end, value.startMark, value.endMark]), value
        ]))
        const nextOccurrences = expanded.value.map((value) => {
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
          recurrenceCode: parsed.data.recurrenceCode,
          exclusionCode: parsed.data.exclusionCode,
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

      async searchPage(query) {
        const parsed = ScheduleSearchQuerySchema.safeParse(query)
        if (!parsed.success) return { ok: false, error: validationError }
        const matches = schedules.filter((schedule) => {
          if (deletedScheduleIds.has(schedule.id) !== parsed.data.deleted) return false
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
        }
      },
      async listBySchedule(scheduleId) {
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
      async exclude(id) {
        const index = occurrences.findIndex((value) => value.id === id)
        const current = occurrences[index]
        if (current === undefined) return { ok: false, error: { code: 'NOT_FOUND', message: '时间实例不存在' } }
        occurrences[index] = { ...current, excluded: true }
        const scheduleIndex = schedules.findIndex((value) => value.id === current.scheduleId)
        const schedule = schedules[scheduleIndex]
        if (schedule !== undefined) {
          const concrete = `${current.start ?? current.end}-${current.end} UTC`
          schedules[scheduleIndex] = {
            ...schedule,
            exclusionCode: schedule.exclusionCode === '' ? concrete : `${schedule.exclusionCode};${concrete}`,
            updatedAt: dependencies.clock.now().toString()
          }
        }
        return { ok: true, value: undefined }
      }
    }
  }
}
