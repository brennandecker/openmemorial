ALTER TABLE wall_notes ADD COLUMN status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','declined','hidden'));
ALTER TABLE wall_notes ADD COLUMN review_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE wall_notes ADD COLUMN reviewed_by TEXT;
ALTER TABLE wall_notes ADD COLUMN reviewed_at TEXT;
ALTER TABLE wall_notes ADD COLUMN last_review_id TEXT;
CREATE INDEX wall_notes_status ON wall_notes(status, created_at DESC, id DESC);
CREATE TABLE wall_note_reviews (
  id TEXT PRIMARY KEY,
  note_id TEXT NOT NULL REFERENCES wall_notes(id),
  reviewer TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('approve','decline','hide')),
  previous_status TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX wall_note_reviews_note ON wall_note_reviews(note_id, created_at DESC);
UPDATE wall_notes SET status = CASE WHEN hidden = 0 THEN 'approved' ELSE 'hidden' END;
CREATE TRIGGER wall_notes_pending_private AFTER INSERT ON wall_notes WHEN NEW.status != 'approved' BEGIN UPDATE wall_notes SET hidden = 1 WHERE id = NEW.id; END;
