import type { TimeZoneResolution } from './evaluator'

/** 使用用户配置的不区分大小写简写表解析时区。 */
export function resolveConfiguredTimeZoneAbbreviation(
  value: string,
  abbreviations: Readonly<Record<string, string>>
): TimeZoneResolution {
  const timeZone = abbreviations[value.toUpperCase()]
  return timeZone === undefined
    ? { kind: 'unknown' }
    : { kind: 'resolved', timeZone }
}
