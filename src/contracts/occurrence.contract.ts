import { z } from 'zod'

import { ScheduleKindSchema } from './schedule.contract'

export const KnownTimeMarkSchema = z.enum(['00', '01', '10', '11'])

const occurrenceFields = {
  id: z.uuid(),
  scheduleId: z.uuid(),
  kind: ScheduleKindSchema,
  title: z.string().min(1).max(200),
  excluded: z.boolean(),
  start: z.iso.datetime({ offset: true }).nullable(),
  end: z.iso.datetime({ offset: true }),
  startMark: KnownTimeMarkSchema,
  endMark: KnownTimeMarkSchema,
  comment: z.string().max(20_000),
  done: z.boolean()
} as const

export const ScheduleOccurrenceDtoSchema = z
  .object(occurrenceFields)
  .strict()
  // occurrence 可以没有开始时间，但一旦存在，结束时间不得早于开始时间。
  .superRefine((value, context) => {
    if (value.start !== null && Date.parse(value.start) > Date.parse(value.end)) {
      context.addIssue({
        code: 'custom',
        message: 'Occurrence end must not precede its start',
        path: ['end']
      })
    }
  })

export const CalendarOccurrenceDtoSchema = ScheduleOccurrenceDtoSchema.safeExtend({
  scheduleComment: z.string().max(20_000)
})

export const StoredScheduleOccurrenceDtoSchema = ScheduleOccurrenceDtoSchema.safeExtend({
  deleted: z.boolean()
})

export const ScheduleOccurrenceDraftSchema = z
  .object({
    excluded: occurrenceFields.excluded,
    start: occurrenceFields.start,
    end: occurrenceFields.end,
    startMark: occurrenceFields.startMark,
    endMark: occurrenceFields.endMark,
    comment: occurrenceFields.comment.default(''),
    done: occurrenceFields.done.default(false)
  })
  .strict()

export const OccurrenceRangeQuerySchema = z
  .object({
    start: z.iso.datetime({ offset: true }),
    end: z.iso.datetime({ offset: true }),
    limit: z.number().int().positive().max(5_000).default(5_000)
  })
  .strict()
  .refine((value) => Date.parse(value.start) < Date.parse(value.end), {
    message: 'Occurrence range start must precede its end',
    path: ['end']
  })

export const AlarmCandidateQuerySchema = z
  .object({
    checkedAt: z.iso.datetime({ offset: true }),
    through: z.iso.datetime({ offset: true })
  })
  .strict()
  .refine((value) => Date.parse(value.checkedAt) <= Date.parse(value.through), {
    message: 'Alarm candidate bound must not precede check time',
    path: ['through']
  })

export const ScheduleOccurrenceListInputSchema = z.object({ scheduleId: z.uuid() }).strict()
export const UpdateOccurrenceCommentInputSchema = z.object({
  id: z.uuid(),
  comment: z.string().max(20_000)
}).strict()
export const ExcludeOccurrenceInputSchema = z.object({ id: z.uuid() }).strict()
export const ExcludeOccurrencesInputSchema = z.object({
  ids: z.array(z.uuid()).min(1).max(200)
}).strict()
export const TodoOccurrenceQuerySchema = z.object({
  now: z.iso.datetime({ offset: true }),
  timeZone: z.string().min(1).max(100),
  logicalDayStartHour: z.number().int().min(0).max(23).default(0),
  logicalDayStartMinute: z.number().int().min(0).max(59).default(0)
}).strict()
export const SetOccurrenceDoneInputSchema = z.object({ id: z.uuid(), done: z.boolean() }).strict()

export type KnownTimeMark = z.infer<typeof KnownTimeMarkSchema>
export type ScheduleOccurrenceDto = z.infer<typeof ScheduleOccurrenceDtoSchema>
export type CalendarOccurrenceDto = z.infer<typeof CalendarOccurrenceDtoSchema>
export type StoredScheduleOccurrenceDto = z.infer<typeof StoredScheduleOccurrenceDtoSchema>
export type ScheduleOccurrenceDraft = z.infer<typeof ScheduleOccurrenceDraftSchema>
export type OccurrenceRangeQuery = z.infer<typeof OccurrenceRangeQuerySchema>
export type AlarmCandidateQuery = z.infer<typeof AlarmCandidateQuerySchema>
export type ScheduleOccurrenceListInput = z.infer<typeof ScheduleOccurrenceListInputSchema>
export type UpdateOccurrenceCommentInput = z.infer<typeof UpdateOccurrenceCommentInputSchema>
export type ExcludeOccurrenceInput = z.infer<typeof ExcludeOccurrenceInputSchema>
export type ExcludeOccurrencesInput = z.infer<typeof ExcludeOccurrencesInputSchema>
export type TodoOccurrenceQuery = z.infer<typeof TodoOccurrenceQuerySchema>
export type SetOccurrenceDoneInput = z.infer<typeof SetOccurrenceDoneInputSchema>
