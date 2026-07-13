import { describe, expect, it } from 'vitest'

import { createTimeZoneOptions } from '../../../src/features/settings/time-zone-options'

describe('createTimeZoneOptions', () => {
  it('sorts and deduplicates UTC, supported, system, and current zones', () => {
    expect(
      createTimeZoneOptions(
        'Asia/Shanghai',
        ['Europe/London', 'Asia/Shanghai', 'Europe/London'],
        'America/Chicago'
      )
    ).toEqual([
      { label: 'America/Chicago', value: 'America/Chicago' },
      { label: 'Asia/Shanghai', value: 'Asia/Shanghai' },
      { label: 'Europe/London', value: 'Europe/London' },
      { label: 'UTC', value: 'UTC' }
    ])
  })

  it('contains every runtime-supported canonical time zone', () => {
    const values = new Set(createTimeZoneOptions('UTC').map(({ value }) => value))
    expect(values.has('UTC')).toBe(true)
    for (const timeZone of Intl.supportedValuesOf('timeZone')) {
      expect(values.has(timeZone)).toBe(true)
    }
  })

  it('falls back to UTC, system, and current zones without a supported list', () => {
    expect(createTimeZoneOptions('Asia/Shanghai', [], 'America/Chicago')).toEqual([
      { label: 'America/Chicago', value: 'America/Chicago' },
      { label: 'Asia/Shanghai', value: 'Asia/Shanghai' },
      { label: 'UTC', value: 'UTC' }
    ])
  })
})
