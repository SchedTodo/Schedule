import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import {
  appFeedbackKey,
  useOperationFeedback,
  type AppFeedback
} from '../../src/app/app-feedback'

describe('application feedback', () => {
  it('shows success only when requested and always reports failures', () => {
    const feedback: AppFeedback = {
      success: vi.fn(),
      error: vi.fn()
    }
    const Harness = defineComponent({
      setup() {
        const { showResult } = useOperationFeedback()
        showResult({ ok: true, value: undefined }, { success: true })
        showResult({ ok: true, value: undefined })
        showResult({
          ok: false,
          error: {
            code: 'PERSISTENCE_FAILED',
            messageKey: 'error.persistenceFailed',
            message: '保存失败'
          }
        })
        return () => h('div')
      }
    })

    mount(Harness, {
      global: {
        provide: { [appFeedbackKey as symbol]: feedback }
      }
    })

    expect(feedback.success).toHaveBeenCalledOnce()
    expect(feedback.success).toHaveBeenCalledWith('Success')
    expect(feedback.error).toHaveBeenCalledOnce()
    expect(feedback.error).toHaveBeenCalledWith(
      'Error',
      'Local data could not be saved or loaded.'
    )
  })
})
