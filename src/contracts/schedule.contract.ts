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
  .refine((value) => value.recurrenceCode.trim() !== '' || value.exclusionCode.trim() === '', {
    message: 'Exclusion rules require a recurrence rule',
    path: ['exclusionCode']
  })

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

export const ScheduleDetailDtoSchema = ScheduleDtoSchema.extend({
  deleted: z.boolean()
}).strict()

export const ScheduleListQuerySchema = z
  .object({
    kind: ScheduleKindSchema.optional(),
    search: z.string().trim().max(200).optional(),
    offset: z.number().int().nonnegative().default(0),
    limit: z.number().int().positive().max(200).default(50)
  })
  .strict()

export const UpdateScheduleInputSchema = CreateScheduleInputSchema.safeExtend({
  id: z.uuid()
}).strict()

export const SetScheduleStarredInputSchema = z.object({
  id: z.uuid(),
  starred: z.boolean()
}).strict()

export const SetScheduleDeletedInputSchema = z.object({
  id: z.uuid(),
  deleted: z.boolean()
}).strict()

export const ScheduleSearchQuerySchema = z.object({
  search: z.string().trim().max(200).default(''),
  start: z.iso.datetime({ offset: true }).optional(),
  end: z.iso.datetime({ offset: true }).optional(),
  kind: ScheduleKindSchema.optional(),
  starred: z.boolean().optional(),
  deleted: z.boolean().optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(200).default(20)
}).strict().refine((value) =>
  value.start === undefined || value.end === undefined || Date.parse(value.start) <= Date.parse(value.end),
{ message: 'Search start must not follow end', path: ['end'] })

export const SchedulePageItemDtoSchema = ScheduleDtoSchema.extend({
  deleted: z.boolean()
}).strict()

export const SchedulePageDtoSchema = z.object({
  items: z.array(SchedulePageItemDtoSchema),
  total: z.number().int().nonnegative()
}).strict()

export type ScheduleKind = z.infer<typeof ScheduleKindSchema>
export type CreateScheduleInput = z.infer<typeof CreateScheduleInputSchema>
export type ScheduleDto = z.infer<typeof ScheduleDtoSchema>
export type ScheduleDetailDto = z.infer<typeof ScheduleDetailDtoSchema>
export type ScheduleListQuery = z.infer<typeof ScheduleListQuerySchema>
export type UpdateScheduleInput = z.infer<typeof UpdateScheduleInputSchema>
export type SetScheduleStarredInput = z.infer<typeof SetScheduleStarredInputSchema>
export type SetScheduleDeletedInput = z.infer<typeof SetScheduleDeletedInputSchema>
export type ScheduleSearchQuery = z.infer<typeof ScheduleSearchQuerySchema>
export type SchedulePageItemDto = z.infer<typeof SchedulePageItemDtoSchema>
export type SchedulePageDto = z.infer<typeof SchedulePageDtoSchema>
