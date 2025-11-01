-- Create note_tags junction table
CREATE TABLE note_tags (
    note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (note_id, tag_id)
);

-- Create indexes for performance
CREATE INDEX idx_note_tags_note_id ON note_tags(note_id);
CREATE INDEX idx_note_tags_tag_id ON note_tags(tag_id);
CREATE INDEX idx_note_tags_created_at ON note_tags(created_at);

-- Add comments
COMMENT ON TABLE note_tags IS 'Junction table for many-to-many relationship between notes and tags';
COMMENT ON COLUMN note_tags.note_id IS 'Foreign key to notes table';
COMMENT ON COLUMN note_tags.tag_id IS 'Foreign key to tags table';
COMMENT ON COLUMN note_tags.created_at IS 'Timestamp when tag was added to note';

-- Create function to find notes by tags
CREATE OR REPLACE FUNCTION find_notes_by_tags(tag_names TEXT[])
RETURNS TABLE(note_id UUID, note_title VARCHAR, note_content TEXT, note_created_at TIMESTAMP WITH TIME ZONE) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT
        n.id,
        n.title,
        n.content,
        n.created_at
    FROM notes n
    JOIN note_tags nt ON n.id = nt.note_id
    JOIN tags t ON nt.tag_id = t.id
    WHERE t.name = ANY(tag_names)
    ORDER BY n.created_at DESC;
END;
$$ LANGUAGE plpgsql;