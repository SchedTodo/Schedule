import { z } from 'zod'

import { AppErrorDtoSchema } from '../../src/contracts/result'
import {
  OccurrenceRangeQuerySchema,
  ScheduleOccurrenceDtoSchema,
  ScheduleOccurrenceListInputSchema,
  UpdateOccurrenceCommentInputSchema,
  ExcludeOccurrenceInputSchema
} from '../../src/contracts/occurrence.contract'
import {
  CreateScheduleInputSchema,
  ScheduleDtoSchema,
  ScheduleListQuerySchema,
  SchedulePageDtoSchema,
  ScheduleSearchQuerySchema,
  SetScheduleDeletedInputSchema,
  SetScheduleStarredInputSchema,
  UpdateScheduleInputSchema
} from '../../src/contracts/schedule.contract'

export const scheduleIpcChannels = {
  create: 'schedule:create',
  findById: 'schedule:find-by-id',
  list: 'schedule:list',
  update: 'schedule:update',
  setStarred: 'schedule:set-starred',
  setDeleted: 'schedule:set-deleted',
  search: 'schedule:search',
  listOccurrences: 'occurrence:list-range',
  listScheduleOccurrences: 'occurrence:list-by-schedule',
  updateOccurrenceComment: 'occurrence:update-comment',
  excludeOccurrence: 'occurrence:exclude'
} as const

export const FindScheduleByIdInputSchema = z.object({ id: z.uuid() }).strict()

function appResultSchema<T extends z.ZodType>(value: T) {
  return z.discriminatedUnion('ok', [
    z.object({ ok: z.literal(true), value }).strict(),
    z.object({ ok: z.literal(false), error: AppErrorDtoSchema }).strict()
  ])
}

export const scheduleIpcContracts = {
  [scheduleIpcChannels.create]: {
    input: CreateScheduleInputSchema,
    output: appResultSchema(ScheduleDtoSchema)
  },
  [scheduleIpcChannels.findById]: {
    input: FindScheduleByIdInputSchema,
    output: appResultSchema(ScheduleDtoSchema.nullable())
  },
  [scheduleIpcChannels.list]: {
    input: ScheduleListQuerySchema,
    output: appResultSchema(z.array(ScheduleDtoSchema))
  },
  [scheduleIpcChannels.update]: {
    input: UpdateScheduleInputSchema,
    output: appResultSchema(ScheduleDtoSchema)
  },
  [scheduleIpcChannels.setStarred]: {
    input: SetScheduleStarredInputSchema,
    output: appResultSchema(ScheduleDtoSchema)
  },
  [scheduleIpcChannels.setDeleted]: {
    input: SetScheduleDeletedInputSchema,
    output: appResultSchema(z.void())
  },
  [scheduleIpcChannels.search]: {
    input: ScheduleSearchQuerySchema,
    output: appResultSchema(SchedulePageDtoSchema)
  },
  [scheduleIpcChannels.listOccurrences]: {
    input: OccurrenceRangeQuerySchema,
    output: appResultSchema(z.array(ScheduleOccurrenceDtoSchema))
  },
  [scheduleIpcChannels.listScheduleOccurrences]: {
    input: ScheduleOccurrenceListInputSchema,
    output: appResultSchema(z.array(ScheduleOccurrenceDtoSchema))
  },
  [scheduleIpcChannels.updateOccurrenceComment]: {
    input: UpdateOccurrenceCommentInputSchema,
    output: appResultSchema(ScheduleOccurrenceDtoSchema)
  },
  [scheduleIpcChannels.excludeOccurrence]: {
    input: ExcludeOccurrenceInputSchema,
    output: appResultSchema(z.void())
  }
} as const
