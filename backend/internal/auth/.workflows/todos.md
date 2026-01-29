# Todos: auth

**Package Path**: `backend/internal/auth`

**Package Code**: AU

**Last Updated**: 2026-01-29 15:30:00

**Total Active Tasks**: 4

## Quick Stats
- P0 Critical: 0
- P1 High: 2
- P2 Medium: 2
- P3 Low: 0
- P4 Backlog: 0
- Blocked: 0
- Completed: 3

---

## Active Tasks

### [P0] Critical
*No critical tasks*

### [P1] High
- [ ] **P1-AU-A000** Implement token blacklist for proper logout functionality
  - **Difficulty**: HARD
  - **Context**: Logout handler cannot invalidate JWT tokens server-side. Refresh tokens have no server-side tracking, enabling compromised tokens to remain valid until expiration.
  - **Identified**: 2026-01-29
  - **Related**: analysis_report.md - Security Notes - Potential Concerns
  - **Status**: active
  - **Impact**: Critical security vulnerability - compromised tokens cannot be revoked

- [ ] **P1-AU-A001** Add server-side refresh token tracking with token type enforcement
  - **Difficulty**: HARD
  - **Context**: ValidateRefreshToken comment (jwt.go:204-206) indicates token type is not tracked server-side. Need database schema for refresh tokens with token type column and revocation status.
  - **Identified**: 2026-01-29
  - **Related**: analysis_report.md - Validation Comment Mismatch, Security Notes
  - **Status**: active
  - **Impact**: Cannot distinguish access tokens from refresh tokens during validation, security risk

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
