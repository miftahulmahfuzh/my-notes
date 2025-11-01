-- Drop triggers
DROP TRIGGER IF EXISTS increment_notes_version ON notes;
DROP TRIGGER IF EXISTS update_notes_updated_at ON notes;

-- Drop function
DROP FUNCTION IF EXISTS increment_version();

-- Drop indexes
DROP INDEX IF EXISTS idx_notes_user_id;
DROP INDEX IF EXISTS idx_notes_created_at;
DROP INDEX IF EXISTS idx_notes_updated_at;
DROP INDEX IF EXISTS idx_notes_user_created;

-- Drop table
DROP TABLE IF EXISTS notes;