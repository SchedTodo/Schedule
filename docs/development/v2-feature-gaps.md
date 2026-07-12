# Schedule v2 Feature Gaps

This document records the difference between the current v2 implementation and the capabilities visible in release/1.2.0. It is a backlog inventory, not a promise that every historical feature must return unchanged.

## Implemented boundary

The current `ScheduleGateway` supports only:

- `create(input)`;
- `findById(id)`;
- `list(query)` with kind, search, offset, and limit.

These three operations are available through the browser in-memory gateway and the validated Electron preload/IPC/database path.

## Backend and gateway gaps

- Parse complete recurrence/exclusion syntax and generate occurrences.
- Query event occurrences by time range.
- Model Todo deadline occurrences and completion state.
- Update schedule title, recurrence, exclusion, and comment.
- Star and unstar schedules.
- Soft-delete and restore schedules through the public gateway.
- Query, edit, and delete individual time occurrences.
- Store and query concentration records.
- Persist application settings outside browser local storage.
- Schedule alarms and deliver system notifications.
- Configure open-at-login behavior.
- Provide user login, logout, profile, token refresh, and session expiry.
- Provide WebSocket lifecycle, remote synchronization, conflict handling, and sync metadata.

## Frontend gaps

- `Not Expired` and `Not Done` do not yet filter occurrence data.
- Todo completion checkbox and concentration action are disabled.
- Week view does not position cards by occurrence duration or support drag-to-reschedule.
- Month and week views currently display only the first concrete date parsed from `recurrenceCode`.
- Database date-range, deleted, and star filters are presentational; remote pagination is not connected.
- Detail Edit, Delete, Star, Times, and Records operations are unavailable.
- Settings Time Zone, Alarm, Week View Days/Start Time, Open At Login, and Pomodoro controls are disabled until matching ports exist.
- Concentration timer page and record submission are not migrated.
- User menu, authentication feedback, sync action, and syncing overlay are not migrated.
- Help content does not yet include full recurrence syntax documentation.

## Platform gaps

- Tray menu and background lifecycle.
- Autostart integration.
- Alarm/notification integration.
- Packaging, signing, updater, and release artifacts.
- Tauri composition root.
- Cross-device sync service and secure credential storage.

## Deferred product decisions

- Whether recurrence occurrences remain derived or become persisted projections.
- Whether Todo completion belongs to a schedule or to each generated deadline occurrence.
- Whether concentration records remain part of Schedule or become a separate bounded feature.
- Whether historical login/sync semantics should be restored or redesigned.
- Whether Database should expose deleted rows and restoration to ordinary users.
