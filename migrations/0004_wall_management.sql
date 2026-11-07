-- Original photographs keep their source assets; family edits are durable overrides.
CREATE TABLE wall_curated_edits (
  id TEXT PRIMARY KEY,
  content_json TEXT NOT NULL CHECK(json_valid(content_json)),
  hidden INTEGER NOT NULL DEFAULT 0 CHECK(hidden IN (0,1)),
  version INTEGER NOT NULL DEFAULT 0,
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_change_id TEXT NOT NULL
);
-- Content snapshots are private and retained independently of public visibility.
CREATE TABLE wall_content_changes (
  id TEXT PRIMARY KEY,
  item_kind TEXT NOT NULL CHECK(item_kind IN ('curated','submission')),
  item_id TEXT NOT NULL,
  reviewer TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('edit','hide','restore')),
  before_json TEXT NOT NULL CHECK(json_valid(before_json)),
  after_json TEXT NOT NULL CHECK(json_valid(after_json)),
  created_at TEXT NOT NULL
);
CREATE INDEX wall_content_changes_item ON wall_content_changes(item_kind,item_id,created_at DESC);
ALTER TABLE wall_notes ADD COLUMN posted_on TEXT;
-- Legacy imports have UTC timestamps. The deployment backfill uses the memorial time zone.
UPDATE wall_notes SET posted_on=substr(created_at,1,10) WHERE posted_on IS NULL;
