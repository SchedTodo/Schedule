CREATE TABLE IF NOT EXISTS concentration_record (
  id TEXT PRIMARY KEY NOT NULL,
  schedule_id TEXT NOT NULL REFERENCES schedule(id),
  start INTEGER NOT NULL,
  end INTEGER NOT NULL,
  deleted_at INTEGER
);
CREATE INDEX IF NOT EXISTS record_schedule_start_idx
  ON concentration_record (schedule_id, start);
INSERT OR IGNORE INTO app_migration (version, applied_at)
VALUES (4, unixepoch('subsec') * 1000);
