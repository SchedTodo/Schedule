# Schedule v2 Feature Gaps Compatibility Design

## Goal

Complete the capabilities listed in `docs/development/v2-feature-gaps.md` while preserving the user-visible behavior of `release/1.2.0`. The v2 implementation keeps its platform-neutral Vue architecture, typed contracts, Temporal time model, ANTLR parser, Zod boundaries, and Electron adapters. It does not migrate legacy database data.

## Delivery order

Implement independently verifiable vertical slices in dependency order:

1. persisted schedule occurrences, recurrence/exclusion expansion, range queries, and calendar views;
2. schedule editing, starring, soft deletion/restoration, occurrence operations, and database filtering/pagination;
3. per-occurrence Todo completion and logical-day queries;
4. persisted settings, timezone behavior, alarms, notifications, and open-at-login;
5. concentration timing and records;
6. authentication, synchronization, tray/background lifecycle, help content, packaging, and release boundaries.

Each slice covers browser and Electron paths and follows RED → GREEN → REFACTOR.

## Compatibility baseline

`release/1.2.0` is the behavioral reference. Equivalent valid input must produce equivalent user-visible schedules and concrete times. Invalid legacy input must remain invalid. Compatibility tests use a fixed clock, timezone, and week start. Implementation names and internal architecture may change, but observable semantics may not change without explicit approval.

## Persisted occurrence model

Introduce `ScheduleOccurrence` as the v2 equivalent of the legacy `Time` model. It has a stable ID, schedule ID, excluded flag, nullable start instant, required end instant, start/end unknown-time marks, comment, done state, soft-deletion timestamp, created/updated timestamps, and later synchronization metadata.

Creating a schedule parses recurrence and exclusion code, expands all concrete occurrences, and stores the schedule and occurrences in one transaction. Updating recurrence code matches occurrences using the legacy equality rules:

- matching occurrences retain ID, comment, and completion state;
- matching soft-deleted occurrences are restored;
- new occurrences are created;
- occurrences no longer produced by either recurrence or exclusion code are soft-deleted;
- an event cannot be changed into a Todo or vice versa.

Excluding one occurrence retains its row, marks it excluded, and appends its normalized concrete time expression to the schedule exclusion code.

## Parsing and generation

ANTLR recognizes syntax and produces platform-neutral AST nodes. Temporal evaluation expands absolute dates, `tdy`, `tmr`, omitted years, event ranges, Todo deadlines, overnight ranges, daily/weekly/monthly/yearly recurrence, interval/count options, supported `by[...]` clauses, multiple statements, IANA zones, supported legacy abbreviations, unknown hour/minute marks, and recurrence/exclusion difference semantics.

The implementation must neither accept syntax rejected by the legacy parser nor reject valid legacy syntax. Diagnostics retain stable categories and source locations. Any apparent unbounded legacy recurrence is characterized with compatibility tests before introducing a limit.

## Contracts and boundaries

`src` owns occurrence Zod contracts, application services, repository ports, browser in-memory adapters, and Vue composables. `src-electron` owns Drizzle tables, SQLite repositories, SQL migrations, IPC handlers, preload methods, notifications, autostart, WebSocket transport, and other host integrations.

Vue components consume DTOs through `PlatformGateway`. They never receive Electron, Drizzle, SQLite driver, ANTLR context, or host-specific types. Process, network, persistence, and platform inputs are `unknown` until validated with Zod.

## Queries and UI behavior

Public occurrence operations cover range queries, schedule occurrence lists, Todo queries, instance comment updates, single/bulk exclusion, and completion updates. Ordinary event queries hide completed, excluded, and soft-deleted occurrences and sort by start time.

Month view queries the visible month plus its surrounding calendar week and renders every event occurrence. Week view renders every occurrence using its start, end, and duration. UI dates use the configured timezone and preserve unknown-time marks. `Not Expired` derives from occurrence and logical-day data. `Not Done` uses per-occurrence completion.

## Schedule management

Add title, recurrence, exclusion, and comment updates; star/unstar; soft-delete/restore; detail-page Edit/Delete/Star/Times actions; occurrence comment and exclusion actions; and server-side database filtering and pagination. List results return items and total count. Ordinary lists hide deleted schedules, while the Database page retains the legacy deleted-state visibility.

Dragging one occurrence in the week view is presentation-only. It accumulates a temporary vertical pixel offset keyed by occurrence ID so users can reveal overlapping cards. It never changes the occurrence date, start, end, recurrence, or exclusion data; it never calls a gateway or writes persistence; and a page reload resets every offset.

## Todo behavior

Completion belongs to each occurrence, not the schedule. Preserve the legacy logical-day start setting and query union: return the earliest non-expired occurrence for every Todo plus every occurrence in the current logical day, deduplicated by occurrence ID. Matching occurrences retain done state when schedule rules change.

## Settings and desktop capabilities

Persist the legacy setting keys and defaults for timezone, week start, week-view days/start time, alarm, open-at-login, and Pomodoro. The browser uses a browser adapter and Electron uses SQLite. All values pass Zod validation.

`AlarmScheduler` calculates due occurrences and calls `NotificationPort`; only the Electron notifier imports Electron. Settings changes reschedule alarms and refresh timezone/logical-day queries. `AutostartPort` implements open-at-login. Tray and window lifecycle preserve legacy background behavior.

## Concentration records

Retain an independent record model with ID, schedule ID, start/end instants, soft deletion, timestamps, and later sync metadata. Timer state remains in the frontend; completed sessions are submitted through the gateway. Restore the concentration page, record submission, and detail Records view.

## Authentication and synchronization

Restore login, logout, profile, token refresh, session expiry feedback, secure credential storage, WebSocket lifecycle, sync status, unsynchronized entity queries, version/sync timestamps, conflict handling, and syncing overlay. Network payloads are Zod validated.

When production server details are unavailable, freeze the protocol from the legacy client and implement a replaceable transport with deterministic tests. Do not invent production endpoints or claim live interoperability without evidence.

## Database evolution

Do not migrate data from legacy databases. Add reviewed forward SQL migrations only for the current v2 alpha schema. Migrations must be transactional and idempotent and must preserve existing v2 schedule rows.

## Error handling

Stable application errors cover invalid input, parser syntax/semantics, missing schedules/occurrences, edits to deleted data, forbidden schedule-kind changes, occurrence conflicts, invalid settings, persistence failures, invalid IPC responses, unsupported notification/autostart operations, expired sessions, sync conflicts, and unavailable networks. Renderer-facing errors do not expose SQL, paths, or host exception details.

## Verification

Test layers include legacy-derived parser golden cases, occurrence compatibility fixtures, domain matching and time-boundary tests, repository transaction tests, IPC contract tests, Vue component tests, Electron end-to-end persistence tests, and deterministic alarm/sync tests.

For every behavior change, first add and run a failing test, implement the minimum change, then run focused and regression checks. At minimum each slice runs ESLint, Vue TypeScript checking, unit/contract/parser tests, and the Web build, plus relevant database, IPC, Electron, or Playwright checks.

## Completion criteria

A gap is complete only when browser and Electron paths agree, legacy-equivalent input produces equivalent observable behavior, all boundaries are validated, browser builds remain host-independent, focused and regression checks pass, and `v2-feature-gaps.md` is updated with evidence. External signing credentials, release accounts, and unavailable production services are reported as external prerequisites rather than simulated successes.
