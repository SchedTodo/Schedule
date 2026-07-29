# Schedule v2

[中文](README.md)

Schedule is a local-first scheduling app. The standalone Web app uses `createInMemoryGateway`, so schedules, records, and settings reset on refresh; Electron supplies local desktop capabilities with durable SQLite and settings persistence. Accounts, sign-in, and cross-device sync are not currently provided.

## Implemented capabilities

- Create, edit, star, delete, and restore Events and Todos. ANTLR schedule expressions support recurrence and exclusions.
- Manage concrete occurrences: one-off exclusions, comments, and Todo completion.
- Month, Week, Todo, detail, Database, Settings, and focus pages; Database presents results through paginated queries.
- A complete focus cycle with records and reminder calculation.
- Electron SQLite and settings persistence, system notifications, tray background mode, and auto-start.

The in-app **Help** page contains schedule-expression examples. See the [architecture document](docs/architecture.md) for implementation boundaries.

## Default shortcuts

Use Settings → Keyboard Shortcuts to change, clear, or restore these shortcuts. Changes are saved on the current device and restored after restarting the app.

| Shortcut | Action |
| --- | --- |
| `Ctrl+ArrowUp` | Open the Add schedule dialog |
| `Ctrl+ArrowDown` | Close the Add schedule dialog |
| `Ctrl+ArrowLeft` / `Ctrl+ArrowRight` | Switch navigation pages |
| `Ctrl+1` … `Ctrl+7` | Insert the next Monday through Sunday into the focused `rTime` or `exTime` field |
| `Ctrl+Enter` | Submit the open Add schedule dialog |

## Requirements and installation

Use Node.js 24 LTS and pnpm 11.17.0 pinned by `package.json#packageManager`.

```powershell
corepack enable
pnpm install --frozen-lockfile
```

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev:web` | Start the Web development server |
| `pnpm build:web` | Type-check and build the Web app |
| `pnpm build:electron` | Type-check and build Electron main and preload outputs |
| `pnpm start:electron` | Build and start Electron |
| `pnpm lint` | Run ESLint |
| `pnpm typecheck` | Type-check Web and Electron TypeScript |
| `pnpm test:unit` | Run unit, contract, and parser tests |
| `pnpm test:integration` | Rebuild native modules and run integration tests |
| `pnpm test:e2e:web` | Build and run Web E2E tests |
| `pnpm test:e2e:electron` | Rebuild native modules, build, and run Electron E2E tests |
| `pnpm parser:generate` | Regenerate the parser from the grammar |
| `pnpm parser:check-generated` | Regenerate the parser and check committed generated output |
| `pnpm package:win` | Package a Windows x64 NSIS installer |
| `pnpm test:package:win` | Run a smoke test against the packaged app |
| `pnpm release:win` | Run the complete Windows release verification chain |

Electron and packaged-app E2E tests launch GUI child processes and should run in a Windows desktop session. See the [Windows release guide](docs/development/windows-release.md) for local release details.

## Database behavior

When the target database does not exist, Electron executes `src-electron/adapters/db/schema.sql` to create a fresh v2 SQLite database. An existing database is only opened; it is not converted or upgraded. There is no 1.2 import, conversion, backup, or migration flow, and legacy-data compatibility is not a v2 goal.

## Current scope

- Sync, accounts, and authentication are deferred.
- A Tauri host is deferred. `src` remains browser-runnable and keeps platform contracts for a future adapter.
- Windows x64 NSIS is the only verified packaging target. Signing, auto-update, macOS packaging, and Linux packaging are not implemented.
