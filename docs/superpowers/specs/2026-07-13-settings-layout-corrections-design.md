# Settings and Application Layout Corrections Design

## Goal

Restore the complete legacy settings choices and correct the v2 settings and application-shell layout without reintroducing Luxon, Moment, or compatibility code for unpublished data.

## Scope

- List every canonical IANA time-zone identifier supported by the runtime, plus `UTC`.
- Restore all seven WKST choices from Monday through Sunday.
- Keep minute-only alarm and Pomodoro duration inputs.
- Remove Compact Density from the UI and preferences state.
- Increase settings control widths and spacing, and align switches with the other fields.
- Keep the navigation bar at the top and footer at the bottom while only page content scrolls.
- Hide the content scrollbar without disabling wheel, touch, or keyboard scrolling.

No unrelated page redesign, settings abstraction, or new dependency is included.

## Data Model

`weekStart` uses ISO weekday numbers everywhere:

| Value | Label |
| --- | --- |
| 1 | MO |
| 2 | TU |
| 3 | WE |
| 4 | TH |
| 5 | FR |
| 6 | SA |
| 7 | SU |

The settings Zod contract, preferences state, browser gateway, Electron wiring, and parser evaluation context use the same `1 | 2 | 3 | 4 | 5 | 6 | 7` representation. Existing unpublished `0` values are intentionally not migrated or accepted.

## Time Zones

The settings page builds select options from `Intl.supportedValuesOf('timeZone')`, adds `UTC`, removes duplicates, and keeps lexical ordering. The select remains filterable. The currently stored value is also included when absent from the canonical list so a valid existing selection remains visible.

Temporal continues to perform date-time calculations. `Intl` supplies the runtime's canonical IANA identifiers because Temporal validates and consumes identifiers but does not expose an enumeration API.

## Settings Layout

Each setting remains a two-column label-and-control row. All controls are wrapped or classed consistently so they start at the same inline position. Selects retain a 15rem width; single numeric inputs use a wider width comparable to the legacy page; paired time inputs retain separate hour and minute fields. Field and card gaps return to the legacy page's approximately 1rem rhythm.

Switches use the same control column and `justify-self: start`, preventing them from stretching or appearing at the far edge. Minute-only Alarm and Pomodoro values remain unchanged.

The Appearance card contains Theme only. Compact Density is removed from the Vue template, Pinia schema/state/update logic, hydration tests, and root application class binding.

## Application Layout

The application shell owns exactly one viewport. The header and footer are non-scrolling rows, while the content row is the only scroll container. This keeps both bars visible without overlaying page content or relying on document scrolling.

The content scroll container hides both standards-based and WebKit scrollbar visuals while preserving overflow scrolling. The idea trigger remains fixed above the content and below the navigation layer.

## Boundaries and Error Handling

No dependency or host-specific time-zone API is added. If `Intl.supportedValuesOf` is unavailable, the page falls back to `UTC`, the current system zone, and the stored setting. Zod continues to reject invalid WKST values at browser, IPC, and persistence boundaries.

## Testing

- Contract tests prove WKST accepts exactly ISO values 1 through 7.
- Preferences tests prove Compact Density is gone and ISO WKST persists.
- Settings page tests prove seven labels, filterable complete time-zone options, removal of Compact Density, and stable control classes.
- App shell tests prove the viewport/content-scroll structure and scrollbar-hiding styles.
- Existing unit, contract, parser, type-check, lint, and Web build verification must remain green.
