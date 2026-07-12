# Schedule v2 UI Reference Alignment Design

## Goal

Align the current Schedule v2 interface with the supplied release/1.2.0 screenshots without reintroducing the old runtime architecture. Remove migration-oriented naming from current UI code, fix theme contrast, restore the collapsible Todo sidebar, and document the remaining product gaps.

## Naming

Current UI production files, component names, CSS classes, and UI-focused test descriptions must not use `Legacy` or `legacy`. Rename the shell and modal to their product roles (`AppShell`, `ScheduleModal`) and use neutral class names such as `app-shell`, `home-workspace`, `settings-page`, and `detail-page`.

Database migration identifiers such as `legacy_schedule`, `legacy_time`, and migration tests retain their names because they describe actual persisted schema compatibility rather than the current UI.

## Theme and navigation

The header and footer always use the reference navy color `#001428`, independent of light/dark mode. Navigation text and icons always use a light foreground with explicit hover and active colors. Theme variables continue to control content canvas, surfaces, borders, and text.

The navigation includes compact text-compatible icons for Home, Database, Settings, and Help, matching the screenshot spacing. Guest remains on the right.

## Home layout

Use Naive UI `NLayout` with `has-sider`, `NLayoutSider`, and `NLayoutContent`. The Todo sidebar uses:

- width `30vw`;
- collapsed width `0`;
- `collapse-mode="width"`;
- `show-trigger="arrow-circle"`;
- a visible round collapse trigger at the boundary.

No third-party dependency is required. The sidebar and calendar content fill the available height between the 53px header and 5vh footer.

The Todo area matches the screenshot's toolbar, bordered table, header background, central empty state, and compact rows. Week view uses five equal columns, a header row, full-height borders, and centered `No Events` empty states. Month view uses the native Naive Calendar header and fills the content area. The Add button stays beside the month/week group; Idea stays at the right edge.

## Secondary pages

Database and Settings use a centered content width of approximately 84vw with `6vh` top padding. Database keeps the screenshot's wide search field, compact right-side filters, dense table, and restrained card border. Settings groups use compact fixed-width labels and row spacing. Detail and Help follow the same content frame.

## Testing

- A source naming test rejects `Legacy`/`legacy` under current UI `src` and UI tests, excluding database migration compatibility code.
- App shell tests verify fixed navy/light navigation contrast in light and dark modes.
- Home tests verify `NLayoutSider` configuration, collapse trigger, collapsed state, full-height week columns, and empty states.
- Existing component, preference, integration, build, and Electron E2E checks remain green.

## Feature gap report

Add `docs/development/v2-feature-gaps.md` with implemented boundaries and missing backend/frontend capabilities. It is a factual backlog, not an implementation promise for this UI-alignment task.
