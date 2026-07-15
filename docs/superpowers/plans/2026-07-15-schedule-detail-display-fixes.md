# Schedule Detail Display Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make detail time codes break after retained semicolons, separate the star and Edit controls, and visibly mute past occurrence rows in both themes.

**Architecture:** Keep all behavior in the existing Schedule detail page. A local presentation function formats time-code text without mutating gateway data; scoped CSS uses existing design tokens and explicit selectors for the two visual fixes.

**Tech Stack:** Vue 3 SFC, TypeScript 6, Naive UI, Vue Test Utils, Vitest, CSS custom properties

## Global Constraints

- Keep `src` browser-runnable and platform-independent.
- Do not introduce TanStack Query.
- Use test-driven development: observe the focused tests fail before changing production code.
- Preserve unrelated user changes, including the existing formatting edits in `src/pages/schedule/[id].vue`.
- Do not weaken TypeScript strictness.

---

## File Structure

- Modify `src/pages/schedule/[id].vue`: format the two time-code fields and add the scoped action-spacing and past-row theme styles.
- Modify `tests/unit/features/secondary-pages.test.ts`: verify rendered time-code line breaks and the star button's dedicated class.
- Modify `tests/unit/ui-source-conventions.test.ts`: verify the visual rules use shared spacing and muted-text tokens and cover nested cell content.

### Task 1: Schedule detail display behavior

**Files:**
- Modify: `tests/unit/features/secondary-pages.test.ts`
- Modify: `tests/unit/ui-source-conventions.test.ts`
- Modify: `src/pages/schedule/[id].vue`

**Interfaces:**
- Consumes: `ScheduleDto.recurrenceCode`, `ScheduleDto.exclusionCode`, existing `isPastOccurrence(row, timeZone)` row classification, and `--space-4` / `--color-text-muted` theme tokens.
- Produces: local `formatTimeCode(value: string): string`, `.star-button`, `.recurrence-code`, `.exclusion-code`, and a past-row override for Naive UI's `--n-td-text-color` variable.

- [x] **Step 1: Write failing component tests for time-code formatting and the star button class**

In the existing `restores the Schedule header with Info and Times cards` test, seed the schedule with semicolon-separated codes:

```ts
const detailSchedule: ScheduleDto = {
  ...schedule,
  recurrenceCode: '2026/7/15 10:00;2026/7/16 11:00;',
  exclusionCode: '2026/7/17 12:00;2026/7/18 13:00;'
}
const platform = createInMemoryGateway([schedule])
vi.spyOn(platform.schedules, 'findById').mockResolvedValue({
  ok: true,
  value: { ...detailSchedule, deleted: false }
})
```

After the page has loaded, add these assertions:

```ts
expect(wrapper.get('.recurrence-code').element.textContent)
  .toBe('2026/7/15 10:00;\n2026/7/16 11:00;\n')
expect(wrapper.get('.exclusion-code').element.textContent)
  .toBe('2026/7/17 12:00;\n2026/7/18 13:00;\n')
expect(wrapper.find('.star-button').exists()).toBe(true)
```

- [x] **Step 2: Write a failing source-convention test for theme-safe detail styles**

In `tests/unit/ui-source-conventions.test.ts`, add:

```ts
it('uses shared tokens for Schedule detail action spacing and past rows', () => {
  const detail = Object.entries(currentUiModules)
    .find(([path]) => path.endsWith('/src/pages/schedule/[id].vue'))?.[1] ?? ''

  expect(detail).toContain('.star-button { margin-inline-end: var(--space-4); }')
  expect(detail).toContain(':deep(.row-before-today) {')
  expect(detail).toContain('--n-td-text-color: var(--color-text-muted)')
  expect(detail).not.toContain(':deep(.row-before-today td) { color: #ccc; }')
})
```

- [x] **Step 3: Run focused tests and verify RED**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/unit/features/secondary-pages.test.ts tests/unit/ui-source-conventions.test.ts
```

Expected: FAIL because `.recurrence-code`, `.exclusion-code`, and `.star-button` do not exist and the detail page still uses the hard-coded `#ccc` rule.

- [x] **Step 4: Add the minimal time-code presentation function and template hooks**

In `src/pages/schedule/[id].vue`, add next to the existing `format` function:

```ts
const formatTimeCode = (value: string) => value.replace(/;\s*/g, ';\n')
```

Add `class="star-button"` to the existing star `NButton`, and change the two time-code spans to:

```vue
<b>rTime</b><span class="pre-line recurrence-code">{{ formatTimeCode(detail.schedule.value.recurrenceCode) }}</span>
<b>exTime</b><span class="pre-line exclusion-code">{{ formatTimeCode(detail.schedule.value.exclusionCode) }}</span>
```

- [x] **Step 5: Add the minimal scoped visual rules**

Replace the hard-coded past-row rule and add star spacing in `src/pages/schedule/[id].vue`:

```css
.star-button { margin-inline-end: var(--space-4); }
:deep(.row-before-today) {
  --n-td-text-color: var(--color-text-muted);
}
```

- [x] **Step 6: Run focused tests and verify GREEN**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/unit/features/secondary-pages.test.ts tests/unit/ui-source-conventions.test.ts
```

Expected: both test files pass with zero failures.

- [ ] **Step 7: Run project verification**

Run each command and require exit code `0`:

```powershell
.\node_modules\.bin\eslint.cmd .
.\node_modules\.bin\vue-tsc.cmd --noEmit -p tsconfig.app.json
.\node_modules\.bin\vitest.cmd run tests/unit tests/contracts tests/parser
.\node_modules\.bin\vite.cmd build
```

- [x] **Step 8: Review the final diff without committing overlapping user work**

Run:

```powershell
git -c safe.directory=D:/project/Schedule diff --check
git -c safe.directory=D:/project/Schedule diff -- src/pages/schedule/[id].vue tests/unit/features/secondary-pages.test.ts tests/unit/ui-source-conventions.test.ts
```

Expected: no whitespace errors, and every added line maps to one of the three requested display fixes. Do not create an implementation commit because `src/pages/schedule/[id].vue` already contains unrelated user changes in the same working-tree file.
