# GAP-06 Legacy Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the Schedule v2 cutover only after every in-scope legacy behavior is implemented or explicitly classified as deferred/non-goal, then remove legacy-only source, configuration, dependencies, and documentation.

**Architecture:** Keep browser-runnable product code in `src` and Electron adapters in `src-electron`. Treat `docs/development/v2-feature-gaps.md` as the authoritative scope record. Prove independence from legacy files by running the same core verification before and after deletion.

**Tech Stack:** Node.js 24 LTS, pnpm 11.17.0, Vue 3, TypeScript 6 strict mode, Vite 8, Vitest, ESLint, ANTLR 4.13.2, Electron 43.

## Global Constraints

- `release/1.2.0` is immutable; all work stays on `main`.
- Do not migrate, import, convert, or back up the 1.2 database.
- Sync, account/authentication, and a Tauri composition root remain deferred.
- `src` must not import Electron, Node database drivers, Drizzle schemas, ANTLR contexts, or host-specific types.
- Use TDD for the remaining keyboard behavior.
- Preserve the v2 parser compatibility corpus under `tests/parser`; only the original `src/test/timeParser.test.ts` is legacy source.
- Run these exact commands before and after deletion:
  - `.\node_modules\.bin\eslint.cmd .`
  - `.\node_modules\.bin\vue-tsc.cmd --noEmit -p tsconfig.app.json`
  - `.\node_modules\.bin\vitest.cmd run tests/unit tests/contracts tests/parser`
  - `.\node_modules\.bin\vite.cmd build`

---

### Task 1: Migrate the remaining weekday keyboard shortcut

**Files:**
- Modify: `tests/unit/features/home-workspace.test.ts`
- Modify: `src/features/schedule/components/ScheduleModal.vue`
- Modify: `src/pages/help.vue`

**Interfaces:**
- Consumes: the focused native textarea and the existing modal draft.
- Produces: `Ctrl+1` through `Ctrl+7` insertion for the next Monday through Sunday, formatted as `yyyy/MM/dd`.

- [ ] **Step 1: Write the failing component test**

Open the add modal, focus the `rTime` textarea, select text within its value, dispatch `Ctrl+1`, and assert that the selection is replaced with `2026/07/20` under the repository's fixed `2026-07-13` clock. Repeat once for the `exTime` textarea so both draft fields are covered.

- [ ] **Step 2: Verify RED**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/unit/features/home-workspace.test.ts
```

Expected: FAIL because v2 currently ignores numeric Ctrl shortcuts.

- [ ] **Step 3: Implement the minimum modal behavior**

When the modal is open, `event.ctrlKey` is true, and `event.key` is `1` through `7`, compute the strictly next matching weekday from the current local calendar date. Replace the focused textarea selection with the formatted date and preserve the remaining draft text. Ignore numeric shortcuts when focus is not in the modal's `rTime` or `exTime` textarea.

- [ ] **Step 4: Update the v2 Help shortcut list**

Add `Ctrl + 1/2/3/4/5/6/7` with the exact behavior “insert the next Monday through Sunday into the focused rTime or exTime field.”

- [ ] **Step 5: Verify GREEN**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/unit/features/home-workspace.test.ts
```

Expected: PASS with the new shortcut assertions.

### Task 2: Remove legacy source and legacy-only configuration

**Files:**
- Delete: `src/main/**`
- Delete: `src/preload/**`
- Delete: `src/renderer/**`
- Delete: `src/prisma/**`
- Delete: `src/test/timeParser.test.ts`
- Delete: `src/utils/**`
- Delete: `electron.vite.config.ts`
- Delete: `tsconfig.web.json`
- Delete: `.env.development`
- Delete: `.env.production`
- Delete: `vite-env.d.ts`
- Delete: `dev-app-update.yml`
- Modify: `tsconfig.app.json`
- Modify: `eslint.config.js`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Produces: active Web and Electron builds with no legacy source aliases, ignores, environment declarations, or build entry points.

- [ ] **Step 1: Run Knip before deletion**

Run:

```powershell
.\node_modules\.bin\knip.cmd
```

Classify each result against active v2 imports and scripts. Remove only packages proven unused by v2; keep all three `@vicons/*` packages because `AppShell.vue` imports them.

- [ ] **Step 2: Delete the verified legacy paths and root configuration files**

Delete only the files listed above. Keep `tests/parser/legacy-parser-adapter.ts` and `tests/parser/legacy-time-parser-compatibility.test.ts` because they exercise the v2 parser.

- [ ] **Step 3: Remove legacy-only ignore and exclude entries**

Remove the deleted `src/main`, `src/preload`, `src/prisma`, `src/renderer`, `src/test`, and `src/utils` entries from `tsconfig.app.json` and `eslint.config.js`.

- [ ] **Step 4: Remove only Knip-confirmed unused packages**

Update `package.json` and `pnpm-lock.yaml` with the pinned pnpm version. Do not remove packages used by active source, tests, build, packaging, or generator scripts.

- [ ] **Step 5: Prove no active legacy references remain**

Search source, tests, package scripts, TypeScript, ESLint, Vite, Electron, and builder configuration for the deleted paths, aliases, and environment variables. Historical plans/specs may describe legacy references; active code and current documentation may not depend on them.

### Task 3: Replace legacy documentation and close GAP-06

**Files:**
- Modify: `README.md`
- Modify: `README.en.md`
- Create: `docs/architecture.md`
- Modify: `docs/development/v2-feature-gaps.md`

**Interfaces:**
- Produces: current bilingual setup/feature documentation and one authoritative v2 architecture description.

- [ ] **Step 1: Rewrite both README files around current v2 behavior**

Document only implemented local Web/Electron capabilities, the current shortcuts, Node 24 with pinned pnpm, actual `package.json` scripts, Windows-only packaging scope, fresh v2 database behavior, and the deferred sync/account/Tauri limits. Remove npm, Prisma migration, Google login, active sync, unsupported platform builds, and inaccurate parser claims.

- [ ] **Step 2: Create `docs/architecture.md`**

Document dependency direction, Browser and Electron gateway composition, Zod process boundaries, ANTLR generation/checking, direct fresh-database initialization from `schema.sql`, development/build/test/release commands, and requirements for a future Tauri adapter.

- [ ] **Step 3: Close GAP-06 with evidence**

Mark GAP-06 completed on 2026-07-24. Record the weekday shortcut migration, exact deleted path/config scope, preserved v2 parser compatibility tests, and the before/after command results.

- [ ] **Step 4: Run post-deletion verification**

Run the four exact baseline commands from Global Constraints, then:

```powershell
.\node_modules\.bin\tsc.cmd --noEmit -p tsconfig.electron.json
.\node_modules\.bin\vitest.cmd run tests/integration
pnpm parser:check-generated
pnpm build:electron
.\node_modules\.bin\knip.cmd
```

Expected: all required checks exit successfully; any Knip output is reviewed and either resolved or documented as an intentional entry/configuration boundary.

## Plan Self-Review

- Spec coverage: the only unclassified behavior found by the legacy audit (`Ctrl+1…7`) is migrated before deletion; all GAP-06 deletion, configuration, dependency, documentation, and proof requirements have an owning task.
- Placeholder scan: every task names exact files, behavior, commands, and expected outcomes.
- Type consistency: the shortcut changes only component-local draft strings; no new platform or persistence type crosses an architecture boundary.
