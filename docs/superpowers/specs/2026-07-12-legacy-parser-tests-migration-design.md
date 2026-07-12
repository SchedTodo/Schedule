# Legacy Parser Tests Migration Design

## Goal

Migrate every one of the 57 test blocks in `release/1.2.0:src/test/timeParser.test.ts` into the v2 suite with an auditable one-to-one mapping and preserve legacy-observable behavior.

## Test structure

Create `tests/parser/legacy-time-parser-compatibility.test.ts`. Keep every legacy test name, including historical misspellings, so a name-by-name comparison proves coverage. Each migrated test targets the v2 public parser or occurrence expansion API rather than restoring removed internal Luxon, RRule, settings-service, or string utility APIs.

Tests that formerly asserted intermediate parser objects assert the equivalent normalized statement. Tests that formerly asserted generated Prisma `Time` rows assert occurrence drafts. Utility-only cases assert the public behavior that depended on that utility. The two Luxon sanity cases remain named compatibility checks but use the v2 Temporal model to verify the equivalent instant/time-zone invariants.

## Compatibility policy

`release/1.2.0` is authoritative for accepted syntax, rejected syntax, date sugar, time sugar, unknown-time marks, recurrence expansion, exclusion behavior, and time-zone interpretation. A migrated test must first be observed failing when v2 lacks or differs from the legacy behavior; production changes then use the smallest parser/evaluator correction needed to pass.

The suite uses a fixed clock and explicit default timezone. Assertions derived from the real clock are converted to deterministic expected dates without changing the legacy rollover rule.

## Completion criteria

- The compatibility file contains exactly 57 test blocks mapped to all 57 legacy names.
- Every legacy input and expected observable result is represented.
- Existing parser tests remain unchanged unless a legacy conflict requires correction.
- All parser, unit, contract, integration, type, lint, and build checks pass.
- Any intentional non-equivalence must be explicitly approved; none is assumed by this design.
