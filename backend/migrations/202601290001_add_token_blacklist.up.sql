-- Create blacklisted_tokens table for token revocation
CREATE TABLE blacklisted_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_id VARCHAR(255) NOT NULL UNIQUE,
    user_id UUID NOT NULL,
    session_id VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reason VARCHAR(50) DEFAULT 'logout'
);

-- Index for fast token lookups
CREATE INDEX idx_blacklisted_tokens_token_id ON blacklisted_tokens(token_id);

-- Index for cleanup queries
CREATE INDEX idx_blacklisted_tokens_expires_at ON blacklisted_tokens(expires_at);
