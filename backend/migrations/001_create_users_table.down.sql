-- Drop trigger
DROP TRIGGER IF EXISTS update_users_updated_at ON users;

-- Drop indexes
DROP INDEX IF EXISTS idx_users_google_id;
DROP INDEX IF EXISTS idx_users_email;
DROP INDEX IF EXISTS idx_users_created_at;

-- Drop table
DROP TABLE IF EXISTS users;