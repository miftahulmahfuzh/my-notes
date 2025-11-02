-- Down migration for template_categories table
-- This removes the template_categories table and related objects

-- Drop trigger
DROP TRIGGER IF EXISTS update_template_categories_updated_at_trigger ON template_categories;

-- Drop function
DROP FUNCTION IF EXISTS update_template_categories_updated_at();

-- Drop the table
DROP TABLE IF EXISTS template_categories;