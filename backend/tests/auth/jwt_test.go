package auth

import (
	"testing"
	"time"

	"github.com/gpd/my-notes/internal/auth"
	"github.com/gpd/my-notes/internal/models"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupTokenService(t *testing.T) *auth.TokenService {
	return auth.NewTokenService(
		"test-secret-key-that-is-long-enough-for-hs256",
		15*time.Minute,
		24*time.Hour,
		"notes-app",
		"notes-users",
	)
}

func createTestUser(t *testing.T, db interface{}, email string) *models.User {
	userID := uuid.New()
	avatarURL := "https://example.com/avatar.jpg"

	return &models.User{
		ID:        userID,
		GoogleID:  "google-123",
		Email:     email,
		Name:      "Test User",
		AvatarURL: &avatarURL,
		Preferences: models.UserPreferences{
			Theme:              "light",
			Language:           "en",
			TimeZone:           "UTC",
			EmailNotifications: true,
			AutoSave:           true,
			DefaultNoteView:    "grid",
		},
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
}

func TestTokenGeneration(t *testing.T) {
	tokenService := setupTokenService(t)
	user := createTestUser(t, nil, "test@example.com")

	tokenPair, err := tokenService.GenerateTokenPair(user)
	assert.NoError(t, err)
	assert.NotEmpty(t, tokenPair.AccessToken)
	assert.NotEmpty(t, tokenPair.RefreshToken)
	assert.Equal(t, "Bearer", tokenPair.TokenType)
	assert.True(t, tokenPair.ExpiresIn > 0)
}

func TestTokenValidation(t *testing.T) {
	tokenService := setupTokenService(t)
	user := createTestUser(t, nil, "test@example.com")

	// Generate valid token
	tokenPair, err := tokenService.GenerateTokenPair(user)
	require.NoError(t, err)

	// Validate token
	claims, err := tokenService.ValidateToken(tokenPair.AccessToken)
	assert.NoError(t, err)
	assert.Equal(t, user.ID.String(), claims.UserID)
	assert.Equal(t, user.Email, claims.Email)
	assert.Equal(t, user.Name, claims.Name)
	assert.Equal(t, "notes-app", claims.Issuer)
	assert.Equal(t, "notes-users", claims.Audience)
}

func TestTokenExpiration(t *testing.T) {
	tokenService := auth.NewTokenService(
		"test-secret",
		1*time.Millisecond, // Very short expiry
		24*time.Hour,
		"notes-app",
		"notes-users",
	)

	user := createTestUser(t, nil, "test@example.com")
	tokenPair, err := tokenService.GenerateTokenPair(user)
	require.NoError(t, err)

	// Wait for token to expire
	time.Sleep(10 * time.Millisecond)

	// Token should be expired
	_, err = tokenService.ValidateToken(tokenPair.AccessToken)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "expired")
}

func TestTokenRefresh(t *testing.T) {
	tokenService := setupTokenService(t)
	user := createTestUser(t, nil, "test@example.com")

	// Generate initial tokens
	originalTokens, err := tokenService.GenerateTokenPair(user)
	require.NoError(t, err)

	// Validate refresh token
	_, err = tokenService.ValidateRefreshToken(originalTokens.RefreshToken)
	assert.NoError(t, err)

	// Generate new token pair
	newTokens, err := tokenService.GenerateTokenPair(user)
	assert.NoError(t, err)

	// New tokens should be different
	assert.NotEqual(t, originalTokens.AccessToken, newTokens.AccessToken)
	assert.NotEqual(t, originalTokens.RefreshToken, newTokens.RefreshToken)

	// New tokens should be valid
	claims, err := tokenService.ValidateToken(newTokens.AccessToken)
	assert.NoError(t, err)
	assert.Equal(t, user.ID.String(), claims.UserID)
}

func TestInvalidToken(t *testing.T) {
	tokenService := setupTokenService(t)

	// Test with completely invalid token
	_, err := tokenService.ValidateToken("invalid.token.here")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "failed to parse token")

	// Test with malformed token
	_, err = tokenService.ValidateToken("only.one.part")
	assert.Error(t, err)
}

func TestTokenWithWrongSecret(t *testing.T) {
	// Create two token services with different secrets
	tokenService1 := auth.NewTokenService(
		"secret1",
		15*time.Minute,
		24*time.Hour,
		"notes-app",
		"notes-users",
	)

	tokenService2 := auth.NewTokenService(
		"secret2",
		15*time.Minute,
		24*time.Hour,
		"notes-app",
		"notes-users",
	)

	user := createTestUser(t, nil, "test@example.com")

	// Generate token with first service
	tokenPair, err := tokenService1.GenerateTokenPair(user)
	require.NoError(t, err)

	// Try to validate with second service (should fail)
	_, err = tokenService2.ValidateToken(tokenPair.AccessToken)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "signature is invalid")
}

func TestTokenWithInvalidIssuer(t *testing.T) {
	tokenService := setupTokenService(t)
	user := createTestUser(t, nil, "test@example.com")

	tokenPair, err := tokenService.GenerateTokenPair(user)
	require.NoError(t, err)

	// Create token service with different issuer
	differentService := auth.NewTokenService(
		"test-secret-key-that-is-long-enough-for-hs256",
		15*time.Minute,
		24*time.Hour,
		"different-app",
		"notes-users",
	)

	// Should fail due to invalid issuer
	_, err = differentService.ValidateToken(tokenPair.AccessToken)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "invalid token issuer")
}

func TestTokenWithInvalidAudience(t *testing.T) {
	tokenService := setupTokenService(t)
	user := createTestUser(t, nil, "test@example.com")

	tokenPair, err := tokenService.GenerateTokenPair(user)
	require.NoError(t, err)

	// Create token service with different audience
	differentService := auth.NewTokenService(
		"test-secret-key-that-is-long-enough-for-hs256",
		15*time.Minute,
		24*time.Hour,
		"notes-app",
		"different-users",
	)

	// Should fail due to invalid audience
	_, err = differentService.ValidateToken(tokenPair.AccessToken)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "invalid token audience")
}

func TestIsTokenExpired(t *testing.T) {
	tokenService := setupTokenService(t)
	user := createTestUser(t, nil, "test@example.com")

	tokenPair, err := tokenService.GenerateTokenPair(user)
	require.NoError(t, err)

	// Token should not be expired immediately
	assert.False(t, tokenService.IsTokenExpired(tokenPair.AccessToken))

	// Create service with very short expiry
	shortService := auth.NewTokenService(
		"test-secret",
		1*time.Millisecond,
		24*time.Hour,
		"notes-app",
		"notes-users",
	)

	shortTokenPair, err := shortService.GenerateTokenPair(user)
	require.NoError(t, err)

	// Wait for token to expire
	time.Sleep(10 * time.Millisecond)

	// Token should be expired
	assert.True(t, shortService.IsTokenExpired(shortTokenPair.AccessToken))
}

func TestGetTokenExpiration(t *testing.T) {
	tokenService := setupTokenService(t)
	user := createTestUser(t, nil, "test@example.com")

	tokenPair, err := tokenService.GenerateTokenPair(user)
	require.NoError(t, err)

	expiration, err := tokenService.GetTokenExpiration(tokenPair.AccessToken)
	assert.NoError(t, err)
	assert.NotNil(t, expiration)

	// Expiration should be approximately 15 minutes from now
	expectedExpiration := time.Now().Add(15 * time.Minute)
	diff := expectedExpiration.Sub(*expiration)
	assert.True(t, diff < time.Minute, "Expiration time should be within 1 minute of expected time")
}

func TestRefreshTokenRequestValidation(t *testing.T) {
	tests := []struct {
		name        string
		request     auth.RefreshTokenRequest
		expectError bool
	}{
		{
			name: "valid request",
			request: auth.RefreshTokenRequest{
				RefreshToken: "valid-refresh-token",
			},
			expectError: false,
		},
		{
			name: "empty refresh token",
			request: auth.RefreshTokenRequest{
				RefreshToken: "",
			},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.request.Validate()
			if tt.expectError {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), "refresh_token is required")
			} else {
				assert.NoError(t, err)
			}
		})
	}
}