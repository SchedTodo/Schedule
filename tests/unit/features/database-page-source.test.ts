import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(process.cwd(), 'src/pages/database.vue'), 'utf8')

describe('Database page source', () => {
  it('lets the search field fill the remaining filter width', () => {
    expect(source).toContain('class="database-search"')
    expect(source).toContain('.database-search {')
    expect(source).toContain('flex: 1 1 auto;')
    expect(source).toContain('min-inline-size: 0;')
    expect(source).toContain('max-inline-size: none;')
    expect(source).not.toContain('.database-filter > :first-of-type')
  })

  it('limits the ID column to a single ellipsized 8rem line', () => {
    expect(source).toMatch(/<th class="database-id-cell">\s*ID\s*<\/th>/)
    expect(source).toMatch(/<td class="database-id-cell">\s*{{ item\.id }}\s*<\/td>/)
    expect(source).toContain('.database-id-cell {')
    expect(source).toContain('inline-size: 8rem;')
    expect(source).toContain('max-inline-size: 8rem;')
    expect(source).toContain('overflow: hidden;')
    expect(source).toContain('text-overflow: ellipsis;')
    expect(source).toContain('white-space: nowrap;')
  })

  it('uses the outlined circular Restore control from option A', () => {
    expect(source).toContain("import { ReloadOutline, Star } from '@vicons/ionicons5'")
    expect(source).toContain('<NIcon><ReloadOutline /></NIcon>')
    expect(source).toContain('size="tiny"')
    expect(source).not.toContain('ArrowUndo')
  })
})
