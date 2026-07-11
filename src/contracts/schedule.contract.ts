import { z } from 'zod'

export const ScheduleKindSchema = z.enum(['event', 'todo'])

export const CreateScheduleInputSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    recurrenceCode: z.string().max(10_000),
    exclusionCode: z.string().max(10_000).default(''),
    comment: z.string().max(20_000).default('')
  })
  .strict()

export const ScheduleDtoSchema = z
  .object({
    id: z.uuid(),
    kind: ScheduleKindSchema,
    title: z.string().min(1).max(200),
    recurrenceCode: z.string(),
    exclusionCode: z.string(),
    comment: z.string(),
    starred: z.boolean(),
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true })
  })
  .strict()

export const ScheduleListQuerySchema = z
  .object({
    kind: ScheduleKindSchema.optional(),
    search: z.string().trim().max(200).optional(),
    offset: z.number().int().nonnegative().default(0),
    limit: z.number().int().positive().max(200).default(50)
  })
  .strict()

export type ScheduleKind = z.infer<typeof ScheduleKindSchema>
export type CreateScheduleInput = z.infer<typeof CreateScheduleInputSchema>
export type ScheduleDto = z.infer<typeof ScheduleDtoSchema>
export type ScheduleListQuery = z.infer<typeof ScheduleListQuerySchema>
