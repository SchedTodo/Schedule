import { readonly, ref } from 'vue'

import type { PlatformGateway } from '../../contracts/platform.contract'
import type {
  CalendarOccurrenceDto,
  OccurrenceRangeQuery,
} from '../../contracts/occurrence.contract'
import type { AppErrorDto } from '../../contracts/result'

export function useOccurrenceRange(
  gateway: PlatformGateway,
  initialQuery: OccurrenceRangeQuery
) {
  const items = ref<readonly CalendarOccurrenceDto[]>([])
  const loading = ref(false)
  const error = ref<AppErrorDto | null>(null)
  let request = 0

  async function refresh(query: OccurrenceRangeQuery = initialQuery): Promise<void> {
    const current = ++request
    loading.value = true
    const result = await gateway.occurrences.listRange(query)
    if (current !== request) return
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
