package models

import (
	"time"

	"github.com/google/uuid"
)

// BlacklistedToken represents a token that has been revoked
type BlacklistedToken struct {
	ID        uuid.UUID
	TokenID   string    // JWT JTI claim
	UserID    uuid.UUID
	SessionID string
	ExpiresAt time.Time
	CreatedAt time.Time
	Reason    string
}
