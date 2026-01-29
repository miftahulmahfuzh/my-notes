package services

import (
	"context"
	"database/sql"
	"fmt"
	"time"
)

// BlacklistService manages token blacklist operations
type BlacklistService struct {
	db *sql.DB
}

// NewBlacklistService creates a new BlacklistService
func NewBlacklistService(db *sql.DB) *BlacklistService {
	return &BlacklistService{db: db}
}

// AddToken adds a token to the blacklist
func (s *BlacklistService) AddToken(ctx context.Context, tokenID, userID, sessionID string, expiresAt time.Time, reason string) error {
	query := `
		INSERT INTO blacklisted_tokens (token_id, user_id, session_id, expires_at, reason)
		VALUES ($1, $2, $3, $4, $5)
	`
	_, err := s.db.ExecContext(ctx, query, tokenID, userID, sessionID, expiresAt, reason)
	if err != nil {
		return fmt.Errorf("failed to add token to blacklist: %w", err)
	}
	return nil
}

// IsTokenBlacklisted checks if a token is blacklisted
func (s *BlacklistService) IsTokenBlacklisted(ctx context.Context, tokenID string) (bool, error) {
	query := `
		SELECT 1 FROM blacklisted_tokens
		WHERE token_id = $1 AND expires_at > NOW()
		LIMIT 1
	`
	var exists int
	err := s.db.QueryRowContext(ctx, query, tokenID).Scan(&exists)
	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("failed to check blacklist: %w", err)
	}
	return true, nil
}

// BlacklistSession blacklists all tokens for a specific session
func (s *BlacklistService) BlacklistSession(ctx context.Context, userID, sessionID string) error {
	// This is a placeholder for future enhancement
	// To implement this, we would need to track issued tokens in the database
	return fmt.Errorf("session revocation not yet implemented - requires tracking issued tokens")
}

// CleanupExpiredTokens removes entries for tokens that have expired
func (s *BlacklistService) CleanupExpiredTokens(ctx context.Context) (int64, error) {
	query := `
		DELETE FROM blacklisted_tokens
		WHERE expires_at <= NOW()
	`
	result, err := s.db.ExecContext(ctx, query)
	if err != nil {
		return 0, fmt.Errorf("failed to cleanup expired tokens: %w", err)
	}

	rows, _ := result.RowsAffected()
	return rows, nil
}
