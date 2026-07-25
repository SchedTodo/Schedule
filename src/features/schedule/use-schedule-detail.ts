import { readonly, shallowRef } from 'vue'

import type { AppErrorDto } from '../../contracts/result'
import type { PlatformGateway } from '../../contracts/platform.contract'
import type { ScheduleDetailDto } from '../../contracts/schedule.contract'

/** 管理单个日程详情的异步加载状态，并避免旧响应覆盖新请求。 */
export function useScheduleDetail(gateway: PlatformGateway, id: string) {
  const schedule = shallowRef<ScheduleDetailDto | null>(null)
  const loading = shallowRef(false)
  const error = shallowRef<AppErrorDto | null>(null)
  let requestToken = 0

  /** 重新加载详情，并丢弃已经过期的异步响应。 */
  async function refresh(): Promise<void> {
    const token = ++requestToken
    loading.value = true
    error.value = null
    const result = await gateway.schedules.findById(id)
    if (token !== requestToken) return

    if (result.ok) schedule.value = result.value
    else error.value = result.error
    loading.value = false
  }

  void refresh()

  return {
    schedule: readonly(schedule),
    loading: readonly(loading),
    error: readonly(error),
    refresh
  }
}
