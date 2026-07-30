import type { PlatformGateway } from '../../../src/contracts/platform.contract'
import type { AppErrorDto, AppResult } from '../../../src/contracts/result'
import {
  scheduleIpcChannels,
  scheduleIpcContracts
} from '../../ipc-contracts/schedule-ipc'

type IpcHandler = (event: unknown, input: unknown) => Promise<unknown>

export interface IpcMainRegistrar {
  handle(channel: string, handler: IpcHandler): void
}

export interface ScheduleIpcHandlerOptions {
  readonly onAlarmInputsChanged?: () => void
}

const validationError: AppErrorDto = {
  code: 'VALIDATION_FAILED',
  messageKey: 'error.validationFailed',
  message: 'IPC 请求格式无效'
}

const internalError: AppErrorDto = {
  code: 'INTERNAL_ERROR',
  messageKey: 'error.internalError',
  message: '日程操作失败'
}

/**
 * 在 IPC 边界依次校验输入、执行平台操作并校验输出。
 *
 * 契约错误和未捕获的内部错误会转换为稳定的 AppResult，避免异常穿透进程边界。
 */
async function execute<TInput, TValue>(
  input: unknown,
  parseInput: (value: unknown) => TInput,
  operation: (value: TInput) => Promise<AppResult<TValue>>,
  parseOutput: (value: unknown) => AppResult<TValue>
): Promise<AppResult<TValue>> {
  let parsedInput: TInput
  try {
    parsedInput = parseInput(input)
  } catch {
    return { ok: false, error: validationError }
  }

  try {
    return parseOutput(await operation(parsedInput))
  } catch {
    return { ok: false, error: internalError }
  }
}

/** 仅在平台操作成功后通知提醒运行时重新计算候选。 */
function recalculateAfterSuccess<T>(
  result: AppResult<T>,
  callback: (() => void) | undefined
): AppResult<T> {
  if (result.ok) callback?.()
  return result
}

/** 注册全部 Schedule IPC handler，并为每个通道绑定对应输入输出契约。 */
export function registerScheduleIpcHandlers(
  ipcMain: IpcMainRegistrar,
  gateway: PlatformGateway,
  options: ScheduleIpcHandlerOptions = {}
): void {
  const createContract = scheduleIpcContracts[scheduleIpcChannels.create]
  ipcMain.handle(scheduleIpcChannels.create, (_event, input) =>
    execute(
      input,
      (value) => createContract.input.parse(value),
      async (value) => recalculateAfterSuccess(
        await gateway.schedules.create(value),
        options.onAlarmInputsChanged
      ),
      (value) => createContract.output.parse(value)
    )
  )

  const findContract = scheduleIpcContracts[scheduleIpcChannels.findById]
  ipcMain.handle(scheduleIpcChannels.findById, (_event, input) =>
    execute(
      input,
      (value) => findContract.input.parse(value),
      ({ id }) => gateway.schedules.findById(id),
      (value) => findContract.output.parse(value)
    )
  )

  const listContract = scheduleIpcContracts[scheduleIpcChannels.list]
  ipcMain.handle(scheduleIpcChannels.list, (_event, input) =>
    execute(
      input,
      (value) => listContract.input.parse(value),
      (value) => gateway.schedules.list(value),
      (value) => listContract.output.parse(value)
    )
  )

  const updateContract = scheduleIpcContracts[scheduleIpcChannels.update]
  ipcMain.handle(scheduleIpcChannels.update, (_event, input) => execute(
    input, (value) => updateContract.input.parse(value),
    async (value) => recalculateAfterSuccess(
      await gateway.schedules.update(value),
      options.onAlarmInputsChanged
    ), (value) => updateContract.output.parse(value)
  ))
  const starredContract = scheduleIpcContracts[scheduleIpcChannels.setStarred]
  ipcMain.handle(scheduleIpcChannels.setStarred, (_event, input) => execute(
    input, (value) => starredContract.input.parse(value),
    (value) => gateway.schedules.setStarred(value), (value) => starredContract.output.parse(value)
  ))
  const deletedContract = scheduleIpcContracts[scheduleIpcChannels.setDeleted]
  ipcMain.handle(scheduleIpcChannels.setDeleted, (_event, input) => execute(
    input, (value) => deletedContract.input.parse(value),
    async (value) => recalculateAfterSuccess(
      await gateway.schedules.setDeleted(value),
      options.onAlarmInputsChanged
    ), (value) => deletedContract.output.parse(value)
  ))
  const searchContract = scheduleIpcContracts[scheduleIpcChannels.search]
  ipcMain.handle(scheduleIpcChannels.search, (_event, input) => execute(
    input, (value) => searchContract.input.parse(value),
    (value) => gateway.schedules.searchPage(value), (value) => searchContract.output.parse(value)
  ))

  const occurrenceListContract = scheduleIpcContracts[scheduleIpcChannels.listOccurrences]
  ipcMain.handle(scheduleIpcChannels.listOccurrences, (_event, input) =>
    execute(
      input,
      (value) => occurrenceListContract.input.parse(value),
      (value) => gateway.occurrences.listRange(value),
      (value) => occurrenceListContract.output.parse(value)
    )
  )
  const scheduleOccurrencesContract = scheduleIpcContracts[scheduleIpcChannels.listScheduleOccurrences]
  ipcMain.handle(scheduleIpcChannels.listScheduleOccurrences, (_event, input) => execute(
    input, (value) => scheduleOccurrencesContract.input.parse(value),
    ({ scheduleId }) => gateway.occurrences.listVisibleBySchedule(scheduleId),
    (value) => scheduleOccurrencesContract.output.parse(value)
  ))
  const commentContract = scheduleIpcContracts[scheduleIpcChannels.updateOccurrenceComment]
  ipcMain.handle(scheduleIpcChannels.updateOccurrenceComment, (_event, input) => execute(
    input, (value) => commentContract.input.parse(value),
    async ({ id, comment }) => recalculateAfterSuccess(
      await gateway.occurrences.updateComment(id, comment),
      options.onAlarmInputsChanged
    ),
    (value) => commentContract.output.parse(value)
  ))
  const excludeContract = scheduleIpcContracts[scheduleIpcChannels.excludeOccurrences]
  ipcMain.handle(scheduleIpcChannels.excludeOccurrences, (_event, input) => execute(
    input, (value) => excludeContract.input.parse(value),
    async (value) => recalculateAfterSuccess(
      await gateway.occurrences.excludeMany(value),
      options.onAlarmInputsChanged
    ),
    (value) => excludeContract.output.parse(value)
  ))
  const todoContract = scheduleIpcContracts[scheduleIpcChannels.listTodos]
  ipcMain.handle(scheduleIpcChannels.listTodos, (_event, input) => execute(
    input, (value) => todoContract.input.parse(value),
    (value) => gateway.occurrences.listTodos(value),
    (value) => todoContract.output.parse(value)
  ))
  const doneContract = scheduleIpcContracts[scheduleIpcChannels.setOccurrenceDone]
  ipcMain.handle(scheduleIpcChannels.setOccurrenceDone, (_event, input) => execute(
    input, (value) => doneContract.input.parse(value),
    async ({ id, done }) => recalculateAfterSuccess(
      await gateway.occurrences.setDone(id, done),
      options.onAlarmInputsChanged
    ),
    (value) => doneContract.output.parse(value)
  ))
  const getSettingsContract = scheduleIpcContracts[scheduleIpcChannels.getSettings]
  ipcMain.handle(scheduleIpcChannels.getSettings, (_event, input) => execute(
    input, (value) => getSettingsContract.input.parse(value),
    () => gateway.settings.get(), (value) => getSettingsContract.output.parse(value)
  ))
  const updateSettingsContract = scheduleIpcContracts[scheduleIpcChannels.updateSettings]
  ipcMain.handle(scheduleIpcChannels.updateSettings, (_event, input) => execute(
    input, (value) => updateSettingsContract.input.parse(value),
    async (value) => recalculateAfterSuccess(
      await gateway.settings.update(value),
      options.onAlarmInputsChanged
    ),
    (value) => updateSettingsContract.output.parse(value)
  ))
  const createRecordContract = scheduleIpcContracts[scheduleIpcChannels.createRecord]
  ipcMain.handle(scheduleIpcChannels.createRecord, (_event, input) => execute(
    input, (value) => createRecordContract.input.parse(value),
    (value) => gateway.records.create(value), (value) => createRecordContract.output.parse(value)
  ))
  const listRecordsContract = scheduleIpcContracts[scheduleIpcChannels.listRecords]
  ipcMain.handle(scheduleIpcChannels.listRecords, (_event, input) => execute(
    input, (value) => listRecordsContract.input.parse(value),
    ({ scheduleId }) => gateway.records.listBySchedule(scheduleId),
    (value) => listRecordsContract.output.parse(value)
  ))
  const deleteRecordContract = scheduleIpcContracts[scheduleIpcChannels.deleteRecord]
  ipcMain.handle(scheduleIpcChannels.deleteRecord, (_event, input) => execute(
    input, (value) => deleteRecordContract.input.parse(value),
    ({ id }) => gateway.records.delete(id), (value) => deleteRecordContract.output.parse(value)
  ))
  const notificationContract = scheduleIpcContracts[scheduleIpcChannels.showNotification]
  ipcMain.handle(scheduleIpcChannels.showNotification, (_event, input) => execute(
    input, (value) => notificationContract.input.parse(value),
    (value) => gateway.notifications.show(value), (value) => notificationContract.output.parse(value)
  ))
}
