-- Create notes table
CREATE TABLE notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500),
    content TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    version INTEGER NOT NULL DEFAULT 1
);

-- Create indexes for performance
CREATE INDEX idx_notes_user_id ON notes(user_id);
CREATE INDEX idx_notes_created_at ON notes(created_at);
CREATE INDEX idx_notes_updated_at ON notes(updated_at);
CREATE INDEX idx_notes_user_created ON notes(user_id, created_at DESC);

-- Add comments
COMMENT ON TABLE notes IS 'Notes table for storing user notes';
COMMENT ON COLUMN notes.id IS 'Primary key UUID';
COMMENT ON COLUMN notes.user_id IS 'Foreign key to users table';
COMMENT ON COLUMN notes.title IS 'Optional note title (max 500 characters)';
COMMENT ON COLUMN notes.content IS 'Note content (required)';
COMMENT ON COLUMN notes.created_at IS 'Timestamp when note was created';
COMMENT ON COLUMN notes.updated_at IS 'Timestamp when note was last updated';
COMMENT ON COLUMN notes.version IS 'Version for optimistic locking';

-- Create trigger for updated_at
CREATE TRIGGER update_notes_updated_at
    BEFORE UPDATE ON notes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create trigger for version increment
CREATE OR REPLACE FUNCTION increment_version()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.content IS DISTINCT FROM NEW.content OR OLD.title IS DISTINCT FROM NEW.title THEN
        NEW.version = OLD.version + 1;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER increment_notes_version
    BEFORE UPDATE ON notes
    FOR EACH ROW
    EXECUTE FUNCTION increment_version();