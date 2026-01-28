-- Rollback prettify fields
DROP INDEX IF EXISTS idx_notes_prettified;
ALTER TABLE notes DROP COLUMN IF EXISTS prettified_at;
ALTER TABLE notes DROP COLUMN IF EXISTS ai_improved;
