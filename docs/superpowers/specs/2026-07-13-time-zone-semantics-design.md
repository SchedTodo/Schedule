# Time-Zone Semantics Correction Design

## Goal

Restore the legacy time-zone semantics in Schedule v2: a selected time zone is embedded into saved time rules, while expanded occurrence timestamps are persisted as UTC instants and rendered in the currently selected application time zone.

## Confirmed Semantics

- Parsing a recurrence or exclusion rule without an explicit time zone uses the current `settings.timeZone`.
- Before saving a schedule, each parsed rule is normalized and contains its resolved full IANA time-zone identifier. This also expands relative date sugar and resolved abbreviations, matching the legacy `newTimeCode` behavior.
- Occurrences are expanded from those normalized rules. Their `start` and `end` values are instants; Electron persists them as database timestamps and returns them as UTC ISO strings.
- Changing the global time-zone setting does not reinterpret or regenerate existing occurrences because their saved rules already contain a time zone.
- The selected application time zone controls calendar date grouping, displayed wall-clock values, current calendar dates, occurrence query boundaries, and Todo logical-day boundaries.

## Data Flow

Creation and update use one parse result for both normalization and expansion:

1. Parse the submitted recurrence and exclusion rules with the current settings context.
2. Serialize evaluated statements into stable rules with full dates, explicit IANA time zones, time marks, recurrence options, and `by` clauses.
3. Expand the same evaluated statements into occurrence drafts.
4. Save the normalized rule text and replace the schedule's occurrences in one repository operation.
5. Persist occurrence timestamps as UTC instants. Never persist selected-zone wall-clock strings as timestamps.

The browser gateway follows the same normalization and expansion behavior as Electron so browser tests and platform behavior remain aligned.

## Presentation and Query Boundaries

A small platform-independent Temporal helper converts an occurrence instant into the selected zone. Month and week views use its local date key and wall-clock fields rather than slicing UTC ISO strings. Todo and schedule-detail timestamps use the same selected zone.

The home page derives its visible occurrence query range from calendar dates in the selected zone and converts the range endpoints to UTC instants before calling the gateway. Todo queries carry the selected time zone so repositories can convert the configured logical-day start to UTC before filtering stored occurrences.

## Non-Goals

- No migration or regeneration of unpublished v2 data.
- No Moment or Luxon dependency.
- No automatic rewriting of existing schedules when the global time zone changes.
- Database audit timestamps such as `createdAt` and `updatedAt` are not schedule occurrence times and are outside this correction.

## Error Handling

Invalid or ambiguous time zones continue to fail at the parser boundary. Schedule creation or update must not persist either the schedule or occurrences when normalization fails. IPC and repository inputs remain Zod-validated.

## Testing

- Parser normalization tests prove omitted time zones become the configured full IANA identifier and occurrence values are UTC instants.
- Schedule-service and browser-gateway tests prove normalized rules, rather than raw input, are stored on create and update.
- Calendar component tests prove one UTC instant is grouped and displayed differently under `UTC` and `Asia/Shanghai`.
- Todo boundary tests prove logical-day filtering uses the selected zone before querying UTC timestamps.
- Existing parser, contract, unit, SQLite/IPC integration, type-check, lint, and build checks remain green.
