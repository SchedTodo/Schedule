import type {
  AlarmRecalculationReason
} from '../../src/application/alarm-coordinator'
import type { AppResult } from '../../src/contracts/result'

export interface PowerMonitorPort {
  on(event: 'resume', handler: () => void): void
  off(event: 'resume', handler: () => void): void
}

export interface AlarmCoordinatorPort {
  recalculate(reason: AlarmRecalculationReason): Promise<AppResult<void>>
}

export interface AlarmRuntimeDependencies {
  readonly coordinator: AlarmCoordinatorPort
  readonly powerMonitor: PowerMonitorPort
  readonly reportError: (error: unknown) => void
}

export class AlarmRuntime {
  private pending: Promise<void> = Promise.resolve()
  private timer: ReturnType<typeof setInterval> | undefined
  private started = false
  private disposed = false
  private readonly resumeHandler = () => {
    void this.request('resume')
  }

  constructor(private readonly dependencies: AlarmRuntimeDependencies) {}

  start(): Promise<void> {
    if (this.started || this.disposed) return this.pending
    this.started = true
    this.dependencies.powerMonitor.on('resume', this.resumeHandler)
    this.timer = setInterval(() => {
      void this.request('poll')
    }, 30_000)
    return this.request('initialize')
  }

  request(reason: AlarmRecalculationReason): Promise<void> {
    if (this.disposed) return this.pending
    this.pending = this.pending
      .then(async () => {
        const result = await this.dependencies.coordinator.recalculate(reason)
        if (!result.ok) this.dependencies.reportError(result.error)
      })
      .catch((error: unknown) => {
        this.dependencies.reportError(error)
      })
    return this.pending
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    if (this.timer !== undefined) clearInterval(this.timer)
    this.dependencies.powerMonitor.off('resume', this.resumeHandler)
  }
}
