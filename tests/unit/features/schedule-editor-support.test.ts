import { CompletionContext } from '@codemirror/autocomplete'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { describe, expect, it, vi } from 'vitest'

import { defaultSettings } from '../../../src/contracts/settings.contract'
import {
  expectedScheduleTokenTypes,
  highlightedScheduleTokens,
  scheduleCompletionSource,
  scheduleDiagnostics,
  scheduleSemanticStandardExamples
} from '../../../src/features/schedule/editor/schedule-editor-support'
import ScheduleLexer from '../../../src/parser/generated/ScheduleLexer'
import {
  isAvailableTimeZoneAbbreviation,
  scheduleLiteral
} from '../../../src/parser/schedule-language'

describe('schedule editor language support', () => {
  it('derives fixed candidates from generated grammar literals', () => {
    expect(scheduleLiteral(ScheduleLexer.DAILY)).toBe('daily')
    expect(scheduleLiteral(ScheduleLexer.MONTHDAY)).toBe('monthday')
    expect(scheduleLiteral(ScheduleLexer.UTC)).toBe('UTC')
  })

  it('uses the generated lexer as the abbreviation conflict source', () => {
    for (const value of ['I', 'C', 'H', 'M', 'WORK_1']) {
      expect(isAvailableTimeZoneAbbreviation(value)).toBe(true)
    }
    for (const value of ['NOW', 'DAILY', 'BY', 'I2', 'C2', 'UTC']) {
      expect(isAvailableTimeZoneAbbreviation(value)).toBe(false)
    }
  })

  it('discovers grammar candidates at the cursor without a syntax state table', () => {
    expect(expectedScheduleTokenTypes('')).toEqual(expect.objectContaining({
      has: expect.any(Function)
    }))
    expect(expectedScheduleTokenTypes('').has(ScheduleLexer.TODAY)).toBe(true)
    expect(expectedScheduleTokenTypes('2026/7/28 10:00 ').has(ScheduleLexer.DAILY)).toBe(true)
    expect(expectedScheduleTokenTypes('2026/7/28 10:00 by[').has(ScheduleLexer.DAY)).toBe(true)
  })

  it('does not infer candidates after an earlier syntax error', () => {
    expect(expectedScheduleTokenTypes('now ')).toEqual(new Set())
  })

  it('does not offer an empty number placeholder', async () => {
    const state = EditorState.create({ doc: '' })
    const result = await scheduleCompletionSource(defaultSettings)(
      new CompletionContext(state, 0, true)
    )

    expect(result?.options.map(({ label }) => label)).not.toContain('number')
  })

  it.each([
    ['now', '当前时间'],
    ['start', '当天开始'],
    ['s', 'start 的缩写'],
    ['end', '当天结束'],
    ['e', 'end 的缩写']
  ])('adds Chinese semantics to the %s completion', async (label, detail) => {
    const source = '7/12-13 '
    const state = EditorState.create({ doc: source })
    const result = await scheduleCompletionSource(defaultSettings, 'zh-CN')(
      new CompletionContext(state, source.length, false)
    )
    const completion = result?.options.find((option) => option.label === label)

    expect(completion?.detail).toBe(detail)
    expect(completion?.info).toContain('补全预览')
    expect(completion?.info).toContain(`7/12-13 ${label}`)
  })

  it.each([
    ['…h', '小时数', '7/12-13 1h'],
    ['…m', '分钟数', '7/12-13 1m']
  ])('uses representative values in the %s preview', async (label, detail, preview) => {
    const source = '7/12-13 '
    const state = EditorState.create({ doc: source })
    const result = await scheduleCompletionSource(defaultSettings, 'zh-CN')(
      new CompletionContext(state, source.length, false)
    )
    const completion = result?.options.find((option) => option.label === label)

    expect(completion?.detail).toBe(detail)
    expect(completion?.info).toContain(preview)
  })

  it('uses only the current statement in a dynamic preview', async () => {
    const source = 'tdy 10:00;7/12-13 '
    const state = EditorState.create({ doc: source })
    const result = await scheduleCompletionSource(defaultSettings, 'zh-CN')(
      new CompletionContext(state, source.length, false)
    )
    const completion = result?.options.find((option) => option.label === 'now')

    expect(completion?.info).toContain('7/12-13 now')
    expect(completion?.info).not.toContain('tdy 10:00')
  })

  it('falls back to a tested standard example when the dynamic preview is invalid', async () => {
    const source = '12-13 '
    const state = EditorState.create({ doc: source })
    const result = await scheduleCompletionSource(defaultSettings, 'zh-CN')(
      new CompletionContext(state, source.length, true)
    )
    const completion = result?.options.find((option) => option.label === 'now')

    expect(completion?.info).toContain('标准示例')
    expect(completion?.info).toContain('tdy now')
    expect(completion?.info).not.toContain('12-13 now')
  })

  it('preserves time-zone mappings alongside localized semantics', async () => {
    const source = 'tdy 10:00 '
    const state = EditorState.create({ doc: source })
    const result = await scheduleCompletionSource({
      ...defaultSettings,
      timeZoneAbbreviations: { CST: 'America/Chicago' }
    }, 'zh-CN')(new CompletionContext(state, source.length, true))
    const completion = result?.options.find((option) => option.label === 'CST')

    expect(completion?.detail).toContain('时区')
    expect(completion?.detail).toContain('America/Chicago')
    expect(completion?.info).toContain('tdy 10:00 CST')
  })

  it('filters dynamic time zones by a case-insensitive full prefix', async () => {
    vi.stubGlobal('Intl', {
      ...Intl,
      supportedValuesOf: () => ['Asia/Shanghai', 'Asia/Tokyo', 'Europe/London']
    })
    const source = '2026/7/28 10:00 Asia/Sh'
    const state = EditorState.create({ doc: source })
    const result = await scheduleCompletionSource({
      ...defaultSettings,
      timeZone: 'Asia/Tokyo',
      timeZoneAbbreviations: { CST: 'America/Chicago' }
    })(new CompletionContext(state, source.length, false))

    expect(result && 'options' in result ? result.options.map(({ label }) => label) : [])
      .toEqual(['Asia/Shanghai'])
  })

  it.each([
    ['2026/7/28 10:00 by', 'by', '2026/7/28 10:00 by[]'],
    ['2026/7/28 10:00 by[da', 'day', '2026/7/28 10:00 by[day[]']
  ])('inserts bracket snippets for %s', async (source, label, expected) => {
    const state = EditorState.create({ doc: source })
    const result = await scheduleCompletionSource(defaultSettings)(
      new CompletionContext(state, source.length, false)
    )
    const completion = result?.options.find((option) => option.label === label)
    const parent = document.createElement('div')
    document.body.append(parent)
    const view = new EditorView({ state, parent })

    try {
      expect(completion).toBeDefined()
      expect(typeof completion?.apply).toBe('function')
      if (typeof completion?.apply !== 'function' || result === null) return
      completion.apply(view, completion, result.from, source.length)
      expect(view.state.doc.toString()).toBe(expected)
      expect(view.state.selection.main.anchor).toBe(expected.length - 1)
    } finally {
      view.destroy()
      parent.remove()
    }
  })

  it('adds semantics and a valid representative preview to by', async () => {
    const source = 'tdy 10:00 '
    const state = EditorState.create({ doc: source })
    const result = await scheduleCompletionSource(defaultSettings, 'en-US')(
      new CompletionContext(state, source.length, false)
    )
    const completion = result?.options.find((option) => option.label === 'by')

    expect(completion?.detail).toBe('Filter recurrence dates')
    expect(completion?.info).toContain('tdy 10:00 by[day[1]]')
  })

  it('keeps every standard semantic example parseable', () => {
    for (const example of scheduleSemanticStandardExamples()) {
      expect(scheduleDiagnostics(example, defaultSettings), example).toEqual([])
    }
  })

  it('highlights lexer tokens and reports semantic diagnostics on their source', () => {
    expect(highlightedScheduleTokens('tdy 10:00 daily').map(({ kind }) => kind))
      .toContain('keyword')
    const diagnostics = scheduleDiagnostics('2026/7/28 25:00', defaultSettings)
    expect(diagnostics[0]).toMatchObject({ from: 10, to: 15, severity: 'error' })
  })

  it('condenses parser token dumps for incomplete input', () => {
    const diagnostics = scheduleDiagnostics('12-13', defaultSettings)

    expect(diagnostics[0]?.message).toBe('Incomplete schedule expression')
    expect(diagnostics[0]?.message).not.toContain('expecting')
  })
})
