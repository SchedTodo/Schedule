import { inject, onBeforeUnmount, onMounted, type InjectionKey } from 'vue'
import { z } from 'zod'

export const shortcutDefinitions = [
  { command: 'navigation.previous', labelKey: 'shortcuts.previousPage' },
  { command: 'navigation.next', labelKey: 'shortcuts.nextPage' },
  { command: 'schedule.openAdd', labelKey: 'shortcuts.openAdd' },
  { command: 'schedule.closeModal', labelKey: 'shortcuts.closeModal' },
  { command: 'schedule.submitModal', labelKey: 'shortcuts.submitModal' },
  { command: 'schedule.insertMonday', labelKey: 'shortcuts.insertMonday' },
  { command: 'schedule.insertTuesday', labelKey: 'shortcuts.insertTuesday' },
  { command: 'schedule.insertWednesday', labelKey: 'shortcuts.insertWednesday' },
  { command: 'schedule.insertThursday', labelKey: 'shortcuts.insertThursday' },
  { command: 'schedule.insertFriday', labelKey: 'shortcuts.insertFriday' },
  { command: 'schedule.insertSaturday', labelKey: 'shortcuts.insertSaturday' },
  { command: 'schedule.insertSunday', labelKey: 'shortcuts.insertSunday' },
  { command: 'editor.startCompletion', labelKey: 'shortcuts.startCompletion' },
  { command: 'editor.acceptCompletion', labelKey: 'shortcuts.acceptCompletion' }
] as const

export type ShortcutCommand = typeof shortcutDefinitions[number]['command']
export type ShortcutBinding = string | null
export type ShortcutBindings = Record<ShortcutCommand, ShortcutBinding>

export const defaultShortcutBindings: ShortcutBindings = Object.freeze({
  'navigation.previous': 'Ctrl+ArrowLeft',
  'navigation.next': 'Ctrl+ArrowRight',
  'schedule.openAdd': 'Ctrl+ArrowUp',
  'schedule.closeModal': 'Ctrl+ArrowDown',
  'schedule.submitModal': 'Ctrl+Enter',
  'schedule.insertMonday': 'Ctrl+1',
  'schedule.insertTuesday': 'Ctrl+2',
  'schedule.insertWednesday': 'Ctrl+3',
  'schedule.insertThursday': 'Ctrl+4',
  'schedule.insertFriday': 'Ctrl+5',
  'schedule.insertSaturday': 'Ctrl+6',
  'schedule.insertSunday': 'Ctrl+7',
  'editor.startCompletion': 'Alt+Enter',
  'editor.acceptCompletion': 'Tab'
})

const modifiers = ['Ctrl', 'Alt', 'Shift', 'Meta'] as const
const modifierKeys = new Set(['Alt', 'Control', 'Meta', 'Shift'])
const allowedSingleKeys = new Set([
  'Tab', 'Escape', 'Enter', 'Space', 'Backspace', 'Delete', 'Insert', 'Home', 'End',
  'PageUp', 'PageDown', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'
])
const reservedBindings = new Set([
  'Alt+F4',
  'F5',
  'Ctrl+L', 'Ctrl+N', 'Ctrl+Q', 'Ctrl+R', 'Ctrl+T', 'Ctrl+W',
  'Ctrl+Shift+R',
  'Meta+L', 'Meta+N', 'Meta+Q', 'Meta+R', 'Meta+T', 'Meta+W',
  'Meta+Shift+R'
])
const functionKeyPattern = /^F(?:[1-9]|1[0-2])$/u
const canonicalBindingPattern =
  /^(?:Ctrl\+)?(?:Alt\+)?(?:Shift\+)?(?:Meta\+)?(?:[A-Z0-9]|F(?:[1-9]|1[0-2])|Tab|Escape|Enter|Space|Backspace|Delete|Insert|Home|End|PageUp|PageDown|ArrowUp|ArrowDown|ArrowLeft|ArrowRight)$/u

function isSafeBinding(binding: string): boolean {
  if (reservedBindings.has(binding)) return false
  const key = binding.split('+').at(-1) ?? ''
  return binding.includes('+') || allowedSingleKeys.has(key) || functionKeyPattern.test(key)
}

const ShortcutBindingSchema = z.string()
  .regex(canonicalBindingPattern)
  .refine(isSafeBinding)
  .nullable()

export const ShortcutBindingsSchema = z.object(Object.fromEntries(
  shortcutDefinitions.map(({ command }) => [
    command,
    ShortcutBindingSchema
  ])
) as Record<ShortcutCommand, typeof ShortcutBindingSchema>).strict()
  .superRefine((bindings, context) => {
    const assigned = new Map<string, ShortcutCommand>()
    for (const { command } of shortcutDefinitions) {
      const binding = bindings[command]
      if (binding === null) continue
      if (assigned.has(binding)) {
        context.addIssue({
          code: 'custom',
          message: 'Shortcut bindings must be unique',
          path: [command]
        })
      } else {
        assigned.set(binding, command)
      }
    }
  })

export type ShortcutCaptureFailure =
  | 'modifier-only'
  | 'modifier-required'
  | 'reserved'
  | 'unsupported'

export type ShortcutCaptureResult =
  | { readonly ok: true, readonly binding: string }
  | { readonly ok: false, readonly reason: ShortcutCaptureFailure }

function normalizedKey(key: string): string | null {
  if (modifierKeys.has(key)) return null
  if (key === ' ') return 'Space'
  if (key === 'Esc') return 'Escape'
  if (key.length === 1 && /[a-z]/iu.test(key)) return key.toUpperCase()
  if (key.length === 1 && /[0-9]/u.test(key)) return key
  if (allowedSingleKeys.has(key) || functionKeyPattern.test(key)) return key
  return null
}

function eventBinding(event: KeyboardEvent): string | null {
  const key = normalizedKey(event.key)
  if (key === null) return null
  const parts: string[] = []
  if (event.ctrlKey) parts.push('Ctrl')
  if (event.altKey) parts.push('Alt')
  if (event.shiftKey) parts.push('Shift')
  if (event.metaKey) parts.push('Meta')
  parts.push(key)
  return parts.join('+')
}

export function captureShortcut(event: KeyboardEvent): ShortcutCaptureResult {
  if (modifierKeys.has(event.key)) return { ok: false, reason: 'modifier-only' }
  const binding = eventBinding(event)
  if (binding === null) return { ok: false, reason: 'unsupported' }
  const hasModifier = modifiers.some((modifier) => binding.startsWith(`${modifier}+`) ||
    binding.includes(`+${modifier}+`))
  const key = binding.split('+').at(-1) ?? ''
  if (!hasModifier && !allowedSingleKeys.has(key) && !functionKeyPattern.test(key)) {
    return { ok: false, reason: 'modifier-required' }
  }
  if (reservedBindings.has(binding)) return { ok: false, reason: 'reserved' }
  return { ok: true, binding }
}

export function matchesShortcut(event: KeyboardEvent, binding: ShortcutBinding): boolean {
  return binding !== null && eventBinding(event) === binding
}

export function formatShortcut(binding: ShortcutBinding): string {
  if (binding === null) return ''
  return binding
    .replace('ArrowLeft', 'Arrow Left')
    .replace('ArrowRight', 'Arrow Right')
    .replace('ArrowUp', 'Arrow Up')
    .replace('ArrowDown', 'Arrow Down')
    .split('+')
    .join(' + ')
}

export function findShortcutConflict(
  bindings: ShortcutBindings,
  command: ShortcutCommand,
  binding: ShortcutBinding
): ShortcutCommand | undefined {
  if (binding === null) return undefined
  return shortcutDefinitions
    .map(({ command: candidate }) => candidate)
    .find((candidate) => candidate !== command && bindings[candidate] === binding)
}

export interface ShortcutRegistrationOptions {
  readonly enabled?: () => boolean
  readonly priority?: number
}

export type ShortcutHandler = () => boolean | void

interface ShortcutRegistration {
  readonly handler: ShortcutHandler
  readonly enabled: () => boolean
  readonly priority: number
}

export interface ShortcutManager {
  start(): void
  stop(): void
  register(
    command: ShortcutCommand,
    handler: ShortcutHandler,
    options?: ShortcutRegistrationOptions
  ): () => void
}

export function createShortcutManager(
  bindings: () => ShortcutBindings
): ShortcutManager {
  const registrations = new Map<ShortcutCommand, Set<ShortcutRegistration>>()
  let started = false

  const onKeydown = (event: KeyboardEvent) => {
    const current = bindings()
    const definition = shortcutDefinitions.find(
      ({ command }) => matchesShortcut(event, current[command])
    )
    if (definition === undefined) return
    const candidates = [...(registrations.get(definition.command) ?? [])]
      .filter(({ enabled }) => enabled())
      .sort((left, right) => right.priority - left.priority)
    for (const candidate of candidates) {
      if (candidate.handler() === false) continue
      event.preventDefault()
      event.stopPropagation()
      return
    }
  }

  return {
    start() {
      if (started) return
      window.addEventListener('keydown', onKeydown)
      started = true
    },
    stop() {
      if (!started) return
      window.removeEventListener('keydown', onKeydown)
      started = false
    },
    register(command, handler, options = {}) {
      const registration: ShortcutRegistration = {
        handler,
        enabled: options.enabled ?? (() => true),
        priority: options.priority ?? 0
      }
      const commandRegistrations = registrations.get(command) ?? new Set()
      commandRegistrations.add(registration)
      registrations.set(command, commandRegistrations)
      return () => { commandRegistrations.delete(registration) }
    }
  }
}

export const shortcutManagerKey: InjectionKey<ShortcutManager> = Symbol('shortcut-manager')

export function useShortcut(
  command: ShortcutCommand,
  handler: ShortcutHandler,
  options?: ShortcutRegistrationOptions
) {
  const manager = inject(shortcutManagerKey, undefined)
  if (manager === undefined) return
  let dispose: (() => void) | undefined
  onMounted(() => { dispose = manager.register(command, handler, options) })
  onBeforeUnmount(() => { dispose?.() })
}
