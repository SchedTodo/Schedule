/** 计算自动跟随时的滚动位置，把当前时间尽量放在视口上方 30%。 */
export function widgetFollowScrollTop(
  markerOffset: number,
  viewportHeight: number,
  scrollHeight: number
): number {
  return Math.min(
    Math.max(0, markerOffset - viewportHeight * 0.3),
    Math.max(0, scrollHeight - viewportHeight)
  )
}
