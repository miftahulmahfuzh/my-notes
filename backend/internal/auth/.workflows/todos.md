# Todos: auth

**Package Path**: `backend/internal/auth`

**Package Code**: AU

**Last Updated**: 2026-01-30 10:40:00

**Total Active Tasks**: 0

## Quick Stats
- P0 Critical: 0
- P1 High: 0
- P2 Medium: 0
- P3 Low: 0
- P4 Backlog: 0
- Blocked: 0
- Completed: 7

---

## Active Tasks

### [P0] Critical
*No critical tasks*

### [P1] High
*No high priority tasks*

### [P2] Medium
*No medium priority tasks*

### [P3] Low
*No low priority tasks*

### [P4] Backlog
*No backlog tasks*

### [P0] Blocked
*No blocked tasks*

---

## Completed Tasks

### Recently Completed
- [x] **P2-AU-A003** Add package-level constant for "Bearer" token type
  - **Status**: WONTFIX
  - **Closed**: 2026-01-30 10:40:00
  - **Reason**: Low-value refactoring - "Bearer" is defined by RFC 6750 and will never change
  - **Analysis**:
    - "Bearer" is a protocol constant fixed by OAuth 2.0 / RFC 6750 standard
    - Only used in 2 places in the codebase
    - Typos would be caught immediately by client testing
    - Benefits of constant extraction are minimal for immutable standards
  - **When Constants ARE Worth It**:
    - ✓ App-specific strings (issuer, audience)
    - ✓ Magic numbers (timeouts, limits)
    - ✓ Error messages used in 10+ places
    - ✓ Strings with unclear meaning
  - **When Constants Are NOT Worth It**:
    - ✗ Protocol standards (HTTP methods, OAuth schemes)
    - ✗ One-time use strings
    - ✗ Values that can't change

- [x] **P2-AU-A002** Refactor duplicate code in GenerateTokenPair and GenerateTokenPairWithSession
  - **Completed**: 2026-01-30 10:35:00
  - **Method**: Extracted ~85% duplicate code (~50 lines) from GenerateTokenPair and GenerateTokenPairWithSession into private `generateTokenPair(user, sessionID)` helper function. Both public functions now delegate to the helper, eliminating code duplication while maintaining the same API surface.
  - **Files Modified**:
    - `backend/internal/auth/jwt.go` - added private generateTokenPair method (lines 63-118), simplified GenerateTokenPair (lines 121-122) and GenerateTokenPairWithSession (lines 125-126)
  - **Impact**: Removed ~50 lines of duplicate code, reduced maintenance burden, improved code organization
  - **Tests**: All passing (verified 2026-01-30)

### This Week
- [x] **P1-AU-A001** Add server-side refresh token tracking with token type enforcement
  - **Status**: WONTFIX
  - **Closed**: 2026-01-30 10:15:00
  - **Reason**: Not cost-effective for Cloud Run + Cloud SQL deployment
  - **Cost Analysis**:
    - Would require storing ~250K token records/day for 10K active users
    - DB read on EVERY API request to verify token type
    - Significant Cloud SQL cost and latency increase (10-50ms per request)
  - **Security Benefit**: Minimal - endpoint scoping already prevents token misuse
  - **Existing Protections**:
    - Token blacklist for logout (P1-AU-A000) ✓
    - JWT validation with issuer/audience checks ✓
    - Short-lived access tokens (1 hour) ✓
    - Auth middleware protecting endpoints ✓
  - **Note**: Token type tracking would prevent using refresh tokens as access tokens, but this is already mitigated by different expiration times and endpoint permissions

- [x] **P1-AU-A000** Implement token blacklist for proper logout functionality
  - **Completed**: 2026-01-29 11:20:30
  - **Method**: Implemented BlacklistService with database-backed token revocation. Logout handler adds tokens to blacklist using JTI claim. Token validation checks blacklist before accepting tokens. Includes periodic cleanup goroutine and comprehensive tests.
  - **Files Modified**:
    - `backend/internal/auth/jwt.go` - added BlacklistChecker interface and validation check
    - `backend/internal/handlers/auth.go` - added logout handler blacklist integration
    - `backend/internal/models/blacklist.go` - added BlacklistedToken model (18 lines)
    - `backend/internal/services/blacklist_service.go` - added blacklist operations (71 lines)
    - `backend/internal/server/server.go` - added initialization and cleanup goroutine
    - `backend/migrations/202601290001_add_token_blacklist.up.sql` - added database schema
    - `backend/migrations/202601290001_add_token_blacklist.down.sql` - added rollback
    - `backend/tests/token_blacklist_test.go` - added unit tests (292 lines)
    - `backend/tests/integration/logout_test.go` - added integration tests (254 lines)
    - `backend/internal/middleware/auth.go` - updated ValidateToken calls
    - `backend/internal/middleware/rate_limiting.go` - updated ValidateToken calls
    - `backend/internal/middleware/security.go` - updated ValidateToken calls
  - **Impact**: 12 files changed, 740 lines added, 13 lines removed. Tokens can now be properly revoked on logout, closing critical security vulnerability.
  - **Tests**: All passing (verified 2026-01-30)
  - **Commit**: 793be73

- [x] **P2-AU-A004** Remove unused Google OAuth implementation files
  - **Completed**: 2026-01-26 16:53:10
  - **Method**: Removed google_config.go (44 lines) and oauth_service.go (225 lines) that implemented standard OAuth flow with PKCE. Chrome extension uses Chrome Identity API instead.
  - **Files Modified**:
    - `backend/internal/auth/google_config.go` - deleted (44 lines)
    - `backend/internal/auth/oauth_service.go` - deleted (225 lines)
    - `backend/tests/auth/google_config_test.go` - deleted
    - `backend/tests/auth/oauth_service_test.go` - deleted
    - `backend/tests/auth/pkce_test.go` - deleted
    - `backend/go.mod` - removed oauth2 and validator dependencies
    - `backend/internal/server/server.go` - removed OAuth service initialization
  - **Impact**: Removed 269 lines of unused code, simplified authentication flow to Chrome Identity API only

- [x] **P2-AU-A005** Remove Name field from JWT Claims struct
  - **Completed**: 2026-01-26 11:37:48
  - **Method**: Removed Name field from Claims struct in jwt.go as user name is not needed for authentication.
  - **Files Modified**:
    - `backend/internal/auth/jwt.go` - removed Name field from Claims struct
  - **Impact**: Simplified JWT claims structure, reduced token size

- [x] **P2-AU-A006** Remove Name field from Google auth integration
  - **Completed**: 2026-01-26 11:34:21
  - **Method**: Removed Name field handling from Chrome authentication handler and related Google OAuth integration code.
  - **Files Modified**:
    - `backend/internal/handlers/chrome_auth.go` - removed Name field handling
  - **Impact**: Streamlined user information extraction from Google tokens

---

## Archive

### 2025-01
- P2-AUT-A002: Purge Stale Code and Implement Security Validations
- P0-AUT-A001: Implement Chrome Extension OAuth Authentication System
