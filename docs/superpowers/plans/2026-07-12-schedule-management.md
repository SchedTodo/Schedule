# Schedule Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore legacy-compatible schedule editing, starring, soft deletion/restoration, occurrence operations, and Database filtering/pagination.

**Architecture:** Extend typed schedule/occurrence contracts without changing the existing simple list API. Application services enforce invariants and repositories perform atomic schedule/occurrence updates. Browser and Electron adapters expose identical named methods; detail and Database pages consume only gateway DTOs.

**Tech Stack:** TypeScript 6, Zod 4, Temporal, Vue 3, Drizzle SQLite, Vitest.

## Global Constraints

- Preserve `release/1.2.0` behavior, including forbidden event/Todo kind changes.
- Preserve matching occurrence IDs, comments, and done state when rules change.
- Do not migrate legacy database data.
- Keep renderer code platform-neutral and validate both IPC directions.
- Use RED → GREEN → REFACTOR.

---

### Task 1: Schedule management contracts

**Files:** Modify `src/contracts/schedule.contract.ts`, `src/contracts/occurrence.contract.ts`, and `src/contracts/platform.contract.ts`; test `tests/contracts/schedule-management.contract.test.ts`.

**Interfaces:** Add `update`, `setStarred`, `setDeleted`, and `searchPage`; add occurrence `listBySchedule`, `updateComment`, and `exclude`; produce `SchedulePageDto { items, total }`.

- [ ] Write strict failing contract tests for valid updates, forbidden unknown fields, filters, pagination, comments, and UUID inputs.
- [ ] Run the focused contract test and confirm missing exports.
- [ ] Implement schemas and gateway signatures with maximum lengths and page size 200.
- [ ] Run all contract tests and commit with `feat(schedule): 定义日程管理契约`.

### Task 2: Browser behavior and occurrence reconciliation

**Files:** Modify `src/platform/browser/in-memory-gateway.ts`; create `src/domain/schedule/reconcile-occurrences.ts`; test `tests/unit/platform/schedule-management.test.ts`.

**Interfaces:** `reconcileOccurrences(existing, generated)` retains matching IDs/state and returns active and soft-deleted rows.

- [ ] Write failing tests for update, kind-change rejection, ID/state retention, star, delete/restore, filtered paging, comment update, and exclusion-code append.
- [ ] Implement the pure reconciliation function using legacy equality `(start,end,startMark,endMark)`.
- [ ] Implement minimal in-memory gateway methods and verify focused tests.
- [ ] Commit with `feat(schedule): 实现浏览器日程管理`.

### Task 3: Transactional SQLite management

**Files:** Modify `src-electron/adapters/db/schedule-repository.ts`, `occurrence-repository.ts`, and `src/application/schedule-service.ts`; test `tests/integration/database/schedule-management.test.ts` and `tests/unit/application/schedule-service.test.ts`.

**Interfaces:** Repository mutations return stable results; rule update reconciles occurrences in one transaction.

- [ ] Write failing database tests for filters/count, update reconciliation, cascade soft delete, restore, star, occurrence comment, and exclusion.
- [ ] Implement Drizzle queries and transactions without exposing row types.
- [ ] Verify database and application tests and commit with `feat(db): 实现日程管理事务`.

### Task 4: IPC and host methods

**Files:** Modify host API/gateway, Electron IPC contracts/handlers, and preload API; test host and IPC suites.

- [ ] Add failing round-trip and malformed-input tests for every named operation.
- [ ] Add explicit channels and bidirectional Zod validation; never expose generic invoke.
- [ ] Run host/IPC/type checks and commit with `feat(ipc): 接通日程管理操作`.

### Task 5: Detail and Database UI

**Files:** Modify `src/pages/schedule/[id].vue`, `src/pages/database.vue`, and schedule composables; test `tests/unit/features/schedule-management-ui.test.ts` and secondary-page tests.

- [ ] Write failing UI tests for Edit/Delete/Restore/Star/Times, date/deleted/star filters, and remote pagination.
- [ ] Implement accessible controls, stable loading/errors, and refresh after mutation.
- [ ] Run feature tests, lint, typecheck, all unit/contract/parser tests, and Web build.
- [ ] Update `docs/development/v2-feature-gaps.md` and commit with `feat(ui): 恢复日程管理功能`.

## Plan self-review

- Every backend and frontend schedule-management gap has an owning task.
- Existing simple list consumers remain compatible; Database paging is a separate API.
- Occurrence reconciliation explicitly preserves legacy per-instance state.
- Todo completion and drag rescheduling remain in the next slice.
