-- Add user preferences to users table
ALTER TABLE users
ADD COLUMN preferences JSONB DEFAULT '{
    "theme": "light",
    "language": "en",
    "timezone": "UTC",
    "email_notifications": true,
    "auto_save": true,
    "default_note_view": "grid"
}'::jsonb NOT NULL;

-- Create index on preferences for faster queries
CREATE INDEX idx_users_preferences_theme ON users USING GIN ((preferences->'theme'));
CREATE INDEX idx_users_preferences_language ON users USING GIN ((preferences->'language'));

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

-- Create indexes for user sessions
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_active ON user_sessions(is_active) WHERE is_active = true;
CREATE INDEX idx_user_sessions_last_seen ON user_sessions(last_seen DESC);

-- Add user statistics view (optional, for analytics)
CREATE OR REPLACE VIEW user_statistics AS
SELECT
    u.id,
    u.name,
    u.email,
    u.created_at as account_created_at,
    COUNT(DISTINCT s.id) as total_sessions,
    COUNT(DISTINCT CASE WHEN s.is_active = true THEN s.id END) as active_sessions,
    MAX(s.last_seen) as last_login_at,
    EXTRACT(DAYS FROM CURRENT_TIMESTAMP - u.created_at) as account_age_days
FROM users u
LEFT JOIN user_sessions s ON u.id = s.user_id
GROUP BY u.id, u.name, u.email, u.created_at;

-- Add comments for documentation
COMMENT ON COLUMN users.preferences IS 'User preferences stored as JSONB including theme, language, timezone, notifications settings';
COMMENT ON COLUMN user_sessions.updated_at IS 'Last time the session record was updated';
COMMENT ON TABLE user_statistics IS 'Aggregated user statistics for analytics and reporting';