import { afterEach, beforeEach, vi } from 'vitest'
import { config } from '@vue/test-utils'

import { TEST_NOW } from './support/time'
import { createScheduleI18n } from '../src/i18n'

config.global.plugins = [createScheduleI18n('en-US')]

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
