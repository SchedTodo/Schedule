# Todo Occurrences Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore legacy Todo kind inference, logical-day queries, per-occurrence completion, and homepage filtering.

**Architecture:** Parser output determines schedule kind. Occurrence repositories implement the legacy union of each Todo's earliest non-expired occurrence and all occurrences in the current logical day. Vue renders occurrence DTOs and updates `done` through the gateway.

**Tech Stack:** TypeScript, Temporal, Zod, Vue, Drizzle, Vitest.

## Global Constraints

- A single deadline time is Todo; a start/end range is event.
- Completion belongs to each occurrence.
- Preserve the logical-day start setting contract; default is 00:00 until settings are restored.
- Use RED → GREEN → REFACTOR.

### Task 1: Contracts and kind inference

- [ ] Add failing tests for single-time Todo inference and Todo query/done schemas.
- [ ] Implement parser-driven kind inference and gateway signatures.
- [ ] Run parser/application/contract tests.

### Task 2: Browser and SQLite Todo behavior

- [ ] Add failing tests for earliest-plus-current-day union, deduplication, and done updates.
- [ ] Implement browser and Drizzle queries with fixed instants and logical-day inputs.
- [ ] Expose named host/IPC/preload methods with Zod validation.

### Task 3: Homepage Todo UI

- [ ] Add failing component tests for deadline rows, enabled checkbox, `Not Expired`, and `Not Done`.
- [ ] Replace schedule-source parsing with Todo occurrence DTOs and refresh after completion.
- [ ] Run full verification, update Feature Gaps, and commit with `feat(todo): 恢复待办实例与完成状态`.
