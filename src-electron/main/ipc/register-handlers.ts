import type { PlatformGateway } from '../../../src/contracts/platform.contract'
import type { AppErrorDto, AppResult } from '../../../src/contracts/result'
import {
  scheduleIpcChannels,
  scheduleIpcContracts
} from '../../ipc/schedule-ipc'

type IpcHandler = (event: unknown, input: unknown) => Promise<unknown>

export interface IpcMainRegistrar {
  handle(channel: string, handler: IpcHandler): void
}

const validationError: AppErrorDto = {
  code: 'VALIDATION_FAILED',
  message: 'IPC 请求格式无效'
}

const internalError: AppErrorDto = {
  code: 'INTERNAL_ERROR',
  message: '日程操作失败'
}

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

export function registerScheduleIpcHandlers(
  ipcMain: IpcMainRegistrar,
  gateway: PlatformGateway
): void {
  const createContract = scheduleIpcContracts[scheduleIpcChannels.create]
  ipcMain.handle(scheduleIpcChannels.create, (_event, input) =>
    execute(
      input,
      (value) => createContract.input.parse(value),
      (value) => gateway.schedules.create(value),
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
    (value) => gateway.schedules.update(value), (value) => updateContract.output.parse(value)
  ))
  const starredContract = scheduleIpcContracts[scheduleIpcChannels.setStarred]
  ipcMain.handle(scheduleIpcChannels.setStarred, (_event, input) => execute(
    input, (value) => starredContract.input.parse(value),
    (value) => gateway.schedules.setStarred(value), (value) => starredContract.output.parse(value)
  ))
  const deletedContract = scheduleIpcContracts[scheduleIpcChannels.setDeleted]
  ipcMain.handle(scheduleIpcChannels.setDeleted, (_event, input) => execute(
    input, (value) => deletedContract.input.parse(value),
    (value) => gateway.schedules.setDeleted(value), (value) => deletedContract.output.parse(value)
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
    ({ scheduleId }) => gateway.occurrences.listBySchedule(scheduleId),
    (value) => scheduleOccurrencesContract.output.parse(value)
  ))
  const commentContract = scheduleIpcContracts[scheduleIpcChannels.updateOccurrenceComment]
  ipcMain.handle(scheduleIpcChannels.updateOccurrenceComment, (_event, input) => execute(
    input, (value) => commentContract.input.parse(value),
    ({ id, comment }) => gateway.occurrences.updateComment(id, comment),
    (value) => commentContract.output.parse(value)
  ))
  const excludeContract = scheduleIpcContracts[scheduleIpcChannels.excludeOccurrence]
  ipcMain.handle(scheduleIpcChannels.excludeOccurrence, (_event, input) => execute(
    input, (value) => excludeContract.input.parse(value),
    ({ id }) => gateway.occurrences.exclude(id),
    (value) => excludeContract.output.parse(value)
  ))
}
