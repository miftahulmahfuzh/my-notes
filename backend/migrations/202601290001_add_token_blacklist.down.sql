-- Drop blacklisted_tokens table
DROP INDEX IF EXISTS idx_blacklisted_tokens_expires_at;
DROP INDEX IF EXISTS idx_blacklisted_tokens_token_id;
DROP TABLE IF EXISTS blacklisted_tokens;
