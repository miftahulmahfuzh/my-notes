package auth_test

import (
	"context"
	"testing"
	"time"

	"github.com/gpd/my-notes/internal/auth"
	"github.com/gpd/my-notes/internal/models"
	"github.com/gpd/my-notes/internal/services"
	"github.com/gpd/my-notes/tests"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestValidateToken_Blacklisted tests that blacklisted tokens fail validation
func TestValidateToken_Blacklisted(t *testing.T) {
	if !tests.USE_POSTGRE_DURING_TEST {
		t.Skip("PostgreSQL tests are disabled. Set USE_POSTGRE_DURING_TEST=true to enable.")
	}

	// Setup test database
	db := tests.SetupTestDB(t)
	defer tests.CleanupTestDB(t, db)

	// Create token service with blacklist
	tokenService := auth.NewTokenService(
		"test-secret-key",
		1*time.Hour,
		24*time.Hour,
		"silence-notes",
		"silence-notes-users",
	)

	blacklistSvc := services.NewBlacklistService(db)
	tokenService.SetBlacklist(blacklistSvc)

	// Create a test user and generate token
	userID := uuid.New()
	user := &models.User{
		ID:       userID,
		GoogleID: "google_" + userID.String(),
		Email:    "test@example.com",
	}

	tokenPair, err := tokenService.GenerateTokenPair(user)
	require.NoError(t, err)

	// Get token ID by parsing the token
	ctx := context.Background()
	claims, err := tokenService.ValidateToken(ctx, tokenPair.AccessToken)
	require.NoError(t, err)

	// Add token to blacklist
	err = blacklistSvc.AddToken(ctx, claims.ID, user.ID.String(), claims.SessionID, claims.ExpiresAt.Time, "logout")
	require.NoError(t, err)

	// Try to validate the blacklisted token
	_, err = tokenService.ValidateToken(ctx, tokenPair.AccessToken)

	// Should fail with "token has been revoked" error
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "revoked")
}

// TestValidateToken_NotBlacklisted tests that non-blacklisted tokens validate successfully
func TestValidateToken_NotBlacklisted(t *testing.T) {
	if !tests.USE_POSTGRE_DURING_TEST {
		t.Skip("PostgreSQL tests are disabled. Set USE_POSTGRE_DURING_TEST=true to enable.")
	}

	// Setup test database
	db := tests.SetupTestDB(t)
	defer tests.CleanupTestDB(t, db)

	// Create token service with blacklist
	tokenService := auth.NewTokenService(
		"test-secret-key",
		1*time.Hour,
		24*time.Hour,
		"silence-notes",
		"silence-notes-users",
	)

	blacklistSvc := services.NewBlacklistService(db)
	tokenService.SetBlacklist(blacklistSvc)

	// Create a test user and generate token
	userID := uuid.New()
	user := &models.User{
		ID:       userID,
		GoogleID: "google_" + userID.String(),
		Email:    "test@example.com",
	}

	tokenPair, err := tokenService.GenerateTokenPair(user)
	require.NoError(t, err)

	// Validate the token (should succeed)
	ctx := context.Background()
	claims, err := tokenService.ValidateToken(ctx, tokenPair.AccessToken)

	// Should succeed
	assert.NoError(t, err)
	assert.NotNil(t, claims)
	assert.Equal(t, user.ID.String(), claims.UserID)
	assert.Equal(t, user.Email, claims.Email)
}

// TestValidateRefreshToken_Blacklisted tests that blacklisted refresh tokens fail validation
func TestValidateRefreshToken_Blacklisted(t *testing.T) {
	if !tests.USE_POSTGRE_DURING_TEST {
		t.Skip("PostgreSQL tests are disabled. Set USE_POSTGRE_DURING_TEST=true to enable.")
	}

	// Setup test database
	db := tests.SetupTestDB(t)
	defer tests.CleanupTestDB(t, db)

	// Create token service with blacklist
	tokenService := auth.NewTokenService(
		"test-secret-key",
		1*time.Hour,
		24*time.Hour,
		"silence-notes",
		"silence-notes-users",
	)

	blacklistSvc := services.NewBlacklistService(db)
	tokenService.SetBlacklist(blacklistSvc)

	// Create a test user and generate token
	userID := uuid.New()
	user := &models.User{
		ID:       userID,
		GoogleID: "google_" + userID.String(),
		Email:    "test@example.com",
	}

	tokenPair, err := tokenService.GenerateTokenPair(user)
	require.NoError(t, err)

	// Get refresh token ID by parsing the token
	ctx := context.Background()
	claims, err := tokenService.ValidateToken(ctx, tokenPair.RefreshToken)
	require.NoError(t, err)

	// Add refresh token to blacklist
	err = blacklistSvc.AddToken(ctx, claims.ID, user.ID.String(), claims.SessionID, claims.ExpiresAt.Time, "logout")
	require.NoError(t, err)

	// Try to validate the blacklisted refresh token
	_, err = tokenService.ValidateRefreshToken(ctx, tokenPair.RefreshToken)

	// Should fail with "token has been revoked" error
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "revoked")
}

// TestValidateToken_WithoutBlacklistService tests that tokens validate successfully when no blacklist is configured
func TestValidateToken_WithoutBlacklistService(t *testing.T) {
	if !tests.USE_POSTGRE_DURING_TEST {
		t.Skip("PostgreSQL tests are disabled. Set USE_POSTGRE_DURING_TEST=true to enable.")
	}

	// Setup test database
	db := tests.SetupTestDB(t)
	defer tests.CleanupTestDB(t, db)

	// Create token service WITHOUT blacklist
	tokenService := auth.NewTokenService(
		"test-secret-key",
		1*time.Hour,
		24*time.Hour,
		"silence-notes",
		"silence-notes-users",
	)

	// Don't set blacklist - should still work

	// Create a test user and generate token
	userID := uuid.New()
	user := &models.User{
		ID:       userID,
		GoogleID: "google_" + userID.String(),
		Email:    "test@example.com",
	}

	tokenPair, err := tokenService.GenerateTokenPair(user)
	require.NoError(t, err)

	// Validate the token (should succeed even without blacklist)
	ctx := context.Background()
	claims, err := tokenService.ValidateToken(ctx, tokenPair.AccessToken)

	// Should succeed
	assert.NoError(t, err)
	assert.NotNil(t, claims)
	assert.Equal(t, user.ID.String(), claims.UserID)
}

// TestValidateToken_BlacklistError tests that validation continues even if blacklist check fails
func TestValidateToken_BlacklistError(t *testing.T) {
	if !tests.USE_POSTGRE_DURING_TEST {
		t.Skip("PostgreSQL tests are disabled. Set USE_POSTGRE_DURING_TEST=true to enable.")
	}

	// Setup test database
	db := tests.SetupTestDB(t)
	defer tests.CleanupTestDB(t, db)

	// Create token service with blacklist
	tokenService := auth.NewTokenService(
		"test-secret-key",
		1*time.Hour,
		24*time.Hour,
		"silence-notes",
		"silence-notes-users",
	)

	// Create a mock blacklist service that returns an error
	mockBlacklist := &mockBlacklistService{shouldError: true}
	tokenService.SetBlacklist(mockBlacklist)

	// Create a test user and generate token
	userID := uuid.New()
	user := &models.User{
		ID:       userID,
		GoogleID: "google_" + userID.String(),
		Email:    "test@example.com",
	}

	tokenPair, err := tokenService.GenerateTokenPair(user)
	require.NoError(t, err)

	// Validate the token - should succeed despite blacklist error (graceful degradation)
	ctx := context.Background()
	claims, err := tokenService.ValidateToken(ctx, tokenPair.AccessToken)

	// Should succeed - blacklist errors don't block validation
	assert.NoError(t, err)
	assert.NotNil(t, claims)
}

// mockBlacklistService is a mock implementation that can return errors
type mockBlacklistService struct {
	shouldError bool
}

func (m *mockBlacklistService) IsTokenBlacklisted(ctx context.Context, tokenID string) (bool, error) {
	if m.shouldError {
		return false, assert.AnError
	}
	return false, nil
}

// TestTokenService_SetBlacklist tests setting the blacklist checker
func TestTokenService_SetBlacklist(t *testing.T) {
	tokenService := auth.NewTokenService(
		"test-secret-key",
		1*time.Hour,
		24*time.Hour,
		"silence-notes",
		"silence-notes-users",
	)

	// Create a mock blacklist
	mockBlacklist := &mockBlacklistService{shouldError: false}

	// Set blacklist
	tokenService.SetBlacklist(mockBlacklist)

	// Verify blacklist is set (we can't directly access it, but we can verify it works)
	// by checking that ValidateToken doesn't panic

	userID := uuid.New()
	user := &models.User{
		ID:       userID,
		GoogleID: "google_" + userID.String(),
		Email:    "test@example.com",
	}

	tokenPair, err := tokenService.GenerateTokenPair(user)
	require.NoError(t, err)

	ctx := context.Background()
	claims, err := tokenService.ValidateToken(ctx, tokenPair.AccessToken)

	assert.NoError(t, err)
	assert.NotNil(t, claims)
}
