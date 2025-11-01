-- Drop indexes
DROP INDEX IF EXISTS idx_token_blacklist_expires_at;
DROP INDEX IF EXISTS idx_token_blacklist_token_id;
DROP INDEX IF EXISTS idx_user_sessions_last_seen;
DROP INDEX IF EXISTS idx_user_sessions_active;
DROP INDEX IF EXISTS idx_user_sessions_user_id;

-- Drop tables
DROP TABLE IF EXISTS token_blacklist;
DROP TABLE IF EXISTS user_sessions;

-- Note: We keep the preferences column in users table as it might be used by other features