import { z } from 'zod'

export const SupportedLocaleSchema = z.enum(['en-US', 'zh-CN'])

export type SupportedLocale = z.infer<typeof SupportedLocaleSchema>

/** 将浏览器或 Electron 提供的语言标记归一化为产品支持的语言。 */
export function resolveSupportedLocale(language: string | undefined): SupportedLocale {
  return language?.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US'
}
