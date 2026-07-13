# Legacy Parser Tests Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate all 57 legacy parser test blocks to deterministic v2 public-API compatibility tests and correct every exposed behavior difference.

**Architecture:** A single compatibility file preserves legacy test names and inputs while helpers translate v2 normalized statements and occurrence drafts into concise assertions. Parser grammar/evaluator changes are made only after a migrated test demonstrates a legacy incompatibility.

**Tech Stack:** TypeScript, Vitest, ANTLR parser, Temporal polyfill.

## Global Constraints

- `release/1.2.0:src/test/timeParser.test.ts` is authoritative.
- Preserve exactly 57 named compatibility tests.
- Use fixed `Temporal.Instant` and explicit time zones.
- Test public behavior; do not restore removed Luxon, RRule, Prisma, or settings-service internals.
- Follow RED → GREEN → REFACTOR for every behavior correction.

---

### Task 1: Create the auditable 57-case compatibility suite

**Files:**
- Create: `tests/parser/legacy-time-parser-compatibility.test.ts`

**Interfaces:**
- Consumes: `parseSchedule(source, context)` and `expandScheduleOccurrences(recurrenceCode, exclusionCode, context)`.
- Produces: `statement(source)`, `expand(recurrence, exclusion?)`, and exactly 57 legacy-named tests.

- [ ] **Step 1: Add deterministic helpers and all legacy cases**

Define a fixed evaluation context at `2026-07-11T02:00:00Z`, default `Asia/Shanghai`, and an abbreviation resolver that preserves legacy fixed-offset abbreviation semantics. Translate each old assertion to normalized statements or occurrence drafts while retaining its test name and input.

- [ ] **Step 2: Verify the mapping count**

Run a source-count check for `test(` in the legacy file and `it(`/`test(` in the compatibility file. Expected: `57` and `57`.

- [ ] **Step 3: Run the compatibility file and verify RED**

Run: `.\node_modules\.bin\vitest.cmd run tests/parser/legacy-time-parser-compatibility.test.ts --reporter=verbose`

Expected: one or more assertion failures that identify unsupported or incompatible legacy behavior.

### Task 2: Restore missing syntax and evaluation semantics

**Files:**
- Modify only as failures require: `src/parser/grammar/Schedule.g4`
- Modify only as failures require: `src/parser/ast-builder.ts`
- Modify only as failures require: `src/parser/evaluator.ts`
- Modify only as failures require: `src/parser/parse-schedule.ts`
- Regenerate when grammar changes: `src/parser/generated/*`
- Test: `tests/parser/legacy-time-parser-compatibility.test.ts`

**Interfaces:**
- Consumes: failing legacy compatibility cases.
- Produces: legacy-compatible `ParseScheduleResult` and `ScheduleOccurrenceDraft[]`.

- [ ] **Step 1: Group failures by root cause**

Classify failures into date sugar, time sugar/unknown marks, frequency/by expansion, timezone abbreviation, exclusion/kind validation, and invalid-input rejection.

- [ ] **Step 2: Correct one root cause at a time**

For each group, run its failing test alone, apply the smallest parser/evaluator correction, rerun that test, then rerun the compatibility file. If `Schedule.g4` changes, run `pnpm parser:generate` before rerunning tests.

- [ ] **Step 3: Verify all parser suites**

Run: `.\node_modules\.bin\vitest.cmd run tests/parser`

Expected: all migrated and existing parser tests pass.

### Task 3: Final audit and verification

**Files:**
- Modify: `docs/development/v2-feature-gaps.md` only if migration exposes a documented compatibility qualification.

**Interfaces:**
- Consumes: complete 57-case compatibility suite.
- Produces: an auditable count and green project verification.

- [ ] **Step 1: Compare legacy and migrated names**

Extract the 57 test names from both sources and compare them as ordered lists. Expected: no missing names.

- [ ] **Step 2: Run project checks**

Run ESLint, Web/Electron TypeScript, all unit/contract/parser/integration tests, and Web/Electron builds. Expected: zero errors and zero failed tests.

- [ ] **Step 3: Commit**

Commit the plan, compatibility tests, generated parser changes when applicable, implementation corrections, and documentation with subject `test(parser): 迁移老版全部解析器用例`.
