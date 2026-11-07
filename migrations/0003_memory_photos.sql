-- Keep all existing records and their visibility unchanged.
-- memory_text permits photo-only submissions while preserving the legacy body constraint.
ALTER TABLE wall_notes ADD COLUMN memory_text TEXT CHECK(memory_text IS NULL OR length(memory_text) <= 1000);
ALTER TABLE wall_notes ADD COLUMN contact_email TEXT;
ALTER TABLE wall_notes ADD COLUMN consented_at TEXT;
ALTER TABLE wall_notes ADD COLUMN policy_version TEXT;
ALTER TABLE wall_notes ADD COLUMN photo_json TEXT CHECK(photo_json IS NULL OR json_valid(photo_json));
ALTER TABLE wall_notes ADD COLUMN photo_from TEXT;
ALTER TABLE wall_notes ADD COLUMN photo_to TEXT;
ALTER TABLE wall_note_reviews ADD COLUMN photo_before TEXT;
ALTER TABLE wall_note_reviews ADD COLUMN photo_after TEXT;
