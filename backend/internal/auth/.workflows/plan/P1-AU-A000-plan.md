# Implementation Plan: P1-AU-A000

**Task**: Implement token blacklist for proper logout functionality
**Difficulty**: HARD
**Branch**: feature/token-blacklist-P1-AU-A000
**Created**: 2026-01-29

## Analysis Phase

### Current State Assessment
The current authentication system has a critical security vulnerability:
- JWT tokens are stateless - once issued, they remain valid until expiration
- Logout handler (`handlers/auth.go:74-92`) cannot invalidate tokens server-side
- Refresh tokens have no server-side tracking
- Compromised tokens cannot be revoked before their natural expiration

### Current Architecture
```
Token Generation: TokenService.GenerateTokenPair() → JWT with expiration
Token Validation: TokenService.ValidateToken() → Signature + claims validation
Logout: AuthHandler.Logout() → No-op (TODO comment at line 84)
```

### Dependencies Identification
1. **Database**: Need to add token blacklist storage (PostgreSQL table + Redis cache)
2. **Models**: Need new BlacklistedToken model
3. **Services**: Need BlacklistService for token management
4. **Handlers**: Need to update Logout handler
5. **Middleware**: Need to check blacklist during token validation
6. **Configuration**: Need Redis client setup

### Risk Assessment
**Risk Level: High**
- Affects core authentication flow
- Requires database migration
- Requires new Redis dependency
- Must maintain backward compatibility with existing tokens
- Performance impact on every authenticated request

### Testing Strategy
1. Unit tests for BlacklistService operations
2. Integration tests for logout flow
3. Integration tests for token validation with blacklist
4. Tests for Redis cache behavior
5. Tests for database persistence
6. Performance tests for blacklist lookup

## Implementation Phases

### Phase 1: Database Schema
**Goal**: Add token blacklist storage

**Database Migration**:
```sql
CREATE TABLE blacklisted_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_id VARCHAR(255) NOT NULL UNIQUE, -- JWT JTI claim
    user_id UUID NOT NULL,
    session_id VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reason VARCHAR(50) DEFAULT 'logout', -- logout, revocation, security
    INDEX idx_token_id (token_id),
    INDEX idx_user_id (user_id),
    INDEX idx_expires_at (expires_at)
);

CREATE INDEX idx_blacklisted_tokens_expires_at ON blacklisted_tokens(expires_at);
```

**Files to Create**:
- `backend/migrations/XXX_add_token_blacklist.sql`

### Phase 2: Models
**Goal**: Add BlacklistedToken model

**Files to Modify**:
- `backend/internal/models/blacklist.go` (new file)

**Model Structure**:
```go
type BlacklistedToken struct {
    ID        uuid.UUID
    TokenID   string    // JWT JTI
    UserID    uuid.UUID
    SessionID string
    ExpiresAt time.Time
    CreatedAt time.Time
    Reason    string
}
```

### Phase 3: Blacklist Service
**Goal**: Create service for token blacklist operations

**Files to Create**:
- `backend/internal/services/blacklist_service.go`

**Service Methods**:
- `AddToken(tokenID, userID, sessionID string, expiresAt time.Time, reason string) error`
- `IsTokenBlacklisted(tokenID string) (bool, error)`
- `BlacklistUserSession(userID, sessionID string) error` - blacklist all tokens in session
- `CleanupExpiredTokens() error` - periodic cleanup job

**Redis Integration**:
- Use Redis for fast blacklist lookup (cache)
- Use PostgreSQL for persistence
- TTL = token expiration time

### Phase 4: Update TokenService
**Goal**: Add blacklist validation to token validation

**Files to Modify**:
- `backend/internal/auth/jwt.go`

**Changes**:
1. Add BlacklistService dependency to TokenService
2. Update `ValidateToken()` to check blacklist
3. Update `ValidateRefreshToken()` to check blacklist
4. Add `InvalidateToken(tokenID string)` method

**Implementation Details**:
```go
func (s *TokenService) ValidateToken(tokenString string) (*Claims, error) {
    // ... existing parsing and validation ...

    // Check if token is blacklisted
    if s.blacklistService != nil {
        if blacklisted, err := s.blacklistService.IsTokenBlacklisted(claims.ID); err == nil && blacklisted {
            return nil, fmt.Errorf("token has been revoked")
        }
    }

    return claims, nil
}
```

### Phase 5: Update Logout Handler
**Goal**: Implement proper logout with token invalidation

**Files to Modify**:
- `backend/internal/handlers/auth.go`

**Changes**:
1. Add BlacklistService to AuthHandler
2. Extract token from Authorization header
3. Parse token to get JTI (token ID)
4. Add token to blacklist
5. Optionally blacklist entire session

**Implementation Details**:
```go
func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
    // Get user from context
    user, ok := r.Context().Value("user").(*models.User)
    if !ok {
        respondWithError(w, http.StatusUnauthorized, "User not authenticated")
        return
    }

    // Get claims from context
    claims, ok := r.Context().Value("claims").(*auth.Claims)
    if !ok {
        respondWithError(w, http.StatusUnauthorized, "Invalid token claims")
        return
    }

    // Blacklist the current token
    expiresAt := claims.ExpiresAt.Time
    err := h.blacklistService.AddToken(claims.ID, user.ID.String(), claims.SessionID, expiresAt, "logout")
    if err != nil {
        respondWithError(w, http.StatusInternalServerError, "Failed to invalidate token")
        return
    }

    respondWithJSON(w, http.StatusOK, map[string]string{
        "message": "Successfully logged out",
    })
}
```

### Phase 6: Update Service Initialization
**Goal**: Wire up new dependencies

**Files to Modify**:
- `backend/internal/server/server.go`

**Changes**:
1. Add Redis client initialization
2. Create BlacklistService instance
3. Pass BlacklistService to TokenService
4. Pass BlacklistService to AuthHandler
5. Start periodic cleanup goroutine

### Phase 7: Tests
**Goal**: Comprehensive test coverage

**Files to Create**:
- `backend/tests/services/blacklist_service_test.go`
- `backend/tests/handlers/logout_test.go`
- `backend/tests/auth/token_blacklist_test.go`

**Test Cases**:
1. Add token to blacklist
2. Check if token is blacklisted
3. Validate blacklisted token (should fail)
4. Logout flow (token added to blacklist)
5. Blacklist all tokens in session
6. Expired token cleanup
7. Redis cache behavior
8. Database persistence

## Rollback Strategy

### Safe Rollback Points
1. **After Phase 1**: Database migration can be rolled back with down migration
2. **After Phase 2**: New model file can be deleted
3. **After Phase 3**: BlacklistService can be removed from initialization
4. **After Phase 4**: TokenService can be reverted to previous version
5. **After Phase 5**: Logout handler can be reverted to no-op
6. **After Phase 6**: Service initialization can be reverted
7. **After Phase 7**: Tests can be deleted

### Rollback Procedure
```bash
# 1. Revert branch
git checkout main

# 2. If merged, create revert commit
git revert -m 1 <merge-commit-hash>

# 3. Rollback database migration
go run backend/migrations/down.go XXX_add_token_blacklist.sql

# 4. Flush Redis
redis-cli FLUSHDB
```

### Mitigation Strategies
- Feature flag for blacklist checking (can be disabled if issues arise)
- Graceful degradation if Redis is unavailable (fallback to DB only)
- Monitoring for performance impact
- Gradual rollout with environment variables

## Success Criteria

### Functional Requirements
- [ ] Logout adds token to blacklist
- [ ] Blacklisted tokens fail validation
- [ ] Refresh tokens can be blacklisted
- [ ] Entire sessions can be revoked
- [ ] Expired tokens are automatically cleaned up

### Performance Requirements
- [ ] Blacklist check adds <5ms to request latency
- [ ] Redis cache hit rate >95%
- [ ] Database query time <10ms for blacklist check

### Security Requirements
- [ ] Tokens cannot be used after logout
- [ ] Compromised tokens can be revoked
- [ ] Session revocation works correctly
- [ ] Blacklist is persistent across restarts

### Testing Requirements
- [ ] Unit tests for BlacklistService
- [ ] Integration tests for logout flow
- [ ] Integration tests for token validation
- [ ] Performance benchmarks
- [ ] >90% code coverage for new code

## Implementation Notes

### Design Decisions
1. **Redis + PostgreSQL**: Redis for speed, PostgreSQL for persistence
2. **JTI-based**: Use JWT ID claim for blacklist identification
3. **TTL-based**: Tokens auto-remove from blacklist when they expire
4. **Session-level**: Can revoke entire session (all tokens for session)

### Configuration Required
```bash
# New environment variables
REDIS_URL=redis://localhost:6379/0
BLACKLIST_CLEANUP_INTERVAL=1h
BLACKLIST_CACHE_TTL=24h
```

### Migration Strategy
1. Deploy database migration
2. Deploy code changes with feature flag disabled
3. Enable feature flag for testing
4. Monitor for issues
5. Full rollout
6. Remove feature flag after validation period
