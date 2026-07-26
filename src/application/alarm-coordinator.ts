import type {
  AlarmCandidateQuery,
  ScheduleOccurrenceDto
} from '../contracts/occurrence.contract'
import type { NotificationInput } from '../contracts/notification.contract'
import type { AppResult } from '../contracts/result'
import type { SettingsDto } from '../contracts/settings.contract'
import type { Clock } from '../domain/shared/clock'
import { Temporal } from '../domain/shared/temporal'
import { notificationForAlarm } from './alarm-notification'
import {
  alarmKey,
  isAlarmDue,
  scheduledAlarms
} from './alarm-scheduler'

export type AlarmRecalculationReason =
  | 'initialize'
  | 'poll'
  | 'resume'
  | 'mutation'

export interface AlarmCoordinatorDependencies {
  readonly clock: Clock
  readonly getSettings: () => Promise<AppResult<SettingsDto>>
  readonly listCandidates: (
    query: AlarmCandidateQuery
  ) => Promise<AppResult<readonly ScheduleOccurrenceDto[]>>
  readonly notify: (input: NotificationInput) => Promise<void>
}

const notificationFailure = {
  code: 'PLATFORM_UNAVAILABLE' as const,
  message: '系统通知发送失败'
}

/**
 * 计算并投递当前应触发的日程提醒。
 *
 * 协调器只依赖平台无关的查询、通知端口和时钟；它维护本次进程中的检查窗口与
 * 去重状态，但不负责决定轮询频率或监听系统恢复事件。
 */
export class AlarmCoordinator {
  /** 上一次成功完成提醒计算的时刻，用作常规轮询窗口的左边界。 */
  private lastCheckedAt: string | undefined
  /** 上次计算得到的候选键，用于识别数据变更后新进入候选集的提醒。 */
  private knownKeys = new Set<string>()
  /** 本进程中已经成功投递的提醒键，防止同一提醒重复通知。 */
  private readonly notifiedKeys = new Set<string>()

  constructor(private readonly dependencies: AlarmCoordinatorDependencies) {}

  /**
   * 重新计算当前应触发的提醒，并确保同一提醒在进程生命周期内只发送一次。
   *
   * `mutation` 会额外补发因数据变更而刚进入候选集、但触发时间已经到达的提醒；
   * 常规轮询则只处理上次检查到本次检查之间跨过触发点的提醒。
   */
  async recalculate(reason: AlarmRecalculationReason): Promise<AppResult<void>> {
    const checkedAt = this.dependencies.clock.now().toString()
    if (this.lastCheckedAt === undefined) this.lastCheckedAt = checkedAt
    const baseline = this.lastCheckedAt

    const settingsResult = await this.dependencies.getSettings()
    if (!settingsResult.ok) return settingsResult
    const settings = settingsResult.value
    const maximumBeforeMinutes = Math.max(
      settings.todoAlarmBeforeMinutes,
      settings.eventAlarmBeforeMinutes
    )
    const candidateResult = await this.dependencies.listCandidates({
      checkedAt,
      through: Temporal.Instant.from(checkedAt)
        .add({ minutes: maximumBeforeMinutes, seconds: 30 })
        .toString()
    })
    if (!candidateResult.ok) return candidateResult

    const alarms = scheduledAlarms(candidateResult.value, settings)
    const currentKeys = new Set(alarms.map(alarmKey))
    let notificationFailed = false

    for (const alarm of alarms) {
      const key = alarmKey(alarm)
      const inWindow = isAlarmDue(alarm, baseline, checkedAt)
      const newlyDue = reason === 'mutation' &&
        !this.knownKeys.has(key) &&
        Date.parse(alarm.alarmAt) <= Date.parse(checkedAt)
      const eventStillActive = alarm.occurrence.kind === 'todo' ||
        Date.parse(checkedAt) < Date.parse(alarm.occurrence.end)
      const shouldDeliver = (inWindow || newlyDue) &&
        eventStillActive &&
        !this.notifiedKeys.has(key)
      if (!shouldDeliver) continue

      try {
        await this.dependencies.notify(
          notificationForAlarm(alarm, settings.timeZone)
        )
        this.notifiedKeys.add(key)
      } catch {
        notificationFailed = true
      }
    }

    if (notificationFailed) {
      return { ok: false, error: notificationFailure }
    }
    this.knownKeys = currentKeys
    this.lastCheckedAt = checkedAt
    return { ok: true, value: undefined }
  }
}
