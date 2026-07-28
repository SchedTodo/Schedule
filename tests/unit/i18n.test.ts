import { describe, expect, it } from 'vitest'

import { resolveSupportedLocale } from '../../src/i18n/locale'
import { enUS, zhCN } from '../../src/i18n/messages'

function keys(value: object, prefix = ''): string[] {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix === '' ? key : `${prefix}.${key}`
    return typeof child === 'string' ? [path] : keys(child as object, path)
  }).sort()
}

describe('i18n', () => {
  it('resolves Chinese locales and falls back to English', () => {
    expect(resolveSupportedLocale('zh-Hans-CN')).toBe('zh-CN')
    expect(resolveSupportedLocale('zh-TW')).toBe('zh-CN')
    expect(resolveSupportedLocale('en-GB')).toBe('en-US')
    expect(resolveSupportedLocale(undefined)).toBe('en-US')
  })

  it('keeps both catalogs structurally complete', () => {
    expect(keys(zhCN)).toEqual(keys(enUS))
  })
})
