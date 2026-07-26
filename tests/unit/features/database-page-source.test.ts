import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(process.cwd(), 'src/pages/database.vue'), 'utf8')

describe('Database page source', () => {
  it('documents the search operators in the input hint', () => {
    expect(source).toContain('Search Name or Comment (space: AND, |: OR)...')
  })

  it('lets the search field fill the remaining filter width', () => {
    expect(source).toContain('class="database-search"')
    expect(source).toContain('.database-search {')
    expect(source).toContain('flex: 1 1 auto;')
    expect(source).toContain('min-inline-size: 0;')
    expect(source).toContain('max-inline-size: none;')
    expect(source).not.toContain('.database-filter > :first-of-type')
  })

  it('uses a typed data table with an ellipsized 8rem ID column', () => {
    expect(source).toContain('NDataTable')
    expect(source).toContain('DataTableColumns<SchedulePageItemDto>')
    expect(source).toContain("width: '8rem'")
    expect(source).toContain('ellipsis: { tooltip: true }')
    expect(source).toContain("className: 'database-id-cell'")
    expect(source).not.toContain('<table>')
    expect(source).not.toContain('class="database-pagination"')
  })

  it('uses the outlined circular Restore control from option A', () => {
    expect(source).toContain("import { ReloadOutline, Star } from '@vicons/ionicons5'")
    expect(source).toContain('h(ReloadOutline)')
    expect(source).toContain("size: 'tiny'")
    expect(source).not.toContain('ArrowUndo')
  })
})
