CREATE TABLE IF NOT EXISTS wall_notes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 80),
  body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 1000),
  created_at TEXT NOT NULL,
  hidden INTEGER NOT NULL DEFAULT 0 CHECK(hidden IN (0, 1))
);
CREATE INDEX IF NOT EXISTS wall_notes_visible ON wall_notes(hidden, created_at DESC, id DESC);
