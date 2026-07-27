import { inject, type InjectionKey } from 'vue'

import type { AppResult } from '../contracts/result'

export interface AppFeedback {
  readonly success: (title: string) => void
  readonly error: (title: string, content: string) => void
}

export const appFeedbackKey: InjectionKey<AppFeedback> = Symbol('app-feedback')

const silentFeedback: AppFeedback = {
  success: () => undefined,
  error: () => undefined
}

/** 将稳定的应用结果映射为 v1.2 风格的成功、失败通知。 */
export function useOperationFeedback() {
  const feedback = inject(appFeedbackKey, silentFeedback)

  function showResult<T>(
    result: AppResult<T>,
    options: { readonly success?: boolean } = {}
  ): result is Extract<AppResult<T>, { readonly ok: true }> {
    if (result.ok) {
      if (options.success) feedback.success('Success')
      return true
    }
    feedback.error('Error', result.error.message)
    return false
  }

  return { showResult }
}
