import { z } from 'zod'

import { AppErrorDtoSchema } from '../../src/contracts/result'
import { SettingsDtoSchema, UpdateSettingsInputSchema } from '../../src/contracts/settings.contract'
import {
  ConcentrationRecordDtoSchema,
  CreateConcentrationRecordInputSchema
} from '../../src/contracts/record.contract'
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

/** Electron 主进程与预加载层共享的具名 IPC 通道。 */
export const scheduleIpcChannels = {
  /** 创建日程。 */
  create: 'schedule:create',
  /** 按 ID 查询日程详情。 */
  findById: 'schedule:find-by-id',
  /** 按列表条件查询日程。 */
  list: 'schedule:list',
  /** 更新日程。 */
  update: 'schedule:update',
  /** 设置日程的星标状态。 */
  setStarred: 'schedule:set-starred',
  /** 设置日程的删除状态。 */
  setDeleted: 'schedule:set-deleted',
  /** 分页搜索日程。 */
  search: 'schedule:search',
  /** 查询指定时间范围内的日历实例。 */
  listOccurrences: 'occurrence:list-range',
  /** 查询指定日程的可见实例。 */
  listScheduleOccurrences: 'occurrence:list-by-schedule',
  /** 更新日程实例的备注。 */
  updateOccurrenceComment: 'occurrence:update-comment',
  /** 批量排除日程实例。 */
  excludeOccurrences: 'occurrence:exclude-many',
  /** 查询待办日程实例。 */
  listTodos: 'occurrence:list-todos',
  /** 设置日程实例的完成状态。 */
  setOccurrenceDone: 'occurrence:set-done',
  /** 获取应用设置。 */
  getSettings: 'settings:get',
  /** 更新应用设置。 */
  updateSettings: 'settings:update',
  /** 创建专注记录。 */
  createRecord: 'record:create',
  /** 查询指定日程的专注记录。 */
  listRecords: 'record:list-by-schedule',
  /** 删除专注记录。 */
  deleteRecord: 'record:delete',
  /** 显示系统通知。 */
  showNotification: 'notification:show'
} as const

/** 按 ID 查询日程详情时使用的请求参数。 */
export const FindScheduleByIdInputSchema = z.object({ id: z.uuid() }).strict()

/** 为指定成功值模式构造严格的 AppResult IPC 输出契约。 */
function appResultSchema<T extends z.ZodType>(value: T) {
  return z.discriminatedUnion('ok', [
    z.object({ ok: z.literal(true), value }).strict(),
    z.object({ ok: z.literal(false), error: AppErrorDtoSchema }).strict()
  ])
}

/** 每个 IPC 通道对应的严格输入与 AppResult 输出契约。 */
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
