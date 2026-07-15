# Direct Database Schema and Pagination Design

## Goal

Remove every database migration path and make new desktop databases start from one current schema, while changing the Database page to a server-paginated Naive UI data table.

## Scope

- Delete v1 database conversion, backup, version detection, migration metadata, incremental migration SQL, and their dedicated tests.
- Replace the migration set with one reviewed `schema.sql` containing the complete current database structure.
- Execute the complete schema only when the desktop database file did not exist before startup.
- Replace the Database page's native table and hand-written previous/next controls with `NDataTable` and its remote pagination.
- Preserve the current uncommitted Schedule detail, test, instruction, and feature-gap edits and include them when the workspace is finally committed.

Existing database files are outside compatibility scope. The application opens them without applying schema upgrades, backups, or compatibility checks.

## Database Initialization

`src-electron/adapters/db/schema.sql` is the sole schema source. It contains the current `schedule`, `occurrence`, `settings`, and `concentration_record` tables, including their indexes, constraints, and foreign keys. It contains no `app_migration` table or version rows.

The Electron composition root checks whether the configured database file existed before opening it. For a new file, it opens the connection and executes `schema.sql` once. For an existing file, it only opens the connection. The initialization API does not expose migration status, backup paths, legacy table names, or version numbers.

Integration tests create fresh temporary databases from `schema.sql`. The v1 fixture migration test and migration implementation are removed. Repository tests continue to prove that the consolidated schema supports every current repository.

## Database Page

`src/pages/database.vue` uses `NDataTable` with explicit columns for ID, Name, Deleted, Created, Updated, Type, and Star. Cell renderers retain the existing tags, restore action, star icon, ID truncation, and row navigation.

Pagination remains server-side through `platform.schedules.searchPage`. Its reactive state starts at page 1 with a page size of 10, exposes page sizes 5, 10, 15, and 20, and uses the returned total as `itemCount`. Changing page or page size triggers a new request. Changing search text, date range, kind, or starred-only resets the page to 1 before refreshing. Changing page size also resets the page to 1.

The table presents the current result page only. It does not add client-side sorting, selection, or duplicate filtering.

## Failure Handling

Existing gateway-result behavior is retained: unsuccessful searches do not replace the current rows or total. Restore continues to refresh after the gateway call. Database schema execution errors propagate through startup; no migration-specific recovery or backup behavior remains.

## Testing

Development follows RED-GREEN TDD:

1. Add failing source and component tests that require `NDataTable`, remote pagination, default page size 10, the allowed page sizes, page/page-size queries, and reset-to-first-page behavior.
2. Add failing database initialization tests that require the consolidated schema and the absence of migration/version behavior.
3. Implement the minimum page and database initialization changes to pass those tests.
4. Run the focused Database page and database integration suites, then the required ESLint, Vue TypeScript, unit/contract/parser tests, and Vite build.

## Documentation and Git

Update active project documentation where it still promises v1 or incremental migration support. Do not rewrite legacy branch history or unrelated code. Final commits use a Conventional Commit type with a concise Chinese description, and the final workspace must be clean.
