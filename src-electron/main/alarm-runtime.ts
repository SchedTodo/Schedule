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

  /** 注册系统恢复监听和定时轮询，并执行首次提醒计算。 */
  start(): Promise<void> {
    if (this.started || this.disposed) return this.pending
    this.started = true
    this.dependencies.powerMonitor.on('resume', this.resumeHandler)
    this.timer = setInterval(() => {
      void this.request('poll')
    }, 30_000)
    return this.request('initialize')
  }

  /**
   * 将提醒重算串行追加到任务链，避免轮询、恢复和数据变更并发修改协调器状态。
   */
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

  /** 停止轮询并移除电源恢复监听；重复释放不会产生副作用。 */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    if (this.timer !== undefined) clearInterval(this.timer)
    this.dependencies.powerMonitor.off('resume', this.resumeHandler)
  }
}
