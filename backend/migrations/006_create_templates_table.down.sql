-- Down migration for templates table
-- This removes the templates table and related objects

-- Drop indexes (they will be dropped with the table, but being explicit)
DROP INDEX IF EXISTS idx_templates_user_id;
DROP INDEX IF EXISTS idx_templates_category;
DROP INDEX IF EXISTS idx_templates_is_built_in;
DROP INDEX IF EXISTS idx_templates_is_public;
DROP INDEX IF EXISTS idx_templates_usage_count;
DROP INDEX IF EXISTS idx_templates_created_at;
DROP INDEX IF EXISTS idx_templates_updated_at;
DROP INDEX IF EXISTS idx_templates_tags;
DROP INDEX IF EXISTS idx_templates_search;
DROP INDEX IF EXISTS idx_templates_user_category_usage;
DROP INDEX IF EXISTS idx_templates_user_name_unique;

-- Drop trigger
DROP TRIGGER IF EXISTS update_templates_updated_at ON templates;

-- Drop function
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop the table (this will cascade delete built-in templates)
DROP TABLE IF EXISTS templates;

-- Note: We don't delete template_categories here as they might be used by other features
-- If you want to remove built-in categories, add that logic in a separate migration