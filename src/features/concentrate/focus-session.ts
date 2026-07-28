import type { NotificationInput } from '../../contracts/notification.contract'
import type { CreateConcentrationRecordInput } from '../../contracts/record.contract'
import {
  FocusCycle,
  type FocusCycleDurations,
  type FocusCycleSnapshot,
  type FocusCycleTransition
} from './focus-cycle'
import type { SupportedLocale } from '../../i18n/locale'
import { translateMessage } from '../../i18n/translate'

interface SelectedTodo {
  readonly scheduleId: string
}

interface FocusInterval {
  readonly scheduleId: string
  readonly startMs: number
  readonly endMs: number
}

interface FocusSessionDependencies {
  readonly locale: SupportedLocale
  readonly now: () => number
  readonly notify: (input: NotificationInput) => Promise<unknown>
  readonly saveRecord: (input: CreateConcentrationRecordInput) => Promise<unknown>
}

const minimumRecordMs = 60_000

function notificationFor(
  transition: FocusCycleTransition,
  locale: SupportedLocale
): NotificationInput {
  if (transition.stage === 'focus') {
    return {
      title: translateMessage(locale, 'focus.timeToFocus'),
      body: translateMessage(locale, 'focus.focusCount', {
        current: transition.focusNumber
      })
    }
  }
  return transition.stage === 'smallBreak'
    ? {
        title: translateMessage(locale, 'focus.takeBreak'),
        body: translateMessage(locale, 'focus.smallBreak')
      }
    : {
        title: translateMessage(locale, 'focus.takeBreak'),
        body: translateMessage(locale, 'focus.bigBreak')
      }
}

/**
 * 协调一次专注会话中的周期推进、阶段通知与 Todo 专注记录。
 *
 * 会话把 `FocusCycle` 产生的阶段边界转换为外部副作用，并暂存有效专注区间；
 * 切换 Todo 或释放会话时才通过注入端口持久化这些区间。
 */
export class FocusSession {
  readonly #cycle: FocusCycle
  /** 当前接收专注时长的 Todo；休息阶段仍保留选择但不累计区间。 */
  #selectedTodo: SelectedTodo | undefined
  /** 正在进行的专注区间起点；暂停或进入休息阶段时清空。 */
  #activeStartMs: number | undefined
  /** 已闭合但尚未交给持久化端口的专注区间。 */
  #intervals: FocusInterval[] = []

  constructor(
    durations: FocusCycleDurations,
    private readonly dependencies: FocusSessionDependencies
  ) {
    this.#cycle = new FocusCycle(durations, dependencies.now)
  }

  /** 启动专注周期，并在已选择 Todo 时开始记录专注区间。 */
  start(): void {
    if (this.#cycle.snapshot().running) return
    this.#cycle.start()
    if (this.#cycle.snapshot().stage === 'focus' && this.#selectedTodo) {
      this.#activeStartMs = this.dependencies.now()
    }
  }

  /** 暂停周期并关闭当前正在记录的专注区间。 */
  pause(): void {
    if (!this.#cycle.snapshot().running) return
    this.#processTransitions(this.#cycle.pause())
    this.#closeActive(this.dependencies.now())
  }

  tick(): void {
    this.#processTransitions(this.#cycle.tick())
  }

  snapshot(): FocusCycleSnapshot {
    return this.#cycle.snapshot()
  }

  /** 切换关联 Todo，先结算并保存旧 Todo 的区间，再为新 Todo 开始计时。 */
  async selectTodo(todo: SelectedTodo | undefined): Promise<void> {
    this.tick()
    const previousScheduleId = this.#selectedTodo?.scheduleId
    this.#closeActive(this.dependencies.now())
    if (previousScheduleId) await this.#flush(previousScheduleId)
    this.#selectedTodo = todo
    if (todo && this.#cycle.snapshot().running && this.#cycle.snapshot().stage === 'focus') {
      this.#activeStartMs = this.dependencies.now()
    }
  }

  /** 结算当前状态并保存所有尚未刷新的合格专注记录。 */
  async dispose(): Promise<void> {
    this.tick()
    this.#closeActive(this.dependencies.now())
    const scheduleIds = [...new Set(this.#intervals.map(({ scheduleId }) => scheduleId))]
    for (const scheduleId of scheduleIds) await this.#flush(scheduleId)
    this.#selectedTodo = undefined
  }

  /** 处理阶段切换通知，并在专注与休息边界正确开合记录区间。 */
  #processTransitions(transitions: readonly FocusCycleTransition[]): void {
    for (const transition of transitions) {
      this.#closeActive(transition.atMs)
      void this.dependencies.notify(
        notificationFor(transition, this.dependencies.locale)
      ).catch(() => undefined)
      if (transition.stage === 'focus' && this.#selectedTodo) {
        this.#activeStartMs = transition.atMs
      }
    }
  }

  /** 关闭活动区间并暂存，空区间或倒序区间不会写入。 */
  #closeActive(endMs: number): void {
    if (this.#activeStartMs === undefined || !this.#selectedTodo) return
    if (endMs > this.#activeStartMs) {
      this.#intervals.push({
        scheduleId: this.#selectedTodo.scheduleId,
        startMs: this.#activeStartMs,
        endMs
      })
    }
    this.#activeStartMs = undefined
  }

  /** 保存指定 Todo 超过最小时长的区间，并从待处理队列移除它们。 */
  async #flush(scheduleId: string): Promise<void> {
    const selected = this.#intervals.filter((value) => value.scheduleId === scheduleId)
    this.#intervals = this.#intervals.filter((value) => value.scheduleId !== scheduleId)
    await Promise.all(selected
      .filter(({ startMs, endMs }) => endMs - startMs > minimumRecordMs)
      .map(({ startMs, endMs }) => this.dependencies.saveRecord({
        scheduleId,
        start: new Date(startMs).toISOString(),
        end: new Date(endMs).toISOString()
      }).catch(() => undefined)))
  }
}
