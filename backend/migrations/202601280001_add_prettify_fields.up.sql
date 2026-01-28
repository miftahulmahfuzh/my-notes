-- Add prettify tracking columns to notes table
ALTER TABLE notes ADD COLUMN prettified_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE notes ADD COLUMN ai_improved BOOLEAN NOT NULL DEFAULT FALSE;

-- Create index for prettified notes
CREATE INDEX idx_notes_prettified ON notes(prettified_at) WHERE prettified_at IS NOT NULL;
