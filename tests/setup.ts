import { afterEach, beforeEach, vi } from 'vitest'

import { TEST_NOW } from './support/time'

const NativeDate = Date
const fixedEpochMilliseconds = NativeDate.parse(TEST_NOW)
const FixedDate = new Proxy(NativeDate, {
  apply: () => new NativeDate(fixedEpochMilliseconds).toString(),
  construct: (target, argumentsList, newTarget) => Reflect.construct(
    target,
    argumentsList.length === 0 ? [fixedEpochMilliseconds] : argumentsList,
    newTarget
  ),
  get: (target, property, receiver) => property === 'now'
    ? () => fixedEpochMilliseconds
    : Reflect.get(target, property, receiver)
})

beforeEach(() => {
  vi.stubGlobal('Date', FixedDate)
})

afterEach(() => {
  vi.unstubAllGlobals()
})
