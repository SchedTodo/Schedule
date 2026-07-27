import { readonly, shallowRef } from 'vue'

import type { AppErrorDto, AppResult } from '../../contracts/result'
import type { PlatformGateway } from '../../contracts/platform.contract'
import type { CreateScheduleInput, ScheduleDto } from '../../contracts/schedule.contract'

/** 封装日程写操作的加载与错误状态，并在成功后触发调用方刷新。 */
export function useScheduleMutations(
  gateway: PlatformGateway,
  afterMutation: () => void | Promise<void>,
  onResult?: (result: AppResult<ScheduleDto>) => unknown
) {
  const loading = shallowRef(false)
  const error = shallowRef<AppErrorDto | null>(null)

  /** 创建日程，并在成功时等待调用方完成后续刷新。 */
  async function createSchedule(
    input: CreateScheduleInput
  ): Promise<AppResult<ScheduleDto>> {
    loading.value = true
    error.value = null
    const result = await gateway.schedules.create(input)
    onResult?.(result)
    if (result.ok) await afterMutation()
    else error.value = result.error
    loading.value = false
    return result
  }

  return {
    loading: readonly(loading),
    error: readonly(error),
    createSchedule
  }
}
