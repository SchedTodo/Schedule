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
  .superRefine((value, context) => {
    if (value.start !== null && Date.parse(value.start) > Date.parse(value.end)) {
      context.addIssue({
        code: 'custom',
        message: 'Occurrence end must not precede its start',
        path: ['end']
      })
    }
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

export type KnownTimeMark = z.infer<typeof KnownTimeMarkSchema>
export type ScheduleOccurrenceDto = z.infer<typeof ScheduleOccurrenceDtoSchema>
export type ScheduleOccurrenceDraft = z.infer<typeof ScheduleOccurrenceDraftSchema>
export type OccurrenceRangeQuery = z.infer<typeof OccurrenceRangeQuerySchema>
