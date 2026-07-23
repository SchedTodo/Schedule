import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

import type {
  AlarmRecalculationReason
} from '../../../src/application/alarm-coordinator'
import type { AppResult } from '../../../src/contracts/result'
import {
  AlarmRuntime,
  type PowerMonitorPort
} from '../../../src-electron/main/alarm-runtime'

class FakePowerMonitor implements PowerMonitorPort {
  private handler: (() => void) | undefined

  on(_event: 'resume', handler: () => void): void {
    this.handler = handler
  }

  off(_event: 'resume', handler: () => void): void {
    if (this.handler === handler) this.handler = undefined
  }

  emitResume(): void {
    this.handler?.()
  }
}

describe('AlarmRuntime', () => {
  let powerMonitor: FakePowerMonitor
  let recalculate: Mock<(
    reason: AlarmRecalculationReason
  ) => Promise<AppResult<void>>>
  let reportError: Mock<(error: unknown) => void>
  let runtime: AlarmRuntime

  beforeEach(() => {
    vi.useFakeTimers()
    powerMonitor = new FakePowerMonitor()
    recalculate = vi.fn(async () => ({ ok: true, value: undefined }))
    reportError = vi.fn()
    runtime = new AlarmRuntime({
      coordinator: { recalculate },
      powerMonitor,
      reportError
    })
  })

  afterEach(() => {
    runtime.dispose()
    vi.useRealTimers()
  })

  it('serializes initialization, polling, resume, and mutation recalculation', async () => {
    const calls: AlarmRecalculationReason[] = []
    recalculate.mockImplementation(async (reason) => {
      calls.push(reason)
      return { ok: true, value: undefined }
    })

    await runtime.start()
    await vi.advanceTimersByTimeAsync(30_000)
    powerMonitor.emitResume()
    await runtime.request('mutation')

    expect(calls).toEqual(['initialize', 'poll', 'resume', 'mutation'])
  })

  it('unsubscribes resume and clears polling on dispose', async () => {
    await runtime.start()
    runtime.dispose()
    await vi.advanceTimersByTimeAsync(60_000)
    powerMonitor.emitResume()

    expect(recalculate).toHaveBeenCalledTimes(1)
  })

  it('reports coordinator failures and keeps the queue usable', async () => {
    const failure = {
      code: 'PERSISTENCE_FAILED' as const,
      message: 'read failed'
    }
    recalculate
      .mockResolvedValueOnce({ ok: false, error: failure })
      .mockResolvedValueOnce({ ok: true, value: undefined })

    await runtime.start()
    await runtime.request('mutation')

    expect(reportError).toHaveBeenCalledWith(failure)
    expect(recalculate).toHaveBeenCalledTimes(2)
  })
})
