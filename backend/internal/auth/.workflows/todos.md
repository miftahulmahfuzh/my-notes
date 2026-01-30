# Todos: auth

**Package Path**: `backend/internal/auth`

**Package Code**: AU

**Last Updated**: 2026-01-30 10:15:00

**Total Active Tasks**: 2

## Quick Stats
- P0 Critical: 0
- P1 High: 0
- P2 Medium: 2
- P3 Low: 0
- P4 Backlog: 0
- Blocked: 0
- Completed: 5

---

## Active Tasks

### [P0] Critical
*No critical tasks*

### [P1] High
*No high priority tasks*

### [P2] Medium
- [ ] **P2-AU-A002** Refactor duplicate code in GenerateTokenPair and GenerateTokenPairWithSession
  - **Difficulty**: NORMAL
  - **Context**: Two functions share ~85% identical logic (~50 lines of duplicate token generation code). Extract to private `generateTokenPair(user, sessionID)` helper function.
  - **Identified**: 2026-01-29
  - **Related**: analysis_report.md - Refactoring Opportunities
  - **Location**: jwt.go:51-107, jwt.go:110-165
  - **Status**: active

- [ ] **P2-AU-A003** Add package-level constant for "Bearer" token type
  - **Difficulty**: EASY
  - **Context**: `TokenType: "Bearer"` is hardcoded in two places (jwt.go:104, jwt.go:162). Extract to `const TokenTypeBearer = "Bearer"`.
  - **Identified**: 2026-01-29
  - **Related**: analysis_report.md - Hardcoded String Literal
  - **Location**: jwt.go:104, jwt.go:162
  - **Status**: active

### [P3] Low
*No low priority tasks*

### [P4] Backlog
*No backlog tasks*

### [P0] Blocked
*No blocked tasks*

---

## Completed Tasks

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
