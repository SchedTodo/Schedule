import { readonly, ref } from 'vue'

import type { PlatformGateway } from '../../contracts/platform.contract'
import type {
  CalendarOccurrenceDto,
  OccurrenceRangeQuery,
} from '../../contracts/occurrence.contract'
import type { AppErrorDto, AppResult } from '../../contracts/result'

/** 管理指定时间范围内 occurrence 的加载、错误和刷新状态。 */
export function useOccurrenceRange(
  gateway: PlatformGateway,
  initialQuery: OccurrenceRangeQuery,
  onResult?: <T>(result: AppResult<T>) => unknown
) {
  const items = ref<readonly CalendarOccurrenceDto[]>([])
  const loading = ref(false)
  const error = ref<AppErrorDto | null>(null)
  let request = 0

  /** 刷新查询结果，并丢弃晚于它发起但早于它返回的新请求之前的旧响应。 */
  async function refresh(query: OccurrenceRangeQuery = initialQuery): Promise<void> {
    const current = ++request
    loading.value = true
    const result = await gateway.occurrences.listRange(query)
    if (current !== request) return
    onResult?.(result)
    if (result.ok) {
      items.value = result.value
      error.value = null
    } else {
      items.value = []
      error.value = result.error
    }
    loading.value = false
  }

  void refresh()
  return {
    items: readonly(items),
    loading: readonly(loading),
    error: readonly(error),
    refresh
  }
}
