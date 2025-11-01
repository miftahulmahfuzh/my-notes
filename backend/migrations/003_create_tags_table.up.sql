-- Create tags table
CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_tags_name ON tags(name);
CREATE INDEX idx_tags_created_at ON tags(created_at);

-- Add comments
COMMENT ON TABLE tags IS 'Tags table for storing note hashtags';
COMMENT ON COLUMN tags.id IS 'Primary key UUID';
COMMENT ON COLUMN tags.name IS 'Tag name (unique, max 100 characters)';
COMMENT ON COLUMN tags.created_at IS 'Timestamp when tag was created';

-- Add constraint to ensure tags start with #
ALTER TABLE tags ADD CONSTRAINT valid_tag_name
CHECK (name ~ '^#[a-zA-Z0-9_-]+$');