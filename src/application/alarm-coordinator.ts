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

export class AlarmCoordinator {
  private lastCheckedAt: string | undefined
  private knownKeys = new Set<string>()
  private readonly notifiedKeys = new Set<string>()

  constructor(private readonly dependencies: AlarmCoordinatorDependencies) {}

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
