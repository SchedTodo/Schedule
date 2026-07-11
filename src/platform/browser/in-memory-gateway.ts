import type { PlatformGateway } from '../../contracts/platform.contract'
import {
  CreateScheduleInputSchema,
  ScheduleListQuerySchema,
  type ScheduleDto
} from '../../contracts/schedule.contract'
import type { Clock } from '../../domain/shared/clock'
import { SystemClock } from '../../domain/shared/clock'
import type { IdGenerator } from '../../domain/shared/id-generator'
import { CryptoIdGenerator } from '../../domain/shared/id-generator'

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
        return { ok: true, value: schedule }
      },

      async findById(id) {
        return { ok: true, value: schedules.find((schedule) => schedule.id === id) ?? null }
      },

      async list(query) {
        const parsed = ScheduleListQuerySchema.safeParse(query)
        if (!parsed.success) return { ok: false, error: validationError }

        const { kind, search, offset, limit } = parsed.data
        const normalizedSearch = search?.toLocaleLowerCase()
        const matches = schedules.filter((schedule) => {
          if (kind && schedule.kind !== kind) return false
          return normalizedSearch
            ? schedule.title.toLocaleLowerCase().includes(normalizedSearch)
            : true
        })
        return { ok: true, value: Object.freeze(matches.slice(offset, offset + limit)) }
      }
    }
  }
}
