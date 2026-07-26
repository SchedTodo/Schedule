import { Temporal } from './temporal'

export interface Clock {
  now(): Temporal.Instant
}

/** 使用系统当前时间提供生产环境所需的时钟实现。 */
export class SystemClock implements Clock {
  now(): Temporal.Instant {
    return Temporal.Now.instant()
  }
}

/** 始终返回构造时刻的确定性时钟，供测试和固定时间计算使用。 */
export class FixedClock implements Clock {
  readonly #instant: Temporal.Instant

  constructor(instant: string | Temporal.Instant) {
    this.#instant =
      typeof instant === 'string' ? Temporal.Instant.from(instant) : instant
  }

  now(): Temporal.Instant {
    return this.#instant
  }
}
