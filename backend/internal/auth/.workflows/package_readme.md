# Package: auth

**Location**: `backend/internal/auth`

**Last Updated**: 2026-01-29

## Overview

The auth package provides JWT-based authentication and authorization primitives for the Silence Notes backend. It handles token generation, validation, and refresh using HMAC-SHA256 signing, along with Google OAuth user information structures.

**Key Responsibilities:**
- JWT access token and refresh token generation with configurable expiration
- Token validation with issuer and audience verification
- Google OAuth user information representation and validation

## Exported API

### Types

#### Claims
```go
type Claims struct {
    UserID    string `json:"user_id"`
    SessionID string `json:"session_id"`
    Email     string `json:"email"`
    Issuer    string `json:"iss"`
    Audience  string `json:"aud"`
    jwt.RegisteredClaims
}
```

Purpose: JWT claims structure containing user identity and session information.

Fields:
- `UserID` - User's UUID as string
- `SessionID` - Session identifier for tracking user sessions
- `Email` - User's email address
- `Issuer` - Token issuer identifier (e.g., "silence-notes")
- `Audience` - Expected audience identifier (e.g., "silence-notes-users")
- `RegisteredClaims` - Standard JWT claims (exp, iat, nbf, sub, jti)

#### TokenPair
```go
type TokenPair struct {
    AccessToken  string `json:"access_token"`
    RefreshToken string `json:"refresh_token"`
    TokenType    string `json:"token_type"`
    ExpiresIn    int    `json:"expires_in"`
}
```

Purpose: Container for generated access and refresh tokens.

Fields:
- `AccessToken` - JWT access token for API authentication
- `RefreshToken` - JWT refresh token for obtaining new access tokens
- `TokenType` - Always "Bearer"
- `ExpiresIn` - Access token lifetime in seconds

#### TokenService
```go
type TokenService struct {
    // Contains unexported fields
}
```

Purpose: Service for generating and validating JWT tokens.

Methods:
- `GenerateTokenPair(user *models.User) (*TokenPair, error)` - Creates new access and refresh tokens with generated session ID
- `GenerateTokenPairWithSession(user *models.User, sessionID string) (*TokenPair, error)` - Creates tokens with specific session ID
- `ValidateToken(tokenString string) (*Claims, error)` - Validates and parses a JWT token
- `ValidateRefreshToken(tokenString string) (*Claims, error)` - Validates a refresh token specifically

#### GoogleUserInfo
```go
type GoogleUserInfo struct {
    ID            string `json:"id"`
    Email         string `json:"email"`
    VerifiedEmail bool   `json:"verified_email"`
    GivenName     string `json:"given_name"`
    FamilyName    string `json:"family_name"`
    Picture       string `json:"picture"`
    Locale        string `json:"locale"`
}
```

Purpose: Represents user information retrieved from Google OAuth.

Fields:
- `ID` - Google user ID (required for validation)
- `Email` - User's email address (required for validation)
- `VerifiedEmail` - Whether email has been verified by Google
- `GivenName` - User's first name
- `FamilyName` - User's last name
- `Picture` - URL to user's profile picture
- `Locale` - User's locale preference

Methods:
- `Validate() error` - Validates that required fields (ID, Email) are present

#### RefreshTokenRequest
```go
type RefreshTokenRequest struct {
    RefreshToken string `json:"refresh_token" validate:"required"`
}
```

Purpose: Request structure for token refresh endpoint.

Fields:
- `RefreshToken` - The refresh token to exchange for new tokens (required)

Methods:
- `Validate() error` - Validates that refresh token is not empty

### Functions

#### NewTokenService
```go
func NewTokenService(secretKey string, accessExpiry, refreshExpiry time.Duration, issuer, audience string) *TokenService
```

Purpose: Creates a new TokenService instance with configured parameters.

Parameters:
- `secretKey` - HMAC secret key for signing tokens (must be kept confidential)
- `accessExpiry` - Lifetime of access tokens
- `refreshExpiry` - Lifetime of refresh tokens
- `issuer` - Issuer claim value for generated tokens
- `audience` - Audience claim value for generated tokens

Returns:
- `*TokenService` - Configured token service instance

Thread-safety: Safe for concurrent use (read-only operations after creation)

Example usage:
```go
tokenService := auth.NewTokenService(
    "secret-key",
    1*time.Hour,
    24*7*time.Hour,
    "silence-notes",
    "silence-notes-users",
)
```

### Constants

No exported constants. Configuration is provided at runtime via `NewTokenService`.

## Internal Architecture

### Key Internal Types
None - all significant types are exported for use by handlers and middleware.

### Data Flow
```
User Authentication → TokenService.GenerateTokenPair() → TokenPair
                                                    ↓
Token Validation ← TokenService.ValidateToken() ← HTTP Authorization Header
```

## Dependencies

### External Packages
- `github.com/golang-jwt/jwt/v5` - JWT creation, parsing, and validation with HMAC signing
- `github.com/google/uuid` - Generation of unique token IDs (JTI claims)

### Internal Packages
- `github.com/gpd/my-notes/internal/models` - Uses `models.User` for token generation

### Standard Library
- `time` - Token expiration time calculations
- `fmt` - Error formatting and wrapping

## Reverse Dependencies

### Primary Consumers
- `internal/middleware/auth` - Uses `TokenService`, `Claims` for JWT validation in authentication middleware
- `internal/handlers/auth` - Uses `TokenService`, `TokenPair`, `RefreshTokenRequest` for token refresh and logout
- `internal/handlers/chrome_auth` - Uses `TokenService`, `GoogleUserInfo` for Chrome extension authentication
- `internal/middleware/security` - Uses `TokenService` for enhanced authentication flows
- `internal/middleware/rate_limiting` - Uses `TokenService` for user identification in rate limiting
- `internal/services/user_service` - Uses `GoogleUserInfo` for user creation from OAuth data

### Secondary Consumers
- `internal/server` - Uses `TokenService` (via NewTokenService) for service initialization

### Test-Only Consumers
- `tests/auth/jwt_test.go` - Tests token generation and validation
- `tests/auth/jwt_validation_test.go` - Tests token validation edge cases
- `tests/handlers/mocks.go` - Mock implementations
- `tests/handlers/refresh_test.go` - Tests refresh token flow
- `tests/middleware/security_test.go` - Tests security middleware with auth

## Concurrency

This package is not designed with explicit concurrency primitives (no goroutines, channels, or mutexes).

Thread-safety guarantees:
- `TokenService` methods are safe for concurrent use - all operations are stateless or use immutable data
- JWT signing and validation are read-only operations on the secret key

## Error Handling

Custom errors: No exported error types. Errors are created dynamically with `errors.New()` or `fmt.Errorf()`.

Error wrapping: Yes, uses `fmt.Errorf()` with `%w` verb for error chain preservation.

Error conditions:
- `GenerateTokenPair*`: Returns wrapped error if token signing fails
- `ValidateToken`: Returns error for:
  - Invalid token format or signature
  - Unexpected signing method
  - Mismatched issuer or audience
  - Invalid claims structure
- `ValidateRefreshToken`: Wraps `ValidateToken` errors
- `GoogleUserInfo.Validate`: Returns error if ID or Email is empty

Panics: No intentional panics. JWT library may panic if given invalid input, but this is guarded by pre-validation.

## Performance

Allocation patterns: Moderate allocation during token generation (creates new JWT structures, claims objects, and signed strings).

Expensive operations:
- Token signing - HMAC-SHA256 computation (fast but non-zero cost)
- Token parsing - Requires signature verification

Caching strategy: No caching - tokens are validated on each request. This is intentional for security (allows immediate token invalidation).

Benchmark coverage: No benchmark files in this package.

## Usage

### Initialization
```go
tokenService := auth.NewTokenService(
    os.Getenv("JWT_SECRET"),      // Must be kept secret
    1*time.Hour,                   // Access token lifetime
    24*7*time.Hour,                // Refresh token lifetime
    "silence-notes",              // Issuer identifier
    "silence-notes-users",        // Audience identifier
)
```

### Common Patterns

```go
// Pattern 1: Generate tokens after authentication
user, _ := userService.CreateOrUpdateFromGoogle(googleUserInfo)
tokenPair, err := tokenService.GenerateTokenPair(user)
if err != nil {
    // Handle error
}
// Return tokenPair to client

// Pattern 2: Validate token on protected endpoint
authHeader := r.Header.Get("Authorization")
tokenString := strings.TrimPrefix(authHeader, "Bearer ")
claims, err := tokenService.ValidateToken(tokenString)
if err != nil {
    // Return 401 Unauthorized
}
// Use claims.UserID to fetch user

// Pattern 3: Refresh expired access token
claims, _ := tokenService.ValidateRefreshToken(refreshToken)
user, _ := userService.GetByID(claims.UserID)
newTokenPair, _ := tokenService.GenerateTokenPair(user)
// Return new tokens to client

// Pattern 4: Reuse existing session for Chrome extension
sessionID := existingSession.ID
tokenPair, err := tokenService.GenerateTokenPairWithSession(user, sessionID)
```

### Gotchas
- Token expiration is validated during `ValidateToken()` - check `Claims.ExpiresAt` if you need remaining time
- `GenerateTokenPair()` creates a new session ID each time - use `GenerateTokenPairWithSession()` to reuse sessions
- The secret key is never exposed - ensure `JWT_SECRET` environment variable is set in production
- `ValidateRefreshToken()` currently has the same validation as `ValidateToken()` - token type tracking is planned for future implementation

## Notes

**Documentation Created**: 2026-01-29

The auth package is a focused, security-sensitive component. When modifying:
- Never log or expose the secret key
- Maintain backward compatibility with existing tokens when changing claims structure
- Consider token rotation strategies when updating signing methods
- Refresh tokens currently have no server-side tracking - consider implementing a token blacklist for logout functionality
