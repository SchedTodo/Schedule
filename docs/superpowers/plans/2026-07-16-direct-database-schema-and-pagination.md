# Direct Database Schema and Pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all database migration behavior, initialize new databases from one complete schema, and present the Database page as a remotely paginated Naive UI data table.

**Architecture:** A single `src-electron/adapters/db/schema.sql` is the complete current schema. A small database initializer executes it only when the target file did not exist before opening; existing files are opened without conversion or upgrades. The Database Vue page owns remote pagination state and passes the current server page to `NDataTable`.

**Tech Stack:** Node.js 24 LTS, pnpm 11.11.0, TypeScript 6 strict, Vue 3, Naive UI, Electron, better-sqlite3, Drizzle ORM, Vitest, Vue Test Utils.

## Global Constraints

- Work directly on `main`; do not create a branch or worktree.
- Use Node.js 24 LTS and the exact `pnpm@11.11.0` pinned by `packageManager`.
- Keep `src` browser-runnable and platform-independent.
- Do not introduce TanStack Query or new dependencies.
- Use RED-GREEN TDD for each behavior change.
- Do not restore v1 compatibility, backup, migration metadata, version checks, or incremental schema upgrades.
- Existing database files are opened unchanged; only a missing database file receives the current complete schema.
- Database pagination defaults to 10 rows and offers 5, 10, 15, and 20 rows per page.
- Preserve unrelated user changes and use Chinese Conventional Commit subjects.

---

## File Structure

- Create `src-electron/adapters/db/schema.sql`: the complete current SQLite schema without migration metadata.
- Modify `src-electron/adapters/db/client.ts`: expose new-file-only schema initialization.
- Modify `src-electron/main/index.ts`: consume the initializer and one raw schema import.
- Create `tests/integration/database/database-initialization.test.ts`: prove new and existing file behavior and absence of migration metadata.
- Modify four repository integration test files to initialize their in-memory databases from `schema.sql`.
- Delete `src-electron/adapters/db/migrate-v1.ts`, `src-electron/adapters/db/migrations/**`, and `tests/integration/database/v1-migration.test.ts`.
- Modify `src/pages/database.vue`: use `NDataTable` columns and remote pagination.
- Modify `tests/unit/features/database-page.test.ts`: verify paging queries, filters, restore, and row navigation.
- Modify `tests/unit/features/database-page-source.test.ts`: replace native-table source assertions with data-table constraints.
- Modify `tests/unit/features/secondary-pages.test.ts`: assert the Database page data table and pagination contract.
- Modify `docs/superpowers/plans/2026-07-11-schedule-v2-rebuild.md`: remove active requirements that promise migration support.

### Task 1: Replace migrations with direct schema initialization

**Files:**
- Create: `tests/integration/database/database-initialization.test.ts`
- Create: `src-electron/adapters/db/schema.sql`
- Modify: `src-electron/adapters/db/client.ts`
- Modify: `src-electron/main/index.ts`
- Modify: `tests/integration/database/schedule-repository.test.ts`
- Modify: `tests/integration/database/occurrence-repository.test.ts`
- Modify: `tests/integration/database/settings-repository.test.ts`
- Modify: `tests/integration/database/schedule-management.test.ts`
- Delete: `src-electron/adapters/db/migrate-v1.ts`
- Delete: `src-electron/adapters/db/migrations/0001_v2_schema.sql`
- Delete: `src-electron/adapters/db/migrations/0002_occurrence.sql`
- Delete: `src-electron/adapters/db/migrations/0003_settings.sql`
- Delete: `src-electron/adapters/db/migrations/0004_concentration_record.sql`
- Delete: `tests/integration/database/v1-migration.test.ts`
- Modify: `docs/superpowers/plans/2026-07-11-schedule-v2-rebuild.md`

**Interfaces:**
- Produces: `initializeScheduleDatabase(path: string, schemaSql: string): ReturnType<typeof openScheduleDatabase>`.
- Produces: one `schema.sql` containing `schedule`, `schedule_occurrence`, `app_settings`, and `concentration_record`.
- Removes: `MigrationResult`, `migrateV1Database`, `app_migration`, backup paths, and numbered migration imports.

- [ ] **Step 1: Write the failing database initialization tests**

Create `tests/integration/database/database-initialization.test.ts`:

```ts
// @vitest-environment node

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { initializeScheduleDatabase } from '../../../src-electron/adapters/db/client'

const schemaSql = readFileSync(
  new URL('../../../src-electron/adapters/db/schema.sql', import.meta.url),
  'utf8'
)

describe('initializeScheduleDatabase', () => {
  let directory: string

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'schedule-database-'))
  })

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true })
  })

  it('creates the complete current schema for a new database', () => {
    const connection = initializeScheduleDatabase(join(directory, 'schedule.db'), schemaSql)
    const tables = connection.sqlite.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
    ).all() as Array<{ name: string }>

    expect(tables.map(({ name }) => name)).toEqual([
      'app_settings',
      'concentration_record',
      'schedule',
      'schedule_occurrence'
    ])
    connection.sqlite.close()
  })

  it('opens an existing database without applying schema changes', () => {
    const path = join(directory, 'existing.db')
    const existing = new Database(path)
    existing.exec('CREATE TABLE marker (value TEXT NOT NULL)')
    existing.close()

    const connection = initializeScheduleDatabase(path, schemaSql)
    const schedule = connection.sqlite.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schedule'"
    ).get()

    expect(schedule).toBeUndefined()
    connection.sqlite.close()
  })
})
```

- [ ] **Step 2: Run the initialization test and verify RED**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/integration/database/database-initialization.test.ts
```

Expected: FAIL because `schema.sql` and `initializeScheduleDatabase` do not exist.

- [ ] **Step 3: Create the complete schema without migration metadata**

Create `src-electron/adapters/db/schema.sql` by combining the current four table definitions and indexes. It must contain these statements and no `app_migration` table or version inserts:

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE schedule (
  id TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('event', 'todo')),
  title TEXT NOT NULL CHECK (length(title) > 0),
  recurrence_code TEXT NOT NULL,
  exclusion_code TEXT NOT NULL DEFAULT '',
  comment TEXT NOT NULL DEFAULT '',
  starred INTEGER NOT NULL DEFAULT 0 CHECK (starred IN (0, 1)),
  deleted_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE schedule_occurrence (
  id TEXT PRIMARY KEY NOT NULL,
  schedule_id TEXT NOT NULL REFERENCES schedule(id),
  excluded INTEGER NOT NULL DEFAULT 0 CHECK (excluded IN (0, 1)),
  start INTEGER,
  end INTEGER NOT NULL,
  start_mark TEXT NOT NULL CHECK (start_mark IN ('00', '01', '10', '11')),
  end_mark TEXT NOT NULL CHECK (end_mark IN ('00', '01', '10', '11')),
  comment TEXT NOT NULL DEFAULT '',
  done INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0, 1)),
  deleted_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE app_settings (
  id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE concentration_record (
  id TEXT PRIMARY KEY NOT NULL,
  schedule_id TEXT NOT NULL REFERENCES schedule(id),
  start INTEGER NOT NULL,
  end INTEGER NOT NULL,
  deleted_at INTEGER
);
```

Also copy the existing `schedule_kind_updated_idx`, `occurrence_start_end_idx`, `occurrence_schedule_deleted_idx`, and `record_schedule_start_idx` definitions unchanged. Do not use `IF NOT EXISTS`; this file represents one fresh schema creation.

- [ ] **Step 4: Implement new-file-only initialization**

In `src-electron/adapters/db/client.ts`, import `existsSync` and add:

```ts
export function initializeScheduleDatabase(path: string, schemaSql: string) {
  const databaseExists = existsSync(path)
  const connection = openScheduleDatabase(path)
  if (!databaseExists) connection.sqlite.exec(schemaSql)
  return connection
}
```

In `src-electron/main/index.ts`, remove `existsSync`, `migrateV1Database`, and all numbered migration imports. Import only:

```ts
import schemaSql from '../adapters/db/schema.sql?raw'
import { initializeScheduleDatabase } from '../adapters/db/client'
```

Replace the migration block and `openScheduleDatabase` call with:

```ts
const connection = initializeScheduleDatabase(databasePath, schemaSql)
```

- [ ] **Step 5: Point repository tests at the single schema**

In each affected database integration test, replace every numbered migration read with one setup call:

```ts
sqlite.exec(
  readFileSync(
    new URL('../../../src-electron/adapters/db/schema.sql', import.meta.url),
    'utf8'
  )
)
```

- [ ] **Step 6: Delete migration implementation and tests, and update the active rebuild plan**

Delete the files listed above. In `docs/superpowers/plans/2026-07-11-schedule-v2-rebuild.md`, replace the active migration constraints and Task 5 wording with the approved direct-schema boundary: fresh v2 databases only, no v1 conversion, backup, migration metadata, or incremental upgrade promise.

- [ ] **Step 7: Run database verification and confirm GREEN**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/integration/database
.\node_modules\.bin\vue-tsc.cmd --noEmit -p tsconfig.electron.json
rg -n -i "migrate|migration|app_migration|v1\.backup|000[1-4]_" src-electron tests/integration/database
```

Expected: database tests and Electron typecheck exit `0`; `rg` returns no matches and exit code `1`.

- [ ] **Step 8: Commit direct schema initialization**

Run:

```powershell
git -c safe.directory=D:/project/Schedule add src-electron tests/integration/database docs/superpowers/plans/2026-07-11-schedule-v2-rebuild.md
git -c safe.directory=D:/project/Schedule diff --cached --check
git -c safe.directory=D:/project/Schedule commit -m "refactor(database): 改为直接创建完整数据库"
```

### Task 2: Replace the Database table with remote `NDataTable` pagination

**Files:**
- Modify: `tests/unit/features/database-page.test.ts`
- Modify: `tests/unit/features/database-page-source.test.ts`
- Modify: `tests/unit/features/secondary-pages.test.ts`
- Modify: `src/pages/database.vue`

**Interfaces:**
- Consumes: `platform.schedules.searchPage(query)` and `SchedulePageItemDto`.
- Produces: `DataTableColumns<SchedulePageItemDto>` and `PaginationProps` with page 1, page size 10, `itemCount`, `showSizePicker`, and page sizes `[5, 10, 15, 20]`.
- Preserves: filters, restore, star display, ID truncation, total display, and schedule-detail navigation.

- [ ] **Step 1: Write failing component tests for remote pagination**

Import `NDataTable` in `tests/unit/features/database-page.test.ts`. Add a test that gets the table and invokes its pagination callbacks:

```ts
it('uses remote pagination and resets the page when page size changes', async () => {
  const { searchPage, wrapper } = await mountDatabase()
  const table = wrapper.getComponent(NDataTable)
  const pagination = table.props('pagination') as {
    page: number
    pageSize: number
    itemCount: number
    showSizePicker: boolean
    pageSizes: number[]
    onChange: (page: number) => void
    onUpdatePageSize: (pageSize: number) => void
  }

  expect(table.props('remote')).toBe(true)
  expect(pagination).toMatchObject({
    page: 1,
    pageSize: 10,
    itemCount: 2,
    showSizePicker: true,
    pageSizes: [5, 10, 15, 20]
  })
  expect(searchPage.mock.calls[0]?.[0]).toMatchObject({ page: 1, pageSize: 10 })

  pagination.onChange(2)
  await vi.waitFor(() => {
    expect(searchPage.mock.calls.at(-1)?.[0]).toMatchObject({ page: 2, pageSize: 10 })
  })

  ;(wrapper.getComponent(NDataTable).props('pagination') as typeof pagination)
    .onUpdatePageSize(5)
  await vi.waitFor(() => {
    expect(searchPage.mock.calls.at(-1)?.[0]).toMatchObject({ page: 1, pageSize: 5 })
  })
})
```

Extend the filter test so it first changes to page 2, clicks `.database-star-filter`, and expects the last query to include `{ page: 1, pageSize: 10, starred: true }`.

- [ ] **Step 2: Update source and secondary-page expectations before production code**

In `database-page-source.test.ts`, remove assertions for literal `<th>` and `<td>` markup. Require `NDataTable`, `DataTableColumns<SchedulePageItemDto>`, the ID column width/ellipsis contract, and the absence of `.database-pagination` and a native `<table>`.

In `secondary-pages.test.ts`, get `NDataTable` from the Database page and assert:

```ts
expect(table.props('remote')).toBe(true)
expect(table.props('pagination')).toMatchObject({
  pageSize: 10,
  showSizePicker: true,
  pageSizes: [5, 10, 15, 20]
})
```

- [ ] **Step 3: Run Database page tests and verify RED**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/unit/features/database-page.test.ts tests/unit/features/database-page-source.test.ts tests/unit/features/secondary-pages.test.ts
```

Expected: FAIL because the page still renders a native table and manual pagination, and requests 20 rows.

- [ ] **Step 4: Implement typed columns and row rendering**

In `src/pages/database.vue`, import `h`, `reactive`, `NDataTable`, and the Naive UI `DataTableColumns` and `PaginationProps` types. Replace the native table cells with `columns: DataTableColumns<SchedulePageItemDto>` using these keys and titles:

```ts
const columns: DataTableColumns<SchedulePageItemDto> = [
  { title: 'ID', key: 'id', width: '8rem', ellipsis: { tooltip: true }, className: 'database-id-cell' },
  { title: 'Name', key: 'title' },
  { title: 'Deleted', key: 'deleted', className: 'database-deleted-cell', render: renderDeleted },
  { title: 'Created', key: 'createdAt', render: (item) => new Date(item.createdAt).toLocaleString() },
  { title: 'Updated', key: 'updatedAt', render: (item) => new Date(item.updatedAt).toLocaleString() },
  { title: 'Type', key: 'kind', render: renderKind },
  { title: 'Star', key: 'starred', render: renderStar }
]
```

Use `h(NTag, ...)`, `h(NButton, ...)`, and `h(NIcon, ...)` in the three render helpers. The Restore button calls `event.stopPropagation()` before `void restore(item.id)`. Add:

```ts
function rowProps(item: SchedulePageItemDto) {
  return {
    onClick: () => void router.push({ name: 'schedule-detail', params: { id: item.id } })
  }
}
```

- [ ] **Step 5: Implement reactive remote pagination**

Replace `page`, constant `pageSize`, and `total` with:

```ts
const pagination = reactive<PaginationProps>({
  page: 1,
  pageSize: 10,
  itemCount: 0,
  showSizePicker: true,
  pageSizes: [5, 10, 15, 20],
  prefix: ({ itemCount }) => `Total is ${itemCount ?? 0}.`,
  onChange(nextPage) {
    pagination.page = nextPage
    void refresh()
  },
  onUpdatePageSize(nextPageSize) {
    pagination.pageSize = nextPageSize
    pagination.page = 1
    void refresh()
  }
})
```

`refresh()` sends `page: pagination.page ?? 1` and `pageSize: pagination.pageSize ?? 10`, and assigns `pagination.itemCount = result.value.total` on success. The filter watcher sets `pagination.page = 1` before refresh.

Replace the native table and manual pagination template with:

```vue
<NDataTable
  remote
  :columns="columns"
  :data="items"
  :pagination="pagination"
  :row-props="rowProps"
/>
```

Delete native table and `.database-pagination` CSS. Retain only class rules still used by data-table columns and renderers.

- [ ] **Step 6: Run focused tests and confirm GREEN**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/unit/features/database-page.test.ts tests/unit/features/database-page-source.test.ts tests/unit/features/secondary-pages.test.ts
```

Expected: all three files pass with zero failures.

- [ ] **Step 7: Run static checks and Web build**

Run:

```powershell
.\node_modules\.bin\eslint.cmd .
.\node_modules\.bin\vue-tsc.cmd --noEmit -p tsconfig.app.json
.\node_modules\.bin\vite.cmd build
```

Expected: all commands exit `0`. The existing chunk-size warning is non-fatal.

- [ ] **Step 8: Commit the paginated data table**

Run:

```powershell
git -c safe.directory=D:/project/Schedule add src/pages/database.vue tests/unit/features/database-page.test.ts tests/unit/features/database-page-source.test.ts tests/unit/features/secondary-pages.test.ts
git -c safe.directory=D:/project/Schedule diff --cached --check
git -c safe.directory=D:/project/Schedule commit -m "feat(database): 使用数据表格分页展示日程"
```

### Task 3: Final verification and clean-workspace audit

**Files:**
- Verify only; no planned production edits.

**Interfaces:**
- Verifies the direct-schema and remote-pagination contracts together.

- [ ] **Step 1: Run the required project checks**

Run:

```powershell
.\node_modules\.bin\eslint.cmd .
.\node_modules\.bin\vue-tsc.cmd --noEmit -p tsconfig.app.json
.\node_modules\.bin\vue-tsc.cmd --noEmit -p tsconfig.electron.json
.\node_modules\.bin\vitest.cmd run tests/unit tests/contracts tests/parser
.\node_modules\.bin\vitest.cmd run tests/integration/database
.\node_modules\.bin\vite.cmd build
```

Expected: lint, both typechecks, database integration tests, and build exit `0`. The unit suite currently has a known date-dependent baseline in `tests/unit/features/home-workspace.test.ts`; do not weaken or silently rewrite it as part of this task. Record its exact fresh result if it remains failing.

- [ ] **Step 2: Audit removed migration logic and final diff**

Run:

```powershell
rg -n -i "migrate|migration|app_migration|v1\.backup|000[1-4]_" src-electron tests/integration/database
git -c safe.directory=D:/project/Schedule diff --check
git -c safe.directory=D:/project/Schedule status --short --branch
git -c safe.directory=D:/project/Schedule log -5 --oneline
```

Expected: the migration scan returns no matches; diff check reports no errors; the worktree is clean; recent commits include the direct-schema and Database pagination commits.
