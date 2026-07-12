# Settings and Desktop Capabilities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax.

**Goal:** Persist legacy settings and enable timezone, week view, alarm, Pomodoro, notification, and open-at-login controls.

**Architecture:** A strict settings DTO crosses browser/IPC boundaries. Browser persists through local storage; Electron persists through SQLite. Host-only notification and autostart adapters remain behind ports, while an alarm scheduler consumes occurrence data and settings.

**Tech Stack:** Zod, Vue/Pinia, Drizzle SQLite, Electron, Vitest.

### Task 1: Settings contracts and repositories

- [ ] Add failing schema tests for all legacy defaults and invalid ranges.
- [ ] Implement SettingsGateway, browser storage, SQLite table/repository, IPC, and preload methods.
- [ ] Verify browser/Electron parity.

### Task 2: Settings UI and consumers

- [ ] Add failing UI tests proving disabled controls become editable and persist.
- [ ] Connect timezone, week start/days/start time, alarm, open-at-login, and Pomodoro controls.
- [ ] Use logical-day settings in Todo queries.

### Task 3: Host capabilities

- [ ] Add deterministic alarm calculation tests and autostart adapter tests.
- [ ] Implement NotificationPort, Electron notifier, AlarmScheduler, and Electron autostart.
- [ ] Run full verification, update Feature Gaps, and commit.
