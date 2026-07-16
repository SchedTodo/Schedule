# Schedule Agent Instructions

## Project Direction

- `release/1.2.0` is the immutable legacy reference. Do not rewrite, rebase, force-push, or add v2 work to it.
- `main` is the Schedule v2 development line.
- Follow `docs/superpowers/plans/2026-07-11-schedule-v2-rebuild.md` for the active rebuild.
- Keep `src` browser-runnable and platform-independent.
- Put Electron-only code in `src-electron`; future Tauri code belongs in `src-tauri`.
- Do not introduce TanStack Query unless a later approved design explicitly adopts it.

## Development Rules

- Use Node.js 24 LTS and the exact pnpm version pinned by `packageManager`.
- The agent may install, upgrade, or rebuild dependencies when required by an approved task. Keep dependency changes minimal, preserve the pinned package manager, update the lockfile, and verify the result.
- Use test-driven development for behavior changes: failing test, minimal implementation, passing verification.
- Do not weaken TypeScript strictness to accommodate project code.
- Validate process, network, file, and persistence boundaries with Zod.
- Do not expose Electron, Drizzle, SQLite driver, ANTLR context, or host-specific types to Vue components.
- Preserve unrelated user changes and never use destructive Git cleanup commands.

## Verification

Before committing, run the checks relevant to the change. For the Web foundation, the minimum is:

```powershell
.\node_modules\.bin\eslint.cmd .
.\node_modules\.bin\vue-tsc.cmd --noEmit -p tsconfig.app.json
.\node_modules\.bin\vitest.cmd run tests/unit tests/contracts tests/parser
.\node_modules\.bin\vite.cmd build
```

Electron and Playwright Electron tests launch GUI processes. Run those commands outside the sandbox with the required approval. If Electron reports repeated GPU child-process exits, `ERR_FAILED` while loading a local page, an empty BrowserWindow URL, or Windows code `0xC0000135`, verify the execution boundary before changing product code, dependencies, hardware acceleration, or Chromium switches. Follow [`docs/development/electron-e2e-troubleshooting.md`](docs/development/electron-e2e-troubleshooting.md).

Add focused integration or Playwright commands when the changed area requires them.

## Git

- Follow [`docs/development/git-conventions.md`](docs/development/git-conventions.md).
- All new commit subjects must use a Conventional Commit type followed by a concise Chinese description.
- Do not rewrite the two existing English v2 commits; the Chinese requirement applies prospectively.
