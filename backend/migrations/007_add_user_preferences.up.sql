-- Add preferences column to users table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'preferences'
    ) THEN
        ALTER TABLE users
        ADD COLUMN preferences JSONB DEFAULT '{
            "theme": "light",
            "language": "en",
            "timezone": "UTC",
            "email_notifications": true,
            "auto_save": true,
            "default_note_view": "grid"
        }'::jsonb NOT NULL;
    END IF;
END $$;

-- Create index on preferences for faster queries
CREATE INDEX IF NOT EXISTS idx_users_preferences_theme ON users USING GIN ((preferences->'theme'));
CREATE INDEX IF NOT EXISTS idx_users_preferences_language ON users USING GIN ((preferences->'language'));

-- Add updated_at timestamp to user_sessions if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_sessions' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE user_sessions ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- Create optimized indexes for user sessions
CREATE INDEX IF NOT EXISTS idx_user_sessions_active_partial ON user_sessions(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_sessions_last_seen_desc ON user_sessions(last_seen DESC);

-- Add comments for documentation
COMMENT ON COLUMN users.preferences IS 'User preferences stored as JSONB including theme, language, timezone, notifications settings';
COMMENT ON COLUMN user_sessions.updated_at IS 'Last time the session record was updated';