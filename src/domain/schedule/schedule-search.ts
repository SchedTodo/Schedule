export type ScheduleSearchGroups = readonly (readonly string[])[]

/** 将搜索文本解析为 AND 分组；每组中的词以 OR 连接。 */
export function parseScheduleSearch(value: string): ScheduleSearchGroups {
  const groups: string[][] = []
  let joinsPreviousGroup = false

  for (const token of value.match(/\||[^\s|]+/gu) ?? []) {
    if (token === '|') {
      joinsPreviousGroup = true
      continue
    }

    const previous = groups.at(-1)
    if (joinsPreviousGroup && previous !== undefined) previous.push(token)
    else groups.push([token])
    joinsPreviousGroup = false
  }

  return groups
}

/** 判断标题和日程备注是否满足全部搜索分组。 */
export function matchesScheduleSearch(
  groups: ScheduleSearchGroups,
  title: string,
  comment: string
): boolean {
  const fields = [title.toLocaleLowerCase(), comment.toLocaleLowerCase()]
  return groups.every((alternatives) =>
    alternatives.some((term) => {
      const normalizedTerm = term.toLocaleLowerCase()
      return fields.some((field) => field.includes(normalizedTerm))
    })
  )
}
