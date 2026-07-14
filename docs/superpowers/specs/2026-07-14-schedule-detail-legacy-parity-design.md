# Schedule Detail Legacy Parity Design

## Goal

Restore the Schedule v2 detail page to the user-visible and persistence behavior of `release/1.2.0` for schedule information, editing, deletion, and occurrence management. Keep `src` browser-runnable, keep Electron persistence behind platform ports, and do not implement multi-device sync fields in this slice.

## Scope

This change covers:

- the Info card's star control, compact Edit/Delete controls, Type tag, Deleted field, and conditional Records card;
- reuse of the existing Schedule modal for Add and Edit;
- preservation of an explicitly entered `daily` frequency without inserting an implicit `daily` into normalized rTime;
- the Times data table, selection, pagination, weekday and comment columns, inline comment editing, ordering, and confirmation dialogs;
- legacy-compatible manual occurrence exclusion and schedule/occurrence soft-deletion behavior;
- occurrence reconciliation that restores matching stored rows instead of replacing them.

`SyncAt` and `Version` remain out of scope. No new query library or persistence technology is introduced.

## Reference Behavior

`release/1.2.0` is the behavioral reference.

- `ScheduleModal` is shared by Add and Edit. The caller supplies the title and initial model, then handles the common submitted fields.
- A schedule's star state is represented only by the star icon's color/state.
- Event schedules show Times but not Records. Todo schedules may show Records.
- Manual Time deletion sets the occurrence to excluded and appends its concrete time to `exTimeCode`.
- Schedule deletion marks the schedule and its related Times and Records as deleted.
- Rule updates match historical Times by `(start, end, startMark, endMark)`. A match restores the existing row and preserves its identity rather than inserting a new logical Time.

## Root Causes

### Explicit `daily` is lost

The parser AST distinguishes an omitted frequency from an explicit frequency, but the evaluator replaces both with the same computed `{ unit: 'daily', interval: 1 }` value. The serializer then omits every default daily value. The normalization pipeline therefore cannot tell whether the user typed `daily`.

The evaluated representation will retain whether the frequency was explicit. Serialization will omit default daily only when it was implicit. It will preserve `daily` when the source contained it, including explicit options such as `daily,i2` and `daily,c3`.

### Web and Electron occurrence reconciliation differ

`OccurrenceGateway.listBySchedule` has a shared TypeScript signature, but its filtering semantics are not encoded in the type. Both adapters return the declared DTO array while selecting different stored states. The application service then incorrectly uses this UI-facing visible-list method as its reconciliation data source.

The browser implementation happens to reconcile against its private complete array. Electron calls a repository method that filters excluded and soft-deleted rows, so it cannot find a matching historical occurrence. It generates a new ID, then `saveWithOccurrences` physically replaces all stored rows. This violates the legacy identity, comment, and done-state preservation rules.

The repository boundary will distinguish these operations explicitly:

- `listVisibleBySchedule` supplies the Times UI and omits excluded or soft-deleted rows.
- `listAllBySchedule` supplies reconciliation and includes active, excluded, and soft-deleted rows.

The public platform gateway exposes only the visible query. The application service consumes the repository's all-state query for reconciliation.

## UI Design

### Info card

Use Naive UI controls and the legacy Ionicons star glyph. The icon is filled in both states and changes visual color between starred and unstarred. It has an accessible label that reflects the action. Remove the textual `Star` row.

Render Info as two columns with values sized to their content. The Type `NTag` must not stretch across the value column. Add a `Deleted` tag. Active and deleted schedules can be represented by the detail DTO so the field is not inferred in the component.

Edit and Delete form a compact button group with joined inner edges and smaller outer radii. Schedule Delete uses `NPopconfirm` with the legacy confirmation meaning. Editing and deletion controls are hidden when the schedule is deleted.

Do not render Records for an event. Render the Records card for a todo only.

### Shared Add/Edit modal

Extend the existing `ScheduleModal` rather than adding a second form. It accepts:

- a mode or title distinguishing Add from Edit;
- optional initial values for name, rTime, exTime, and comment;
- the existing loading and error state;
- the same submitted create/update field shape used by the caller.

Opening Edit copies the current schedule into a local draft. Cancelling or closing discards unsaved changes. A successful update closes the modal and refreshes Info and Times. The existing Add keyboard behavior remains scoped to Add so a detail page does not unexpectedly open an Edit modal.

### Times card

Use Naive UI `NDataTable` with these columns:

1. selection checkbox;
2. Start;
3. End;
4. Weekday;
5. Comment.

Start and End use the configured time zone and display `yyyy/M/d HH:mm`, without seconds. Todo Start displays `-`. Weekday is derived from Start for events and End for todos, in the configured locale behavior already used by the application.

Comment renders as text until double-clicked. Double-click opens a focused `NInput`. Commit the value through `updateComment`; blur without a committed change exits editing without an unnecessary request. A failed update keeps or restores the previous visible value and exposes the application error.

Pagination uses Naive UI's data-table pagination with page sizes 5, 10, 15, and 20. The initial page size is 5, matching the reference shown by the user. Selection is cleared after a successful delete or data refresh.

The header Delete action operates on selected rows only. It uses `NPopconfirm`; confirmation with no selected rows performs no mutation. The gateway receives the selected IDs as one batch operation so Electron can apply the exclusion-code and occurrence changes transactionally.

### Times ordering

Ordering is calculated against the start of the current day in the configured time zone.

- today and future Times appear first in ascending effective time;
- past Times appear after them in ascending effective time;
- effective time is Start for events and End for todos;
- past rows receive the muted legacy visual treatment.

The clock is injected or passed to the pure ordering helper in tests so ordering does not depend on the machine's current time.

## Data and Persistence Design

### Schedule deleted state

Add `deleted` to the stable schedule detail DTO and mapper. List APIs for active schedules continue filtering deleted rows. Detail lookup may return a deleted schedule so Database results can open a read-only legacy-compatible detail view. Schedule deletion continues to set `schedule.deleted_at` and the related occurrence `deleted_at` values in one transaction. Related concentration records are also soft-deleted to match the legacy whole-schedule operation.

### Manual Time deletion

Manual Time deletion is exclusion, not occurrence soft deletion.

For every selected visible occurrence, the transaction:

1. loads the occurrence and owning schedule;
2. sets `excluded=true` on that occurrence;
3. serializes its concrete Start/End using its known/unknown marks and UTC, matching the legacy exclusion-code format;
4. appends the concrete statement to the schedule's `exclusionCode` without discarding existing statements;
5. updates timestamps;
6. commits all selected IDs atomically.

It does not set the selected occurrence's `deleted_at`. `deleted_at` remains reserved for schedule-wide soft deletion and rule reconciliation of occurrences no longer produced by either rTime or exTime.

### Reconciliation

Rule updates load all historical occurrences for the schedule. Generated included and excluded occurrences are matched by `(start, end, startMark, endMark)`.

- A match reuses the stored ID, comment, done state, and created timestamp; it updates `excluded`, clears `deleted_at`, and updates mutable schedule-derived fields.
- A generated occurrence with no match is inserted.
- A historical occurrence no longer generated is retained and marked with `deleted_at`.
- No reconciliation path deletes all rows for the schedule.

Removing a concrete exclusion from exTime and retaining the matching rTime therefore restores the same occurrence row as active, with the same ID and user data.

Browser and Electron implementations must pass the same repository-level contract tests for these state transitions.

## Contracts and Boundaries

Add a batch occurrence exclusion input schema containing a non-empty bounded array of UUIDs. Validate it at the Web gateway, preload, IPC handler, and Electron boundary. Avoid a generic IPC method.

Keep database row types inside `src-electron`. Vue components consume schedule and occurrence DTOs only. The repository's all-state occurrence representation may include persistence metadata needed for reconciliation, but it must be mapped to a platform-independent application type rather than exposing Drizzle rows.

## Error Handling

- Parser validation failures leave the Edit modal open and display the stable application error.
- Failed star, comment, schedule delete, or Times delete operations do not optimistically commit a false UI state.
- Batch Time exclusion is transactional: one invalid or missing selected ID fails the whole batch.
- A deleted schedule is read-only; update, star, and manual Time mutation operations reject it at the application or persistence boundary.

## Testing

Follow RED-GREEN TDD for every behavior change.

Parser tests prove all four cases:

- omitted frequency remains omitted after normalization;
- explicit `daily` remains present;
- explicit `daily` options remain present;
- implicit daily still expands occurrences correctly.

Pure unit tests cover time formatting, weekday selection, configured-zone day boundaries, future-first ordering, stable past ordering, and exclusion-code serialization with unknown marks.

Component tests cover the star glyph/state, compact action group, content-width Type tag, Deleted field, absence of a Star row, conditional Records, Edit modal initialization and submission, DataTable columns, selection, pagination, double-click comment editing, and both confirmation dialogs.

Browser gateway and application tests cover batch exclusion, appended exTime, same-ID restoration, and preservation of comment/done state. SQLite integration tests prove the same behavior, verify that no occurrence rows are physically replaced, and verify schedule-wide soft deletion of schedules, Times, and Records.

IPC and contract tests cover valid batch input, malformed IDs, empty selection rejection, and round-trip result validation.

Final verification uses the project minimum commands:

```powershell
.\node_modules\.bin\eslint.cmd .
.\node_modules\.bin\vue-tsc.cmd --noEmit -p tsconfig.app.json
.\node_modules\.bin\vitest.cmd run tests/unit tests/contracts tests/parser
.\node_modules\.bin\vite.cmd build
```

Focused database and IPC suites are also required because this change modifies persistence and process boundaries.
