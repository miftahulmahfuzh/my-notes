# Token Blacklist Design Document

**Date**: 2026-01-29
**Author**: Design discussion with user
**Status**: Approved for Implementation
**Task**: P1-AU-A000

## Problem Statement

### The Security Issue

The current authentication system has a critical security vulnerability: **JWT tokens cannot be revoked server-side**.

**How it works now:**
- JWT tokens are stateless - once issued, they remain valid until their natural expiration
- Access tokens expire after 1 hour, refresh tokens after 7 days
- When a user logs out, the server says "bye!" but cannot invalidate their tokens

**Why this matters:**
- If an attacker steals a user's refresh token (via XSS, network sniffing, etc.), they can keep generating new access tokens for up to 7 days
- Even if the real user logs out, the attacker's stolen token still works
- There is no way to "revoke" a compromised token

**Real-world analogy:**
It's like giving someone a hotel key card that works for 7 days. If they lose it or it gets stolen, you can't invalidate it - anyone who finds it can enter the room until the 7 days are up.

## Solution: Database-Only Token Blacklist

### Chosen Approach

**Database-only token blacklist** - no new infrastructure services required.

**Why this approach:**
- Uses existing Cloud SQL - no additional cost
- Good enough security for a personal note-taking app
- Relatively simple to implement and maintain
- Persistent across restarts

### Trade-offs Considered

| Approach | Pros | Cons | Cost |
|----------|------|------|------|
| **Database Blacklist (chosen)** | No new services, persistent, simple | Adds ~5-10ms per request | $0 |
| Short-lived tokens + rotate | Smaller exposure window | More token refreshes | $0 |
| Do nothing | Zero work | Security vulnerability remains | $0 |
| Redis + Database | Fastest lookups | Additional service cost | ~$30-50/mo |

## Architecture

### Data Flow

```
1. User logs in → GenerateTokenPair() → returns JWT with unique JTI
2. User makes API request → ValidateToken() → checks blacklist → allows/denies
3. User clicks logout → Logout() → adds JTI to blacklist
4. Attacker tries using stolen token → ValidateToken() → sees JTI in blacklist → rejects
5. Hourly cleanup job → removes expired entries from blacklist
```

### Component Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   AuthHandler   │────▶│ TokenService    │────▶│ BlacklistService│
│                 │     │                 │     │                 │
│ - Logout()      │     │ - ValidateToken()│     │ - AddToken()    │
│                 │     │                 │     │ - IsTokenBlacklisted()│
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                           │
                                                           ▼
                                                  ┌─────────────────┐
                                                  │   PostgreSQL    │
                                                  │                 │
                                                  │blacklisted_tokens│
                                                  └─────────────────┘
```

## Implementation Details

### 1. Database Schema

**Table: `blacklisted_tokens`**

```sql
CREATE TABLE blacklisted_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_id VARCHAR(255) NOT NULL UNIQUE,     -- The JWT's JTI claim
    user_id UUID NOT NULL,                     -- Who owns the token
    session_id VARCHAR(255) NOT NULL,          -- Which session
    expires_at TIMESTAMP NOT NULL,             -- When JWT naturally expires
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reason VARCHAR(50) DEFAULT 'logout'        -- logout, revocation, etc.
);

-- Indexes for fast lookups
CREATE INDEX idx_blacklisted_tokens_token_id ON blacklisted_tokens(token_id);
CREATE INDEX idx_blacklisted_tokens_expires_at ON blacklisted_tokens(expires_at);
```

**Design notes:**
- `token_id` is UNIQUE so we can't blacklist the same token twice
- Index on `token_id` makes lookups O(log n) - very fast
- `expires_at` is copied from the JWT itself - no need to track it separately
- `reason` field allows for future extensions (e.g., "security_revocation", "password_change")

**Migration file:** `backend/migrations/XXX_add_token_blacklist.sql`

### 2. Models

**File:** `backend/internal/models/blacklist.go` (new file)

```go
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
```

### 3. BlacklistService

**File:** `backend/internal/services/blacklist_service.go` (new file)

```go
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
    query := `
        INSERT INTO blacklisted_tokens (token_id, user_id, session_id, expires_at, reason)
        SELECT token_id, $1, $2, expires_at, 'session_revocation'
        FROM (
            -- This would need to be populated by tracking issued tokens
            -- For now, this is a placeholder for future enhancement
        ) AS tokens
    `
    // TODO: Implement session revocation once we track issued tokens
    return fmt.Errorf("session revocation not yet implemented")
}

// CleanupExpiredTokens removes entries for tokens that have expired
func (s *BlacklistService) CleanupExpiredTokens(ctx context.Context) error {
    query := `
        DELETE FROM blacklisted_tokens
        WHERE expires_at <= NOW()
    `
    result, err := s.db.ExecContext(ctx, query)
    if err != nil {
        return fmt.Errorf("failed to cleanup expired tokens: %w", err)
    }

    rows, _ := result.RowsAffected()
    // Log cleanup results
    return nil
}
```

### 4. Update TokenService

**File:** `backend/internal/auth/jwt.go` (modify existing file)

**Changes:**

1. Add `BlacklistChecker` interface:
```go
// BlacklistChecker checks if a token has been revoked
type BlacklistChecker interface {
    IsTokenBlacklisted(ctx context.Context, tokenID string) (bool, error)
}
```

2. Add blacklist field to `TokenService`:
```go
type TokenService struct {
    secretKey     []byte
    accessExpiry  time.Duration
    refreshExpiry time.Duration
    issuer        string
    audience      string
    blacklist     BlacklistChecker  // New: optional blacklist checker
}
```

3. Add setter method:
```go
// SetBlacklist sets the blacklist checker
func (s *TokenService) SetBlacklist(blacklist BlacklistChecker) {
    s.blacklist = blacklist
}
```

4. Update `ValidateToken` to accept context and check blacklist:
```go
// ValidateToken validates a JWT token and returns the claims
func (s *TokenService) ValidateToken(ctx context.Context, tokenString string) (*Claims, error) {
    token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
        if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
            return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
        }
        return s.secretKey, nil
    })

    if err != nil {
        return nil, fmt.Errorf("failed to parse token: %w", err)
    }

    claims, ok := token.Claims.(*Claims)
    if !ok || !token.Valid {
        return nil, fmt.Errorf("invalid token claims")
    }

    // Additional validation
    if claims.Issuer != s.issuer {
        return nil, fmt.Errorf("invalid token issuer")
    }

    if claims.Audience != s.audience {
        return nil, fmt.Errorf("invalid token audience")
    }

    // NEW: Check if token is blacklisted
    if s.blacklist != nil {
        if blacklisted, err := s.blacklist.IsTokenBlacklisted(ctx, claims.ID); err == nil && blacklisted {
            return nil, fmt.Errorf("token has been revoked")
        }
    }

    return claims, nil
}
```

**Note:** The `context.Context` parameter is new. Existing callers will need to pass `context.Background()` or `r.Context()`.

### 5. Update Logout Handler

**File:** `backend/internal/handlers/auth.go` (modify existing file)

**Changes:**

1. Add `BlacklistAdder` interface:
```go
// BlacklistAdder adds tokens to the blacklist
type BlacklistAdder interface {
    AddToken(ctx context.Context, tokenID, userID, sessionID string, expiresAt time.Time, reason string) error
}
```

2. Add blacklist field to `AuthHandler`:
```go
type AuthHandler struct {
    tokenService *auth.TokenService
    userService  services.UserServiceInterface
    blacklist    BlacklistAdder  // New: optional blacklist adder
}
```

3. Add setter method:
```go
// SetBlacklist sets the blacklist adder
func (h *AuthHandler) SetBlacklist(blacklist BlacklistAdder) {
    h.blacklist = blacklist
}
```

4. Update `Logout` handler:
```go
// Logout handles POST /api/v1/auth/logout
func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
    // Get user from context (set by auth middleware)
    user, ok := r.Context().Value("user").(*models.User)
    if !ok {
        respondWithError(w, http.StatusUnauthorized, "User not authenticated")
        return
    }

    // Get claims from context (set by auth middleware)
    claims, ok := r.Context().Value("claims").(*auth.Claims)
    if !ok {
        respondWithError(w, http.StatusUnauthorized, "Invalid token claims")
        return
    }

    // Add the current token to the blacklist
    if h.blacklist != nil {
        expiresAt := claims.ExpiresAt.Time
        err := h.blacklist.AddToken(r.Context(), claims.ID, user.ID.String(), claims.SessionID, expiresAt, "logout")
        if err != nil {
            // Log error but don't fail - user is still logged out from client perspective
            // The token will expire naturally
            log.Printf("WARNING: failed to blacklist token during logout: %v", err)
        }
    }

    respondWithJSON(w, http.StatusOK, map[string]string{
        "message": "Successfully logged out",
    })
}
```

**Import needed:** `"log"` for the warning log.

### 6. Update Server Initialization

**File:** `backend/internal/server/server.go` (modify existing file)

**Changes:**

1. Create `BlacklistService`:
```go
blacklistSvc := services.NewBlacklistService(db)
```

2. Pass blacklist to `TokenService`:
```go
tokenService := auth.NewTokenService(
    jwtSecret,
    1*time.Hour,
    24*7*time.Hour,
    "silence-notes",
    "silence-notes-users",
)
tokenService.SetBlacklist(blacklistSvc)
```

3. Pass blacklist to `AuthHandler`:
```go
authHandler := handlers.NewAuthHandler(tokenService, userService)
authHandler.SetBlacklist(blacklistSvc)
```

4. Add background cleanup goroutine:
```go
// Start blacklist cleanup goroutine
go blacklistCleanupLoop(blacklistSvc, 1*time.Hour)
```

5. Add cleanup function (new):
```go
// blacklistCleanupLoop runs periodic cleanup of expired blacklist entries
func blacklistCleanupLoop(svc *services.BlacklistService, interval time.Duration) {
    ticker := time.NewTicker(interval)
    defer ticker.Stop()

    for range ticker.C {
        ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
        if err := svc.CleanupExpiredTokens(ctx); err != nil {
            log.Printf("ERROR: failed to cleanup expired tokens: %v", err)
        }
        cancel()
    }
}
```

**Import needed:** `"context"` if not already imported.

### 7. Update Middleware

**File:** `backend/internal/middleware/auth.go` (modify existing file)

The `ValidateToken` signature change requires updating the middleware:

```go
func (m *AuthMiddleware) authMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        authHeader := r.Header.Get("Authorization")
        // ... existing token extraction logic ...

        // UPDATED: Pass context to ValidateToken
        claims, err := m.tokenService.ValidateToken(r.Context(), tokenString)
        if err != nil {
            respondWithError(w, http.StatusUnauthorized, "Invalid token")
            return
        }
        // ... rest of existing logic ...
    })
}
```

## Testing Strategy

### Unit Tests

**File:** `backend/tests/services/blacklist_service_test.go` (new file)

Test cases:
- `TestAddToken` - Adding a token to blacklist succeeds
- `TestIsTokenBlacklisted` - Blacklisted token returns true
- `TestIsTokenBlacklisted_NotFound` - Non-blacklisted token returns false
- `TestIsTokenBlacklisted_Expired` - Expired token returns false
- `TestAddToken_Duplicate` - Adding same token twice handles duplicate key error
- `TestCleanupExpiredTokens` - Removes expired entries

### Integration Tests

**File:** `backend/tests/handlers/logout_test.go` (new file)

Test cases:
- `TestLogout_Success` - Logout adds token to blacklist
- `TestLogout_BlacklistedTokenRejected` - Blacklisted token fails validation
- `TestLogout_InvalidClaims` - Returns 401 for invalid claims

**File:** `backend/tests/auth/token_blacklist_test.go` (new file)

Test cases:
- `TestValidateToken_Blacklisted` - Blacklisted token returns error
- `TestValidateToken_NotBlacklisted` - Normal token validates successfully
- `TestValidateRefreshToken_Blacklisted` - Blacklisted refresh token fails validation

### Test Setup

- Use existing test database pattern
- Mock `BlacklistChecker` for TokenService unit tests
- Real `BlacklistService` for integration tests
- Cleanup database after each test

## Performance Considerations

### Expected Impact

- **Latency**: ~5-10ms per authenticated request (single indexed query)
- **Database load**: 1 additional query per request
- **Storage**: Minimal - one row per blacklisted token (~100 bytes each)
- **Cleanup**: Low - runs hourly in background

### Optimization Notes

- Indexed query on `token_id` ensures fast lookups
- Cleanup runs in background so it doesn't affect request latency
- Cleanup has timeout to prevent runaway queries
- No Redis needed - PostgreSQL is fast enough for this use case

## Security Considerations

### What This Solves

- ✅ Users can properly log out (tokens are invalidated)
- ✅ Compromised tokens can be revoked
- ✅ Session revocation is possible (future enhancement)

### What This Doesn't Solve

- ❌ Does not prevent token theft in the first place
- ❌ Does not protect against XSS attacks that steal tokens
- ❌ Access tokens remain valid for their lifetime (1 hour) after logout

### Best Practices

- Always use HTTPS to prevent token sniffing
- Implement proper XSS protection in the Chrome extension
- Consider shortening access token lifetime for higher security
- Implement rate limiting on auth endpoints

## Rollback Plan

If issues arise after deployment:

1. **Feature flag approach** - Add environment variable to disable blacklist checking
2. **Graceful degradation** - Blacklist errors should not prevent normal operation
3. **Revert changes** - Rollback to previous code version
4. **Database** - Keep the table (harmless) or drop it

## Success Criteria

- [ ] Logout adds token to blacklist
- [ ] Blacklisted tokens fail validation with "token has been revoked" error
- [ ] Integration tests pass
- [ ] Unit tests pass with >90% coverage
- [ ] No significant performance degradation
- [ ] Cleanup job runs without errors

## Implementation Checklist

1. Create database migration (`XXX_add_token_blacklist.sql`)
2. Run migration
3. Create `BlacklistedToken` model
4. Create `BlacklistService`
5. Update `TokenService` with blacklist checking
6. Update `AuthHandler` logout method
7. Update server initialization
8. Update middleware to pass context
9. Write unit tests
10. Write integration tests
11. Run all tests
12. Deploy to development environment
13. Test manually
14. Deploy to production

## References

- Task: P1-AU-A000
- Analysis Report: `backend/internal/auth/.workflows/analysis_report.md`
- Implementation Plan: `backend/internal/auth/.workflows/plan/P1-AU-A000-plan.md`
