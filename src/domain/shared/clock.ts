import { Temporal } from './temporal'

export interface Clock {
  now(): Temporal.Instant
}

export class SystemClock implements Clock {
  now(): Temporal.Instant {
    return Temporal.Now.instant()
  }
}

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
