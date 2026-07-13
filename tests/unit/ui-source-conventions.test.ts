import { describe, expect, it } from 'vitest'

const currentUiModules = import.meta.glob(
  [
    '../../src/App.vue',
    '../../src/app/components/*.vue',
    '../../src/features/ideas/*.vue',
    '../../src/features/schedule/components/*.vue',
    '../../src/pages/**/*.vue',
    './app-shell.test.ts',
    './features/home-workspace.test.ts',
    './features/secondary-pages.test.ts'
  ],
  { eager: true, query: '?raw', import: 'default' }
) as Record<string, string>

describe('current UI source conventions', () => {
  it('uses product names instead of migration-oriented names', () => {
    const migrationWord = new RegExp(['leg', 'acy'].join(''), 'i')
    const violations = Object.entries(currentUiModules)
      .filter(([path, source]) => migrationWord.test(`${path}\n${source}`))
      .map(([path]) => path)

    expect(violations).toEqual([])
  })

  it('does not use text or emoji glyphs as application icons', () => {
    const forbidden = ['⌂', '◉', '⚙', '💡', '▶', '↻']
    const violations = Object.entries(currentUiModules)
      .filter(([, source]) => forbidden.some((glyph) => source.includes(glyph)))
      .map(([path]) => path)

    expect(violations).toEqual([])
  })
})
