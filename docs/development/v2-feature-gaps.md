# Schedule v2 Feature Gaps

This document records the difference between the current v2 implementation and the capabilities visible in release/1.2.0. It is a backlog inventory, not a promise that every historical feature must return unchanged.

## Implemented boundary

Browser and Electron gateways now provide validated schedule creation, lookup, listing, editing, starring, soft deletion/restoration, filtered paging, persisted occurrence generation/range queries, per-occurrence exclusion/comments/Todo completion, persisted settings, concentration records, alarms, notifications, and open-at-login. Month/week/Todo/detail/Database/Settings/Concentration pages consume these gateways without host-specific types. The week view preserves the legacy presentation-only vertical drag offset for revealing overlapping cards without mutating occurrences.

## Backend and gateway gaps

- Provide user login, logout, profile, token refresh, and session expiry.
- Provide WebSocket lifecycle, remote synchronization, conflict handling, and sync metadata.

## Frontend gaps

- User menu, authentication feedback, sync action, and syncing overlay are not migrated.

## Platform gaps

- Packaging, signing, updater, and release artifacts.
- Tauri composition root.
- Cross-device sync service and secure credential storage.

## Deferred product decisions

- Whether historical login/sync semantics should be restored or redesigned.
