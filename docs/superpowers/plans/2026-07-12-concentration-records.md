# Concentration Records Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox syntax.

**Goal:** Restore the Pomodoro concentration page and persisted per-schedule records.

**Architecture:** Timer state stays in Vue. Valid sessions are submitted through a RecordsGateway and stored in SQLite; detail pages query records by schedule ID.

### Task 1: Records backend

- [ ] Add failing contracts for create/list/delete and valid instant ranges.
- [ ] Implement browser, SQLite, IPC, preload, and host adapters.
- [ ] Verify persistence and boundary tests.

### Task 2: Concentration UI

- [ ] Add failing tests for the route, timer controls, and minimum one-minute submission.
- [ ] Implement Todo selection, focus/break countdown, start/pause, and session submission.
- [ ] Enable Todo concentration actions and detail Records.
- [ ] Run full verification and update Feature Gaps.
