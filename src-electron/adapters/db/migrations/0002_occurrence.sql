PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schedule_occurrence (
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

CREATE INDEX IF NOT EXISTS occurrence_start_end_idx
  ON schedule_occurrence (start, end);

CREATE INDEX IF NOT EXISTS occurrence_schedule_deleted_idx
  ON schedule_occurrence (schedule_id, deleted_at);

INSERT OR IGNORE INTO app_migration (version, applied_at)
VALUES (2, unixepoch('subsec') * 1000);
