import { readonly, shallowRef } from 'vue'

import type { AppErrorDto } from '../../contracts/result'
import type { PlatformGateway } from '../../contracts/platform.contract'
import type { ScheduleDto, ScheduleListQuery } from '../../contracts/schedule.contract'

/** 管理日程列表查询及其加载、错误状态，并忽略过期响应。 */
export function useScheduleList(
  gateway: PlatformGateway,
  initialQuery: ScheduleListQuery
) {
  const items = shallowRef<readonly ScheduleDto[]>([])
  const loading = shallowRef(false)
  const error = shallowRef<AppErrorDto | null>(null)
  const query = shallowRef<ScheduleListQuery>({ ...initialQuery })
  let requestToken = 0

  /** 按当前查询重新加载列表，并丢弃已经过期的异步响应。 */
  async function refresh(): Promise<void> {
    const token = ++requestToken
    loading.value = true
    error.value = null
    const result = await gateway.schedules.list(query.value)
    if (token !== requestToken) return

    if (result.ok) items.value = result.value
    else error.value = result.error
    loading.value = false
  }

  void refresh()

  return {
    items: readonly(items),
    loading: readonly(loading),
    error: readonly(error),
    query: readonly(query),
    refresh
  }
}
