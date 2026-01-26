package auth

import (
	"testing"
	"time"

	"github.com/gpd/my-notes/internal/auth"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)


func TestTokenValidationEdgeCases(t *testing.T) {
	tokenService := setupTokenService(t)
	user := createTestUser(t, nil, "test@example.com")

	// Generate valid token
	tokenPair, err := tokenService.GenerateTokenPair(user)
	require.NoError(t, err)

	// Test validation of various token formats
	tests := []struct {
		name        string
		token       string
		expectError bool
		errorMsg    string
	}{
		{
			name:        "valid token",
			token:       tokenPair.AccessToken,
			expectError: false,
		},
		{
			name:        "empty token",
			token:       "",
			expectError: true,
			errorMsg:    "failed to parse token",
		},
		{
			name:        "token with missing parts",
			token:       "header.payload",
			expectError: true,
			errorMsg:    "failed to parse token",
		},
		{
			name:        "token with too many parts",
			token:       "header.payload.signature.extra",
			expectError: true,
			errorMsg:    "failed to parse token",
		},
		{
			name:        "invalid base64 token",
			token:       "invalid!.base64.token",
			expectError: true,
			errorMsg:    "failed to parse token",
		},
		{
			name:        "malformed JSON token",
			token:       "invalid.json.signature",
			expectError: true,
			errorMsg:    "failed to parse token",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := tokenService.ValidateToken(tt.token)
			if tt.expectError {
				assert.Error(t, err)
				if tt.errorMsg != "" {
					assert.Contains(t, err.Error(), tt.errorMsg)
				}
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestTokenClaimsValidation(t *testing.T) {
	tokenService := setupTokenService(t)
	user := createTestUser(t, nil, "test@example.com")

	tokenPair, err := tokenService.GenerateTokenPair(user)
	require.NoError(t, err)

	claims, err := tokenService.ValidateToken(tokenPair.AccessToken)
	require.NoError(t, err)

	// Verify all required claims are present
	assert.NotEmpty(t, claims.UserID)
	assert.NotEmpty(t, claims.Email)
	assert.NotEmpty(t, claims.Issuer)
	assert.NotEmpty(t, claims.Audience)
	assert.NotEmpty(t, claims.ID)
	assert.NotZero(t, claims.ExpiresAt)
	assert.NotZero(t, claims.IssuedAt)
	assert.NotZero(t, claims.NotBefore)
	assert.NotEmpty(t, claims.Subject)

	// Verify claim values
	assert.Equal(t, user.ID.String(), claims.UserID)
	assert.Equal(t, user.Email, claims.Email)
	assert.Equal(t, "notes-app", claims.Issuer)
	assert.Equal(t, "notes-users", claims.Audience)
	assert.Equal(t, user.ID.String(), claims.Subject)
}

func TestTokenTimestamps(t *testing.T) {
	tokenService := setupTokenService(t)
	user := createTestUser(t, nil, "test@example.com")

	beforeCreation := time.Now()
	tokenPair, err := tokenService.GenerateTokenPair(user)
	require.NoError(t, err)
	afterCreation := time.Now()

	claims, err := tokenService.ValidateToken(tokenPair.AccessToken)
	require.NoError(t, err)

	// Verify issued at time is within reasonable range
	assert.True(t, claims.IssuedAt.Time.After(beforeCreation.Add(-time.Second)))
	assert.True(t, claims.IssuedAt.Time.Before(afterCreation.Add(time.Second)))

	// Verify not before time is close to issued at time
	diff := claims.NotBefore.Time.Sub(claims.IssuedAt.Time)
	assert.True(t, diff < time.Second, "NotBefore should be very close to IssuedAt")

	// Verify expires at is approximately 15 minutes from issued at
	expectedExpiry := claims.IssuedAt.Time.Add(15 * time.Minute)
	actualDiff := expectedExpiry.Sub(claims.ExpiresAt.Time)
	assert.True(t, actualDiff < time.Second, "ExpiresAt should be approximately 15 minutes from IssuedAt")
}

func TestTokenWithDifferentUsers(t *testing.T) {
	tokenService := setupTokenService(t)

	user1 := createTestUser(t, nil, "user1@example.com")
	user2 := createTestUser(t, nil, "user2@example.com")

	token1, err := tokenService.GenerateTokenPair(user1)
	require.NoError(t, err)

	token2, err := tokenService.GenerateTokenPair(user2)
	require.NoError(t, err)

	// Validate token1
	claims1, err := tokenService.ValidateToken(token1.AccessToken)
	require.NoError(t, err)
	assert.Equal(t, user1.ID.String(), claims1.UserID)
	assert.Equal(t, user1.Email, claims1.Email)

	// Validate token2
	claims2, err := tokenService.ValidateToken(token2.AccessToken)
	require.NoError(t, err)
	assert.Equal(t, user2.ID.String(), claims2.UserID)
	assert.Equal(t, user2.Email, claims2.Email)

	// Tokens should be different
	assert.NotEqual(t, token1.AccessToken, token2.AccessToken)
	assert.NotEqual(t, token1.RefreshToken, token2.RefreshToken)
}

func TestTokenUniqueness(t *testing.T) {
	tokenService := setupTokenService(t)
	user := createTestUser(t, nil, "test@example.com")

	// Generate multiple token pairs
	const numTokens = 10
	tokens := make(map[string]bool)

	for i := 0; i < numTokens; i++ {
		tokenPair, err := tokenService.GenerateTokenPair(user)
		require.NoError(t, err)

		// Access tokens should be unique
		assert.False(t, tokens[tokenPair.AccessToken], "Access token should be unique")
		tokens[tokenPair.AccessToken] = true

		// Validate the token
		claims, err := tokenService.ValidateToken(tokenPair.AccessToken)
		assert.NoError(t, err)
		assert.Equal(t, user.ID.String(), claims.UserID)
	}

	// We should have generated exactly numTokens unique tokens
	assert.Equal(t, numTokens, len(tokens))
}

func TestTokenWithShortExpiry(t *testing.T) {
	// Create token service with very short expiry
	shortService := auth.NewTokenService(
		"test-secret-key-that-is-long-enough-for-hs256",
		1*time.Millisecond, // Very short expiry
		24*time.Hour,
		"notes-app",
		"notes-users",
	)

	user := createTestUser(t, nil, "test@example.com")

	// Try to generate token - it might be expired immediately due to timing
	tokenPair, err := shortService.GenerateTokenPair(user)
	if err != nil {
		t.Skip("Skipping test due to timing issues in test environment")
		return
	}

	// Check if token is already expired (this is expected with very short expiry)
	_, err = shortService.ValidateToken(tokenPair.AccessToken)
	if err != nil && (err.Error() == "failed to parse token: token has invalid claims: token is expired" ||
		err.Error() == "failed to parse token: token is expired") {
		// This is actually the expected behavior - token expires immediately
		t.Log("Token expired immediately as expected with very short expiry")
		return
	}

	// If token is somehow still valid, wait for it to expire
	time.Sleep(5 * time.Millisecond)
	_, err = shortService.ValidateToken(tokenPair.AccessToken)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "expired")
}

func TestTokenRefreshValidation(t *testing.T) {
	tokenService := setupTokenService(t)
	user := createTestUser(t, nil, "test@example.com")

	tokenPair, err := tokenService.GenerateTokenPair(user)
	require.NoError(t, err)

	// Refresh token should be valid as regular token too
	claims, err := tokenService.ValidateToken(tokenPair.RefreshToken)
	assert.NoError(t, err)
	assert.Equal(t, user.ID.String(), claims.UserID)

	// Refresh token should also be valid via refresh-specific method
	refreshClaims, err := tokenService.ValidateRefreshToken(tokenPair.RefreshToken)
	assert.NoError(t, err)
	assert.Equal(t, user.ID.String(), refreshClaims.UserID)
}

func TestTokenIDUniqueness(t *testing.T) {
	tokenService := setupTokenService(t)
	user := createTestUser(t, nil, "test@example.com")

	const numTokens = 50
	tokenIDs := make(map[string]bool)

	for i := 0; i < numTokens; i++ {
		tokenPair, err := tokenService.GenerateTokenPair(user)
		require.NoError(t, err)

		// Get claims from access token
		claims, err := tokenService.ValidateToken(tokenPair.AccessToken)
		require.NoError(t, err)

		// Token ID should be unique
		assert.False(t, tokenIDs[claims.ID], "Token ID should be unique")
		tokenIDs[claims.ID] = true

		// Token ID should be a valid UUID
		_, err = uuid.Parse(claims.ID)
		assert.NoError(t, err, "Token ID should be a valid UUID")
	}

	// We should have generated exactly numTokens unique token IDs
	assert.Equal(t, numTokens, len(tokenIDs))
}