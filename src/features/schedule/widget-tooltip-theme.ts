import type { CSSProperties } from 'vue'

/** 浮窗 Tooltip 使用半透明表面，避免在桌面组件上出现不协调的实心弹层。 */
export const widgetTooltipThemeOverrides = {
  color: 'rgb(24 24 28 / 62%)',
  boxShadow: 'none'
} as const

export const widgetTooltipContentStyle: CSSProperties = {
  backdropFilter: 'blur(12px) saturate(120%)'
}
