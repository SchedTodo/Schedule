import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const currentUiModules = import.meta.glob(
  [
    '../../src/App.vue',
    '../../src/assets/styles/main.css',
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
const tokensCss = readFileSync(
  resolve(process.cwd(), 'src/assets/styles/tokens.css'),
  'utf8'
)
const scheduleCodeEditorSource = readFileSync(
  resolve(process.cwd(), 'src/features/schedule/editor/ScheduleCodeEditor.vue'),
  'utf8'
)

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

  it('does not depend on a global active class for grouped button state', () => {
    const globalStyles = Object.entries(currentUiModules)
      .find(([path]) => path.endsWith('/src/assets/styles/main.css'))?.[1]

    expect(globalStyles).not.toContain('.segmented-control .n-button.active')
  })

  it('defines distinct light and dark pressed-control tokens', () => {
    expect(tokensCss.match(/--color-control-pressed-background:/g)).toHaveLength(2)
    expect(tokensCss.match(/--shadow-control-pressed:/g)).toHaveLength(2)
    expect(tokensCss).toContain('inset 2px 2px 3px rgb(0 0 0 / 75%)')
    expect(tokensCss).toContain('inset -1px -1px 2px rgb(255 255 255 / 25%)')
  })

  it('matches the Schedule code editor radius to other form inputs', () => {
    expect(scheduleCodeEditorSource).toContain('border-radius: var(--radius-small)')
    expect(scheduleCodeEditorSource).not.toContain('border-radius: var(--radius-medium)')
  })

  it('keeps month cards fixed-width while hovering', () => {
    const month = Object.entries(currentUiModules)
      .find(([path]) => path.endsWith('/MonthScheduleView.vue'))?.[1] ?? ''

    expect(month).toContain('.schedule-card {')
    expect(month).toContain('inline-size: 100%')
    expect(month).not.toContain('inline-size: auto')
  })

  it('uses theme colors for the week header and day borders', () => {
    const week = Object.entries(currentUiModules)
      .find(([path]) => path.endsWith('/WeekScheduleView.vue'))?.[1] ?? ''

    expect(week).not.toContain('#fafafc')
    expect(week).not.toContain('border: 1px solid #eee')
    expect(week).toContain('background: var(--color-surface)')
    expect(week).toContain('color: var(--color-text)')
    expect(week).toContain('border: 1px solid var(--color-border)')
    expect(week).toContain('border-block-end: 1px solid var(--color-border)')
  })

  it('uses shared tokens for Schedule detail action spacing and past rows', () => {
    const detail = Object.entries(currentUiModules)
      .find(([path]) => path.endsWith('/src/pages/schedule/[id].vue'))?.[1] ?? ''

    expect(detail).toContain('.star-button { margin-inline-end: var(--space-4); }')
    expect(detail).toContain('.recurrence-code, .exclusion-code { border-radius: 0; }')
    expect(detail).toContain(':deep(.row-before-today) {')
    expect(detail).toContain('--n-td-text-color: var(--color-text-muted)')
    expect(detail).not.toContain(':deep(.row-before-today td) { color: #ccc; }')
  })
})
