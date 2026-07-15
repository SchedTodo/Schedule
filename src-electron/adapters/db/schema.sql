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

CREATE INDEX schedule_kind_updated_idx
  ON schedule (kind, updated_at DESC)
  WHERE deleted_at IS NULL;

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

CREATE INDEX occurrence_start_end_idx
  ON schedule_occurrence (start, end);

CREATE INDEX occurrence_schedule_deleted_idx
  ON schedule_occurrence (schedule_id, deleted_at);

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

CREATE INDEX record_schedule_start_idx
  ON concentration_record (schedule_id, start);
