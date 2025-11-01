-- Drop constraint
ALTER TABLE tags DROP CONSTRAINT IF EXISTS valid_tag_name;

-- Drop indexes
DROP INDEX IF EXISTS idx_tags_name;
DROP INDEX IF EXISTS idx_tags_created_at;

-- Drop table
DROP TABLE IF EXISTS tags;