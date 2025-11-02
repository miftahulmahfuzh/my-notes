-- Down migration for template_usages table
-- This removes the template_usages table and related objects

-- Drop indexes (they will be dropped with the table, but being explicit)
DROP INDEX IF EXISTS idx_template_usages_template_id;
DROP INDEX IF EXISTS idx_template_usages_user_id;
DROP INDEX IF EXISTS idx_template_usages_note_id;
DROP INDEX IF EXISTS idx_template_usages_used_at;
DROP INDEX IF EXISTS idx_template_usages_used_at_asc;
DROP INDEX IF EXISTS idx_template_usages_template_user_used_at;
DROP INDEX IF EXISTS idx_template_usages_user_used_at_template;
DROP INDEX IF EXISTS idx_template_usages_template_date_count;
DROP INDEX IF EXISTS idx_template_usages_variables;

-- Drop functions
DROP FUNCTION IF EXISTS get_template_usage_stats(UUID, INTEGER);
DROP FUNCTION IF EXISTS record_template_usage(UUID, UUID, JSONB, INTEGER, TEXT);
DROP FUNCTION IF EXISTS get_popular_templates(UUID, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS cleanup_old_template_usages(INTEGER);

-- Drop the table
DROP TABLE IF EXISTS template_usages;