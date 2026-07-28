import type { SupportedLocale } from './locale'
import { messages } from './messages'

export function translateMessage(
  locale: SupportedLocale,
  key: string,
  parameters: Readonly<Record<string, string | number>> = {}
): string {
  const value = key.split('.').reduce<unknown>(
    (current, segment) =>
      typeof current === 'object' && current !== null
        ? Reflect.get(current, segment)
        : undefined,
    messages[locale]
  )
  const fallback = key.split('.').reduce<unknown>(
    (current, segment) =>
      typeof current === 'object' && current !== null
        ? Reflect.get(current, segment)
        : undefined,
    messages['en-US']
  )
  const template = typeof value === 'string'
    ? value
    : typeof fallback === 'string' ? fallback : key
  return template.replace(/\{(\w+)\}/gu, (_, name: string) =>
    String(parameters[name] ?? `{${name}}`)
  )
}
