import { z } from 'zod'

import { AppErrorDtoSchema } from '../../src/contracts/result'
import {
  CreateScheduleInputSchema,
  ScheduleDtoSchema,
  ScheduleListQuerySchema
} from '../../src/contracts/schedule.contract'

export const scheduleIpcChannels = {
  create: 'schedule:create',
  findById: 'schedule:find-by-id',
  list: 'schedule:list'
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
  }
} as const

