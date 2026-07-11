import { readonly, shallowRef } from 'vue'

import type { AppErrorDto, AppResult } from '../../contracts/result'
import type { PlatformGateway } from '../../contracts/platform.contract'
import type { CreateScheduleInput, ScheduleDto } from '../../contracts/schedule.contract'

export function useScheduleMutations(
  gateway: PlatformGateway,
  afterMutation: () => void | Promise<void>
) {
  const loading = shallowRef(false)
  const error = shallowRef<AppErrorDto | null>(null)

  async function createSchedule(
    input: CreateScheduleInput
  ): Promise<AppResult<ScheduleDto>> {
    loading.value = true
    error.value = null
    const result = await gateway.schedules.create(input)
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
