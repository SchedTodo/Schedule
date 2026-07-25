import { z } from 'zod'

import { AppErrorDtoSchema } from '../../src/contracts/result'
import { SettingsDtoSchema, UpdateSettingsInputSchema } from '../../src/contracts/settings.contract'
import { ConcentrationRecordDtoSchema, CreateConcentrationRecordInputSchema } from '../../src/contracts/record.contract'
import { NotificationInputSchema } from '../../src/contracts/notification.contract'
import {
  CalendarOccurrenceDtoSchema,
  ExcludeOccurrencesInputSchema,
  OccurrenceRangeQuerySchema,
  ScheduleOccurrenceDtoSchema,
  ScheduleOccurrenceListInputSchema,
  UpdateOccurrenceCommentInputSchema,
  ExcludeOccurrenceInputSchema,
  TodoOccurrenceQuerySchema,
  SetOccurrenceDoneInputSchema
} from '../../src/contracts/occurrence.contract'
import {
  CreateScheduleInputSchema,
  ScheduleDetailDtoSchema,
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
  excludeOccurrences: 'occurrence:exclude-many',
  listTodos: 'occurrence:list-todos',
  setOccurrenceDone: 'occurrence:set-done',
  getSettings: 'settings:get',
  updateSettings: 'settings:update',
  createRecord: 'record:create',
  listRecords: 'record:list-by-schedule',
  deleteRecord: 'record:delete'
  ,showNotification: 'notification:show'
} as const

export const FindScheduleByIdInputSchema = z.object({ id: z.uuid() }).strict()

/** 为指定成功值模式构造严格的 AppResult IPC 输出契约。 */
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
    output: appResultSchema(ScheduleDetailDtoSchema.nullable())
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
    output: appResultSchema(z.array(CalendarOccurrenceDtoSchema))
  },
  [scheduleIpcChannels.listScheduleOccurrences]: {
    input: ScheduleOccurrenceListInputSchema,
    output: appResultSchema(z.array(ScheduleOccurrenceDtoSchema))
  },
  [scheduleIpcChannels.updateOccurrenceComment]: {
    input: UpdateOccurrenceCommentInputSchema,
    output: appResultSchema(ScheduleOccurrenceDtoSchema)
  },
  [scheduleIpcChannels.excludeOccurrences]: {
    input: ExcludeOccurrencesInputSchema,
    output: appResultSchema(z.void())
  },
  [scheduleIpcChannels.listTodos]: {
    input: TodoOccurrenceQuerySchema,
    output: appResultSchema(z.array(ScheduleOccurrenceDtoSchema))
  },
  [scheduleIpcChannels.setOccurrenceDone]: {
    input: SetOccurrenceDoneInputSchema,
    output: appResultSchema(ScheduleOccurrenceDtoSchema)
  },
  [scheduleIpcChannels.getSettings]: {
    input: z.object({}).strict(),
    output: appResultSchema(SettingsDtoSchema)
  },
  [scheduleIpcChannels.updateSettings]: {
    input: UpdateSettingsInputSchema,
    output: appResultSchema(SettingsDtoSchema)
  },
  [scheduleIpcChannels.createRecord]: {
    input: CreateConcentrationRecordInputSchema,
    output: appResultSchema(ConcentrationRecordDtoSchema)
  },
  [scheduleIpcChannels.listRecords]: {
    input: ScheduleOccurrenceListInputSchema,
    output: appResultSchema(z.array(ConcentrationRecordDtoSchema))
  },
  [scheduleIpcChannels.deleteRecord]: {
    input: ExcludeOccurrenceInputSchema,
    output: appResultSchema(z.void())
  },
  [scheduleIpcChannels.showNotification]: {
    input: NotificationInputSchema,
    output: appResultSchema(z.void())
  }
} as const
