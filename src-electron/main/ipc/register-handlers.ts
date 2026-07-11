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
}
