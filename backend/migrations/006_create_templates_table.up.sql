-- Create templates table for storing note templates
-- This migration creates the core templates functionality

CREATE TABLE templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    content TEXT NOT NULL,
    category VARCHAR(100) DEFAULT 'general',
    variables TEXT[] DEFAULT '{}',
    is_built_in BOOLEAN DEFAULT FALSE,
    usage_count INTEGER DEFAULT 0,
    is_public BOOLEAN DEFAULT FALSE,
    icon VARCHAR(50) DEFAULT 'document',
    tags JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT templates_usage_count_non_negative CHECK (usage_count >= 0),
    CONSTRAINT templates_name_not_empty CHECK (length(trim(name)) > 0),
    CONSTRAINT templates_content_not_empty CHECK (length(trim(content)) > 0)
);

-- Create indexes for performance
CREATE INDEX idx_templates_user_id ON templates(user_id);
CREATE INDEX idx_templates_category ON templates(category);
CREATE INDEX idx_templates_is_built_in ON templates(is_built_in);
CREATE INDEX idx_templates_is_public ON templates(is_public);
CREATE INDEX idx_templates_usage_count ON templates(usage_count DESC);
CREATE INDEX idx_templates_created_at ON templates(created_at DESC);
CREATE INDEX idx_templates_updated_at ON templates(updated_at DESC);

-- GIN index for tags array
CREATE INDEX idx_templates_tags ON templates USING GIN(tags);

-- GIN index for full-text search
CREATE INDEX idx_templates_search ON templates USING GIN(
    to_tsvector('english',
        COALESCE(name, '') || ' ' ||
        COALESCE(description, '') || ' ' ||
        COALESCE(content, '')
    )
);

-- Composite index for common queries
CREATE INDEX idx_templates_user_category_usage ON templates(user_id, category, usage_count DESC);

-- Create unique index for user template names (excluding built-in templates)
CREATE UNIQUE INDEX idx_templates_user_name_unique ON templates(user_id, name) WHERE NOT is_built_in;

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_templates_updated_at
    BEFORE UPDATE ON templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Note: Built-in template categories are created in migration 005_create_template_categories_table.up.sql

-- Insert built-in templates (simplified for initial testing)
INSERT INTO templates (id, user_id, name, description, content, category, variables, is_built_in, usage_count, is_public, icon, tags) VALUES
('00000000-0000-0000-0000-000000000101', NULL, 'Meeting Notes', 'Template for taking structured meeting notes', '# Meeting Notes - {{date}}

**Attendees:**
{{attendees}}

**Agenda:**
{{agenda}}

**Action Items:**
{{action_items}}

**Next Steps:**
{{next_steps}}', 'meeting', '{date,attendees,agenda,action_items,next_steps}', TRUE, 0, TRUE, 'users', '["#meeting", "#notes"]'),

('00000000-0000-0000-0000-000000000102', NULL, 'Daily Journal', 'Template for daily journaling', '# Daily Journal - {{date}}

**Mood:** {{mood}}

**Highlights:**
{{highlights}}

**Gratitude:**
{{gratitude}}

**Lessons Learned:**
{{lessons}}', 'personal', '{date,mood,highlights,gratitude,lessons}', TRUE, 0, TRUE, 'book', '["#journal", "#daily"]')

ON CONFLICT (id) DO NOTHING;

-- Add comments for documentation
COMMENT ON TABLE templates IS 'Stores user-created and built-in note templates with variable substitution support';
COMMENT ON COLUMN templates.id IS 'Unique identifier for the template';
COMMENT ON COLUMN templates.user_id IS 'Owner of the template (NULL for built-in templates)';
COMMENT ON COLUMN templates.name IS 'Human-readable name of the template';
COMMENT ON COLUMN templates.description IS 'Brief description of the template purpose';
COMMENT ON COLUMN templates.content IS 'Template content with {{variable}} placeholders';
COMMENT ON COLUMN templates.category IS 'Category for organizing templates';
COMMENT ON COLUMN templates.variables IS 'Array of variable names used in the template';
COMMENT ON COLUMN templates.is_built_in IS 'True for system-provided templates';
COMMENT ON COLUMN templates.usage_count IS 'How many times this template has been applied';
COMMENT ON COLUMN templates.is_public IS 'Whether template is visible to other users';
COMMENT ON COLUMN templates.icon IS 'Icon name for UI display';
COMMENT ON COLUMN templates.tags IS 'Array of tags for search and filtering';