# Implementation Plan: P2-AUT-A002

**TaskID**: P2-AUT-A002
**Type**: Refactor
**Created**: 2025-01-22 13:55:00
**Analysis Source**: 20250122-135338-IpbB_code_analyzer.md

---

## User Context

### Original User Request
```
@backend/internal/auth files .
is there any files, any functions that is not being used anywhere else?
list it . because i am planning to purge stale code.
```

## Requirements Understanding

The user wants to identify and remove unused code (stale code) within the `backend/internal/auth` package to safely remove functions, types, or methods that are not referenced anywhere else in the codebase.

### Analysis Findings
- **Safe to remove**: `GoogleTokenResponse` struct, `GoogleUserInfo.ToUser()` method
- **Test-only code**: `NewGoogleConfig()`, `IsTokenExpired()`, `GetTokenExpiration()` - move to test files
- **Security gaps**: `ValidateState()`, `VerifyRedirectURL()` - defined but not called, should be implemented

### User Decisions
- Implement security validations + remove stale code
- Move test-only functions to test files (not delete them)

---

## Summary

Remove unused code (GoogleTokenResponse, GoogleUserInfo.ToUser), implement security validations (ValidateState, VerifyRedirectURL) in handlers, and move test-only helper functions to test files to clean up the auth package API while improving security.

## Scope

### Files to Modify
- `backend/internal/auth/google_user.go` - Remove GoogleTokenResponse struct and ToUser() method
- `backend/internal/auth/google_config.go` - Remove NewGoogleConfig() function
- `backend/internal/auth/jwt.go` - Remove IsTokenExpired() and GetTokenExpiration() methods
- `backend/internal/handlers/auth.go` - Add ValidateState() and VerifyRedirectURL() calls
- `backend/internal/auth/google_config_test.go` - Add NewGoogleConfig() helper
- `backend/internal/auth/jwt_test.go` - Add IsTokenExpired() and GetTokenExpiration() helpers

### Dependencies
- `backend/internal/auth/oauth_service.go` - Contains ValidateState and VerifyRedirectURL methods
- `backend/internal/handlers/auth.go` - OAuth handlers that need security validation

---

## Implementation Steps

### Step 1: Remove GoogleTokenResponse struct and GoogleUserInfo.ToUser() method
**File**: `backend/internal/auth/google_user.go`

**Change**: Remove unused struct and method.

**Code to remove**:
```go
// ToUser converts GoogleUserInfo to a User model.
func (g *GoogleUserInfo) ToUser() *models.User {
	return &models.User{
		GoogleID:   g.ID,
		Email:      g.Email,
		Name:       g.Name,
		AvatarURL:  g.Picture,
		IsVerified: g.VerifiedEmail,
	}
}

// GoogleTokenResponse represents Google's OAuth token response.
type GoogleTokenResponse struct {
	AccessToken         string `json:"access_token"`
	TokenType           string `json:"token_type"`
	ExpiresIn           int    `json:"expires_in"`
	RefreshToken        string `json:"refresh_token"`
	Scope               string `json:"scope"`
	IDToken             string `json:"id_token"`
	Error               string `json:"error"`
	ErrorDescription    string `json:"error_description"`
}
```

**Impact**: No production code references these. Tests don't reference them either.

---

### Step 2: Remove NewGoogleConfig() function
**File**: `backend/internal/auth/google_config.go`

**Change**: Remove NewGoogleConfig function (production uses struct literal).

**Code to remove**:
```go
// NewGoogleConfig creates a new GoogleConfig with default scopes.
func NewGoogleConfig(clientID, clientSecret, redirectURL string, scopes []string) *GoogleConfig {
	if len(scopes) == 0 {
		scopes = DefaultScopes()
	}
	return &GoogleConfig{
		ClientID:     clientID,
		ClientSecret: clientSecret,
		RedirectURL:  redirectURL,
		Scopes:       scopes,
	}
}
```

**Impact**: Only used in tests. Will add to test file in Step 5.

---

### Step 3: Remove IsTokenExpired() and GetTokenExpiration() methods
**File**: `backend/internal/auth/jwt.go`

**Change**: Remove test-only helper methods.

**Code to remove**:
```go
// IsTokenExpired checks if a token is expired.
func (ts *TokenService) IsTokenExpired(tokenString string) bool {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		return ts.secretKey, nil
	})
	if err != nil || !token.Valid {
		return true
	}
	return claims.ExpiresAt.Time.Before(time.Now())
}

// GetTokenExpiration returns the expiration time of a token.
func (ts *TokenService) GetTokenExpiration(tokenString string) (time.Time, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		return ts.secretKey, nil
	})
	if err != nil {
		return time.Time{}, err
	}
	if !token.Valid {
		return time.Time{}, errors.New("invalid token")
	}
	return claims.ExpiresAt.Time, nil
}
```

**Impact**: Only used in tests. Will add to test file in Step 6.

---

### Step 4: Add ValidateState() call in HandleCallback
**File**: `backend/internal/handlers/auth.go`

**Change**: Add state validation in OAuth callback handler for CSRF protection.

**Add validation after extracting state parameter**:
```go
// Extract state parameter
state := r.URL.Query().Get("state")
if state == "" {
   RespondWithError(w, r, http.StatusBadRequest, "Missing state parameter", ErrStateMissing)
    return
}

// Validate state parameter to prevent CSRF attacks
storedState, err := h.oauthService.ValidateState(r.Context(), state)
if err != nil {
    RespondWithError(w, r, http.StatusBadRequest, "Invalid state parameter", ErrStateInvalid)
    return
}
```

**Impact**: Improves security by validating the OAuth state parameter.

---

### Step 5: Add VerifyRedirectURL() call in HandleLogin
**File**: `backend/internal/handlers/auth.go`

**Change**: Add redirect URL validation in login handler to prevent open redirect attacks.

**Add validation after extracting redirectURL**:
```go
// Get redirect URL from query param or use default
redirectURL := r.URL.Query().Get("redirect_url")
if redirectURL == "" {
    redirectURL = h.defaultRedirectURL
}

// Validate redirect URL to prevent open redirect attacks
if err := h.oauthService.VerifyRedirectURL(r.Context(), redirectURL); err != nil {
    RespondWithError(w, r, http.StatusBadRequest, "Invalid redirect URL", ErrInvalidRedirectURL)
    return
}
```

**Impact**: Improves security by validating redirect URLs.

---

### Step 6: Add NewGoogleConfig() helper to test file
**File**: `backend/internal/auth/google_config_test.go`

**Change**: Add NewGoogleConfig as a test helper function.

**Add to test file**:
```go
// newGoogleConfig creates a new GoogleConfig for testing.
func newGoogleConfig(clientID, clientSecret, redirectURL string, scopes []string) *GoogleConfig {
	if len(scopes) == 0 {
		scopes = DefaultScopes()
	}
	return &GoogleConfig{
		ClientID:     clientID,
		ClientSecret: clientSecret,
		RedirectURL:  redirectURL,
		Scopes:       scopes,
	}
}
```

**Update test calls**: Change `NewGoogleConfig` to `newGoogleConfig` in all test functions.

---

### Step 7: Add IsTokenExpired() and GetTokenExpiration() helpers to test file
**File**: `backend/internal/auth/jwt_test.go`

**Change**: Add IsTokenExpired and GetTokenExpiration as test helper functions.

**Add to test file**:
```go
// isTokenExpired checks if a token is expired (test helper).
func isTokenExpired(ts *TokenService, tokenString string) bool {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		return ts.secretKey, nil
	})
	if err != nil || !token.Valid {
		return true
	}
	return claims.ExpiresAt.Time.Before(time.Now())
}

// getTokenExpiration returns the expiration time of a token (test helper).
func getTokenExpiration(ts *TokenService, tokenString string) (time.Time, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		return ts.secretKey, nil
	})
	if err != nil {
		return time.Time{}, err
	}
	if !token.Valid {
		return time.Time{}, errors.New("invalid token")
	}
	return claims.ExpiresAt.Time, nil
}
```

**Update test calls**: Change `ts.IsTokenExpired` to `isTokenExpired(ts, ...)` and `ts.GetTokenExpiration` to `getTokenExpiration(ts, ...)` in all test functions.

---

## Testing Plan

1. Run existing auth tests to ensure no regressions
2. Test OAuth flow with state validation enabled
3. Test OAuth flow with redirect URL validation enabled
4. Verify tests still pass after moving helper functions

## Rollback Plan

If security validations break OAuth flow:
1. Remove ValidateState and VerifyRedirectURL calls from handlers
2. Keep code removal (GoogleTokenResponse, ToUser, test-only functions)
3. Report security validation issues for investigation
