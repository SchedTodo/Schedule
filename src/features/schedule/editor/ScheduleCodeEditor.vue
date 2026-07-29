<script setup lang="ts">
import {
  acceptCompletion,
  autocompletion,
  completionKeymap,
  startCompletion
} from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { linter, lintKeymap, setDiagnostics } from '@codemirror/lint'
import { Compartment, EditorState, StateField } from '@codemirror/state'
import {
  Decoration,
  EditorView,
  hoverTooltip,
  keymap,
  type DecorationSet
} from '@codemirror/view'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  highlightedScheduleTokens,
  scheduleCompletionSource,
  scheduleDiagnostics,
  scheduleSemanticDescription,
  type ScheduleEditorSettings
} from './schedule-editor-support'
import { useShortcut } from '../../../app/shortcuts'

const props = withDefaults(defineProps<{
  modelValue: string
  settings: ScheduleEditorSettings
  readonly?: boolean
  allowEmpty?: boolean
  ariaLabel: string
}>(), {
  readonly: false,
  allowEmpty: false
})
const emit = defineEmits<{
  'update:modelValue': [value: string]
  focus: []
  blur: []
}>()
const root = ref<HTMLElement | null>(null)
const { locale } = useI18n()
const settingsCompartment = new Compartment()
const editableCompartment = new Compartment()
let view: EditorView | undefined

const highlightField = StateField.define<DecorationSet>({
  create: (state) => buildHighlights(state.doc.toString()),
  update: (value, transaction) =>
    transaction.docChanged ? buildHighlights(transaction.newDoc.toString()) : value,
  provide: (field) => EditorView.decorations.from(field)
})

function buildHighlights(source: string): DecorationSet {
  return Decoration.set(
    highlightedScheduleTokens(source).map((token) =>
      Decoration.mark({ class: `schedule-token schedule-token--${token.kind}` })
        .range(token.from, token.to)
    ),
    true
  )
}

function languageExtensions(settings: ScheduleEditorSettings) {
  if (props.readonly) return []
  return [
    autocompletion({
      override: [scheduleCompletionSource(settings, locale.value)],
      activateOnTyping: true,
      defaultKeymap: false,
      interactionDelay: 0,
      maxRenderedOptions: 100
    }),
    linter(
      (editor) => scheduleDiagnostics(editor.state.doc.toString(), settings, props.allowEmpty),
      { delay: 300 }
    )
  ]
}

function editableExtensions(readonly: boolean) {
  return [
    EditorState.readOnly.of(readonly),
    EditorView.editable.of(!readonly)
  ]
}

const scheduleCompletionKeymap =
  completionKeymap.filter(({ key }) => key !== 'Ctrl-Space')

useShortcut('editor.startCompletion', () => (
  view === undefined ? false : startCompletion(view)
), {
  enabled: () => !props.readonly && (view?.hasFocus ?? false),
  priority: 40
})
useShortcut('editor.acceptCompletion', () => (
  view === undefined ? false : acceptCompletion(view)
), {
  enabled: () => !props.readonly && (view?.hasFocus ?? false),
  priority: 40
})

function hoverExtension() {
  return hoverTooltip((editor, position) => {
    const token = highlightedScheduleTokens(editor.state.doc.toString())
      .find((candidate) => candidate.from <= position && candidate.to >= position)
    if (token === undefined) return null
    const description = scheduleSemanticDescription(token.text, locale.value)
    if (description === undefined) return null
    return {
      pos: token.from,
      end: token.to,
      above: true,
      create: () => {
        const dom = document.createElement('div')
        dom.className = 'schedule-code-hover'
        dom.textContent = description
        return { dom }
      }
    }
  })
}

function currentDiagnostics() {
  return scheduleDiagnostics(
    view?.state.doc.toString() ?? props.modelValue,
    props.settings,
    props.allowEmpty
  )
}

function validate(): boolean {
  if (view === undefined) return currentDiagnostics().length === 0
  const diagnostics = currentDiagnostics()
  view.dispatch(setDiagnostics(view.state, diagnostics))
  const first = diagnostics[0]
  if (first !== undefined) {
    const position = Math.min(first.from, view.state.doc.length)
    view.dispatch({ selection: { anchor: position }, scrollIntoView: true })
    view.focus()
  }
  return diagnostics.length === 0
}

function insertText(text: string) {
  if (view === undefined || props.readonly) return
  const selection = view.state.selection.main
  view.dispatch({
    changes: { from: selection.from, to: selection.to, insert: text },
    selection: { anchor: selection.from + text.length },
    scrollIntoView: true
  })
  view.focus()
}

function hasFocus() {
  return view?.hasFocus ?? false
}

function focus() {
  view?.focus()
  emit('focus')
}

defineExpose({ validate, insertText, hasFocus, focus })

onMounted(() => {
  if (root.value === null) return
  view = new EditorView({
    parent: root.value,
    state: EditorState.create({
      doc: props.modelValue,
      extensions: [
        history(),
        keymap.of([
          ...scheduleCompletionKeymap,
          ...lintKeymap,
          ...defaultKeymap,
          ...historyKeymap
        ]),
        EditorView.lineWrapping,
        EditorView.contentAttributes.of({
          'aria-label': props.ariaLabel,
          role: 'textbox',
          'aria-multiline': 'true',
          spellcheck: 'false'
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) emit('update:modelValue', update.state.doc.toString())
        }),
        EditorView.domEventHandlers({
          focus: () => { emit('focus') },
          blur: () => { emit('blur') }
        }),
        highlightField,
        hoverExtension(),
        editableCompartment.of(editableExtensions(props.readonly)),
        settingsCompartment.of(languageExtensions(props.settings))
      ]
    })
  })
})

watch(() => props.modelValue, (value) => {
  if (view === undefined || value === view.state.doc.toString()) return
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } })
})

watch(() => props.settings, (settings) => {
  view?.dispatch({ effects: settingsCompartment.reconfigure(languageExtensions(settings)) })
}, { deep: true })

watch(locale, () => {
  view?.dispatch({
    effects: settingsCompartment.reconfigure(languageExtensions(props.settings))
  })
})

watch(() => props.readonly, (readonly) => {
  view?.dispatch({
    effects: [
      editableCompartment.reconfigure(editableExtensions(readonly)),
      settingsCompartment.reconfigure(languageExtensions(props.settings))
    ]
  })
})

onBeforeUnmount(() => view?.destroy())
</script>

<template>
  <div
    ref="root"
    class="schedule-code-editor"
    :class="{ 'schedule-code-editor--readonly': readonly }"
  />
</template>

<style>
.schedule-code-editor {
  inline-size: 100%;
  min-block-size: 7.5rem;
  min-inline-size: 0;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-small);
  background: var(--color-surface);
  color: var(--color-text);
}

.schedule-code-editor:focus-within {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-accent) 18%, transparent);
}

.schedule-code-editor .cm-editor {
  min-block-size: inherit;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 0.925rem;
}

.schedule-code-editor .cm-scroller {
  max-block-size: 16rem;
  overflow: auto;
}

.schedule-code-editor .cm-content {
  min-block-size: 7.5rem;
  padding: 0.625rem 0;
  caret-color: var(--color-text);
}

.schedule-code-editor .cm-line {
  padding-inline: 0.75rem;
}

.schedule-code-editor .cm-focused {
  outline: none;
}

.schedule-code-editor .cm-tooltip,
.schedule-code-hover {
  border-color: var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
}

.schedule-code-editor .cm-completionInfo {
  white-space: pre-line;
}

.schedule-code-editor--readonly {
  min-block-size: auto;
  border: 0;
  background: transparent;
}

.schedule-code-editor--readonly .cm-content {
  min-block-size: auto;
  padding: 0;
}

.schedule-code-editor--readonly .cm-line {
  padding: 0;
}

.schedule-token--keyword { color: #8b5cf6; font-weight: 600; }
.schedule-token--date { color: #0f8a73; }
.schedule-token--time { color: #177ddc; }
.schedule-token--time-zone { color: #c76b00; }
.schedule-token--number { color: #b33a3a; }
.schedule-token--operator { color: var(--color-text-muted); }

.theme-dark .schedule-token--keyword { color: #c4a7ff; }
.theme-dark .schedule-token--date { color: #67d5bd; }
.theme-dark .schedule-token--time { color: #76baff; }
.theme-dark .schedule-token--time-zone { color: #ffc16b; }
.theme-dark .schedule-token--number { color: #ff8c8c; }
</style>
