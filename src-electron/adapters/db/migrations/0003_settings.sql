CREATE TABLE IF NOT EXISTS app_settings (
  id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

INSERT OR IGNORE INTO app_migration (version, applied_at)
VALUES (3, unixepoch('subsec') * 1000);
