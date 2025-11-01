-- Drop function
DROP FUNCTION IF EXISTS find_notes_by_tags(TEXT[]);

-- Drop indexes
DROP INDEX IF EXISTS idx_note_tags_note_id;
DROP INDEX IF EXISTS idx_note_tags_tag_id;
DROP INDEX IF EXISTS idx_note_tags_created_at;

-- Drop table
DROP TABLE IF EXISTS note_tags;