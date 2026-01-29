# Analysis Report: auth
Generated: 2026-01-29

## Summary
- Total Functions: 9 (5 exported, 4 unexported)
- Exported Types: 5
- Complexity Score: 2.2 (avg cyclomatic complexity)
- Dead Code Candidates: 0
- Files Analyzed: 2 (jwt.go: 226 lines, google_user.go: 27 lines)

## Critical Issues
None identified. This is a well-structured, security-focused package with low complexity.

## Refactoring Opportunities

### Medium Priority
1. **Duplicate Code in Token Generation** (jwt.go:51-107, jwt.go:110-165)
   - `GenerateTokenPair` and `GenerateTokenPairWithSession` share ~85% identical logic
   - Consider refactoring to a private `generateTokenPair(user, sessionID)` function
   - Current duplication: ~50 lines of similar token generation code

### Low Priority
2. **Hardcoded String Literal** (jwt.go:104)
   - `TokenType: "Bearer"` is hardcoded in two places
   - Consider a package-level constant `const TokenTypeBearer = "Bearer"`

3. **Validation Comment Mismatch** (jwt.go:204-206)
   - Comment mentions "might want to check if this token ID has been marked as a refresh token"
   - This indicates incomplete implementation - token type tracking is not enforced

## Performance Notes

### Allocation Patterns
- **Moderate allocations during token generation**: Creates JWT structures, claims objects, and signed strings
- **No caching**: Tokens are validated on each request (intentional for security)
- **UUID generation**: Each token generation calls `uuid.New()` multiple times (for JTI and session ID)

### Optimization Opportunities
1. **Token string builders**: Could use strings.Builder for more efficient string concatenation in error messages
2. **HMAC key as []byte**: Secret key is converted from string to []byte at initialization (good practice)

## API Surface Review

### Exported and Actively Used
All exported symbols are actively consumed:

**Types:**
- `TokenService` - Used in 5 packages (middleware/auth, middleware/security, middleware/rate_limiting, handlers/auth, handlers/chrome_auth, server)
- `Claims` - Used in middleware/auth, middleware/security, handlers/auth for context values
- `TokenPair` - Used in handlers/auth, handlers/chrome_auth
- `RefreshTokenRequest` - Used in handlers/auth
- `GoogleUserInfo` - Used in handlers/chrome_auth, services/user_service

**Functions:**
- `NewTokenService` - Used in server/server.go:65

**Methods:**
- `TokenService.GenerateTokenPair` - Used in handlers/auth, handlers/chrome_auth
- `TokenService.GenerateTokenPairWithSession` - Used in handlers/chrome_auth for Chrome extension session reuse
- `TokenService.ValidateToken` - Used in middleware/auth, middleware/security, middleware/rate_limiting, handlers/auth
- `TokenService.ValidateRefreshToken` - Used in handlers/auth

### Exported but Unused
**None** - All exported symbols have consumers.

### Should Be Exported (Internal Functions)
- `generateTokenID()` (jwt.go:211) - Not used externally, correctly unexported

## Detailed Findings

### Function Analysis

| Function | Lines | Complexity | Nesting | Notes |
|----------|-------|------------|---------|-------|
| `NewTokenService` | 8 | 1 | 1 | Simple constructor |
| `TokenService.GenerateTokenPair` | 56 | 2 | 2 | Moderate length, clear logic |
| `TokenService.GenerateTokenPairWithSession` | 55 | 2 | 2 | Duplicates most of GenerateTokenPair |
| `TokenService.ValidateToken` | 27 | 4 | 2 | Most complex function, handles validation |
| `TokenService.ValidateRefreshToken` | 9 | 2 | 1 | Wrapper with TODO comment |
| `generateTokenID` | 2 | 1 | 1 | Simple wrapper around uuid.New |
| `GoogleUserInfo.Validate` | 8 | 2 | 1 | Simple validation |
| `RefreshTokenRequest.Validate` | 5 | 2 | 1 | Simple validation |

### Error Handling Audit
**Status: Good**
- All errors are wrapped with `fmt.Errorf` using `%w` verb for error chain preservation
- No ignored errors (no `_` assignments for error returns)
- No intentional panics
- Error messages provide context (e.g., "failed to sign access token", "invalid token issuer")

### Concurrency Risks
**Status: Safe**
- No goroutines spawned in this package
- No shared mutable state
- `TokenService` fields are read-only after initialization
- Thread-safe for concurrent use (documented in package_readme.md)

### Code Quality Issues

#### Magic Numbers
- None significant. Duration values are passed as parameters to `NewTokenService`

#### Missing Documentation
- `generateTokenID()` - Unexported helper, could benefit from a comment explaining JTI purpose
- Exported types have good documentation in package_readme.md but inline comments are minimal

#### God Functions
- None identified. Largest function is 56 lines (GenerateTokenPair)

#### Test Coverage
Based on test files examined:
- jwt_test.go: Comprehensive coverage of token generation, validation, expiration, refresh
- Tests cover edge cases: invalid tokens, wrong secrets, invalid issuer/audience
- Mock implementations in tests/handlers/mocks.go

## Security Notes

### Strengths
1. **Proper error wrapping**: All errors preserve the error chain
2. **Issuer/Audience validation**: Additional validation beyond JWT library defaults
3. **No secret exposure**: Secret key is stored as `[]byte` and never logged
4. **HMAC-SHA256**: Industry-standard signing method

### Potential Concerns
1. **No token blacklisting**: Logout handler comment (handlers/auth.go:83-84) notes TODO for token invalidation
2. **Refresh token tracking**: ValidateRefreshToken comment (jwt.go:204-206) indicates token type not tracked server-side
3. **Session ID generation**: Uses uuid.New() which is cryptographically secure, but could use crypto/rand for additional security

## Dependencies

### External
- `github.com/golang-jwt/jwt/v5` - JWT library (widely trusted, actively maintained)
- `github.com/google/uuid` - UUID generation

### Internal
- `github.com/gpd/my-notes/internal/models` - Uses `models.User` for token generation

## Reverse Dependencies

### Primary Consumers (Production)
1. `internal/middleware/auth` - AuthMiddleware for JWT validation
2. `internal/middleware/security` - SecurityMiddleware for enhanced auth
3. `internal/middleware/rate_limiting` - User identification for rate limiting
4. `internal/handlers/auth` - AuthHandler for token refresh
5. `internal/handlers/chrome_auth` - ChromeAuthHandler for Chrome extension auth
6. `internal/services/user_service` - UserServiceInterface for GoogleUserInfo
7. `internal/server` - Service initialization

### Test-Only Consumers
1. `tests/auth/jwt_test.go` - Token generation and validation tests
2. `tests/auth/jwt_validation_test.go` - Edge case validation tests
3. `tests/handlers/mocks.go` - Mock implementations
4. `tests/handlers/refresh_test.go` - Refresh token flow tests
5. `tests/middleware/security_test.go` - Security middleware tests

## Recommendations

### Immediate Actions
None - Package is in good shape.

### Future Improvements
1. Implement token blacklist for proper logout functionality
2. Add server-side refresh token tracking to enable token revocation
3. Consider extracting duplicate token generation logic to a private helper
4. Add package-level constants for common string literals (e.g., "Bearer")
5. Add benchmarks to track token generation/validation performance

### Metrics
- Lines of Code: 253 (226 in jwt.go, 27 in google_user.go)
- Comment Ratio: ~15% (mostly inline comments, could be improved)
- Test Coverage: Good (comprehensive JWT tests found)
- API Surface: 5 types, 1 constructor function, 4 methods (all actively used)
