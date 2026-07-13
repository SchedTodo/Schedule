export interface TimeZoneOption {
  readonly label: string
  readonly value: string
  readonly [key: string]: unknown
}

function runtimeTimeZones(): readonly string[] {
  return typeof Intl.supportedValuesOf === 'function'
    ? Intl.supportedValuesOf('timeZone')
    : []
}

export function createTimeZoneOptions(
  currentTimeZone: string,
  supportedTimeZones: readonly string[] = runtimeTimeZones(),
  systemTimeZone: string = Intl.DateTimeFormat().resolvedOptions().timeZone
): TimeZoneOption[] {
  const values = new Set(['UTC', ...supportedTimeZones])
  if (systemTimeZone !== '') values.add(systemTimeZone)
  if (currentTimeZone !== '') values.add(currentTimeZone)
  return [...values]
    .sort((left, right) => left.localeCompare(right))
    .map((value) => ({ label: value, value }))
}
