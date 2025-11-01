-- Drop user statistics view
DROP VIEW IF EXISTS user_statistics;

-- Drop indexes
DROP INDEX IF EXISTS idx_user_sessions_last_seen;
DROP INDEX IF EXISTS idx_user_sessions_active;
DROP INDEX IF EXISTS idx_user_sessions_user_id;
DROP INDEX IF EXISTS idx_users_preferences_language;
DROP INDEX IF EXISTS idx_users_preferences_theme;

-- Remove updated_at column from user_sessions (if it was added)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_sessions' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE user_sessions DROP COLUMN updated_at;
    END IF;
END $$;

-- Remove preferences column from users table
ALTER TABLE users DROP COLUMN IF EXISTS preferences;