PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS app_migration (
  version INTEGER PRIMARY KEY NOT NULL,
  applied_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS schedule (
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

CREATE INDEX IF NOT EXISTS schedule_kind_updated_idx
  ON schedule (kind, updated_at DESC)
  WHERE deleted_at IS NULL;

INSERT OR IGNORE INTO app_migration (version, applied_at)
VALUES (1, unixepoch('subsec') * 1000);
