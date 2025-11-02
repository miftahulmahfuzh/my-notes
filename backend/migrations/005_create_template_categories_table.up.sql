-- Create template_categories table for organizing templates
-- This should be run before the templates table migration

CREATE TABLE template_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    icon VARCHAR(50) DEFAULT 'folder',
    color VARCHAR(7) DEFAULT '#6b7280',
    sort_order INTEGER DEFAULT 0,
    is_built_in BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT template_categories_name_not_empty CHECK (length(trim(name)) > 0),
    CONSTRAINT template_categories_sort_order_non_negative CHECK (sort_order >= 0),
    CONSTRAINT template_categories_color_format CHECK (color ~ '^#[0-9a-fA-F]{6}$')
);

-- Create indexes
CREATE INDEX idx_template_categories_name ON template_categories(name);
CREATE INDEX idx_template_categories_sort_order ON template_categories(sort_order);
CREATE INDEX idx_template_categories_is_built_in ON template_categories(is_built_in);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_template_categories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_template_categories_updated_at_trigger
    BEFORE UPDATE ON template_categories
    FOR EACH ROW
    EXECUTE FUNCTION update_template_categories_updated_at();

-- Insert built-in categories
INSERT INTO template_categories (id, name, description, icon, color, sort_order, is_built_in) VALUES
('00000000-0000-0000-0000-000000000001', 'work', 'Work-related templates', 'briefcase', '#3b82f6', 1, TRUE),
('00000000-0000-0000-0000-000000000002', 'personal', 'Personal templates', 'user', '#10b981', 2, TRUE),
('00000000-0000-0000-0000-000000000003', 'productivity', 'Productivity templates', 'check-circle', '#f59e0b', 3, TRUE),
('00000000-0000-0000-0000-000000000004', 'meeting', 'Meeting templates', 'users', '#8b5cf6', 4, TRUE),
('00000000-0000-0000-0000-000000000005', 'project', 'Project management templates', 'folder', '#ef4444', 5, TRUE),
('00000000-0000-0000-0000-000000000006', 'general', 'General purpose templates', 'document', '#6b7280', 99, TRUE)
ON CONFLICT (id) DO NOTHING;

-- Add comments
COMMENT ON TABLE template_categories IS 'Categories for organizing templates, including built-in system categories';
COMMENT ON COLUMN template_categories.id IS 'Unique identifier for the category';
COMMENT ON COLUMN template_categories.name IS 'Human-readable name of the category';
COMMENT ON COLUMN template_categories.description IS 'Brief description of the category purpose';
COMMENT ON COLUMN template_categories.icon IS 'Icon name for UI display';
COMMENT ON COLUMN template_categories.color IS 'Hex color code for UI theming';
COMMENT ON COLUMN template_categories.sort_order IS 'Display order in UI';
COMMENT ON COLUMN template_categories.is_built_in IS 'True for system-provided categories';