import { describe, expect, it } from 'vitest'

import { parseScheduleSearch } from '../../../src/domain/schedule/schedule-search'

describe('parseScheduleSearch', () => {
  it('groups whitespace with AND and pipes with OR', () => {
    expect(parseScheduleSearch('项目 周报|复盘')).toEqual([
      ['项目'],
      ['周报', '复盘']
    ])
    expect(parseScheduleSearch('周报 | 复盘')).toEqual([
      ['周报', '复盘']
    ])
  })

  it('ignores empty pipe alternatives and keeps plus signs literal', () => {
    expect(parseScheduleSearch('|项目||复盘|')).toEqual([
      ['项目', '复盘']
    ])
    expect(parseScheduleSearch(' | || ')).toEqual([])
    expect(parseScheduleSearch('C++')).toEqual([['C++']])
  })
})
