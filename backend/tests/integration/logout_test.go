package integration

import (
	"context"
	"database/sql"
	"net/http"
	"net/http/httptest"
	"os"
	"strconv"
	"testing"
	"time"

	"github.com/gpd/my-notes/internal/auth"
	"github.com/gpd/my-notes/internal/config"
	"github.com/gpd/my-notes/internal/database"
	"github.com/gpd/my-notes/internal/handlers"
	"github.com/gpd/my-notes/internal/models"
	"github.com/gpd/my-notes/internal/server"
	"github.com/gpd/my-notes/internal/services"
	"github.com/gpd/my-notes/tests"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
)

// LogoutTestSuite tests the logout functionality with token blacklist
type LogoutTestSuite struct {
	suite.Suite
	server     *server.Server
	db         *sql.DB
	testConfig *config.Config
	tokenService *auth.TokenService
	blacklistSvc *services.BlacklistService
}

// SetupSuite runs once before all tests
func (suite *LogoutTestSuite) SetupSuite() {
	// Check if PostgreSQL tests are enabled
	if !tests.USE_POSTGRE_DURING_TEST {
		suite.T().Skip("PostgreSQL tests are disabled. Set USE_POSTGRE_DURING_TEST=true to enable.")
	}

	// Load configuration to ensure .env file is loaded
	_, err := config.LoadConfig("")
	if err != nil {
		suite.T().Logf("Warning: Failed to load config: %v", err)
	}

	// Create test database configuration
	dbConfig := config.DatabaseConfig{
		Host:     getEnv("TEST_DB_HOST", getEnv("DB_HOST", "localhost")),
		Port:     getEnvInt("TEST_DB_PORT", getEnvInt("DB_PORT", 5432)),
		User:     getEnv("TEST_DB_USER", getEnv("DB_USER", "postgres")),
		Password: getEnv("TEST_DB_PASSWORD", getEnv("DB_PASSWORD", "postgres123")),
		Name:     getEnv("TEST_DB_NAME", getEnv("DB_NAME", "notes_test")),
		SSLMode:  "disable",
	}

	// Create test database
	db, err := database.CreateTestDatabase(dbConfig)
	require.NoError(suite.T(), err, "Failed to create test database")
	suite.db = db

	// Run migrations
	migrator := database.NewMigrator(db, "../../migrations")
	err = migrator.Up()
	require.NoError(suite.T(), err, "Failed to run test migrations")

	// Load test configuration
	testConfig := &config.Config{
		App: config.AppConfig{
			Environment: "test",
			Debug:       false,
			LogLevel:    "error",
		},
		Server: config.ServerConfig{
			Host:         "localhost",
			Port:         "0", // Random port for testing
			ReadTimeout:  30,
			WriteTimeout: 30,
			IdleTimeout:  120,
		},
		Database: dbConfig,
		Auth: config.AuthConfig{
			JWTSecret:      "test-secret-key-for-jwt-token-generation",
			TokenExpiry:    1,  // 1 hour
			RefreshExpiry:  24, // 24 hours
		},
	}

	suite.testConfig = testConfig

	// Initialize token service
	suite.tokenService = auth.NewTokenService(
		testConfig.Auth.JWTSecret,
		time.Duration(testConfig.Auth.TokenExpiry)*time.Hour,
		time.Duration(testConfig.Auth.RefreshExpiry)*time.Hour,
		"silence-notes",
		"silence-notes-users",
	)

	// Initialize blacklist service
	suite.blacklistSvc = services.NewBlacklistService(suite.db)
	suite.tokenService.SetBlacklist(suite.blacklistSvc)

	// Initialize handlers
	userService := services.NewUserService(suite.db)
	authHandler := handlers.NewAuthHandler(suite.tokenService, userService)
	authHandler.SetBlacklist(suite.blacklistSvc)

	h := &handlers.Handlers{}
	h.SetAuthHandlers(authHandler, nil)

	// Create server
	suite.server = server.NewServer(testConfig, h, suite.db)
}

// TearDownSuite runs once after all tests
func (suite *LogoutTestSuite) TearDownSuite() {
	if suite.db != nil {
		database.DropTestDatabase(suite.db)
	}
}

// SetupTest runs before each test
func (suite *LogoutTestSuite) SetupTest() {
	// Clean up database before each test
	_, err := suite.db.Exec("DELETE FROM blacklisted_tokens")
	require.NoError(suite.T(), err)
	_, err = suite.db.Exec("DELETE FROM user_sessions")
	require.NoError(suite.T(), err)
	_, err = suite.db.Exec("DELETE FROM notes")
	require.NoError(suite.T(), err)
	_, err = suite.db.Exec("DELETE FROM users")
	require.NoError(suite.T(), err)
}

// createTestUser creates a test user and returns tokens
func (suite *LogoutTestSuite) createTestUser() (*models.User, *auth.TokenPair, error) {
	userID := uuid.New()
	googleID := "google_" + userID.String()

	// Insert user
	query := `INSERT INTO users (id, google_id, email, avatar_url, created_at, updated_at)
		VALUES ($1, $2, $3, $4, NOW(), NOW())
		RETURNING id, google_id, email, avatar_url, created_at, updated_at`

	var user models.User
	err := suite.db.QueryRow(query, userID, googleID, "test@example.com", "").Scan(
		&user.ID, &user.GoogleID, &user.Email, &user.AvatarURL, &user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		return nil, nil, err
	}

	// Generate tokens
	tokenPair, err := suite.tokenService.GenerateTokenPair(&user)
	if err != nil {
		return nil, nil, err
	}

	// Parse the token to get the session ID
	ctx := context.Background()
	claims, err := suite.tokenService.ValidateToken(ctx, tokenPair.AccessToken)
	if err != nil {
		return nil, nil, err
	}

	// Create a session in the database for the token
	sessionQuery := `INSERT INTO user_sessions (id, user_id, ip_address, user_agent, created_at, last_seen, is_active)
		VALUES ($1, $2, $3, $4, NOW(), NOW(), true)`
	_, err = suite.db.Exec(sessionQuery, claims.SessionID, user.ID, "192.0.2.1", "test-client/1.0")
	if err != nil {
		return nil, nil, err
	}

	return &user, tokenPair, nil
}

// TestLogout_Success tests that logout successfully adds token to blacklist
func (suite *LogoutTestSuite) TestLogout_Success() {
	_, tokenPair, err := suite.createTestUser()
	require.NoError(suite.T(), err)

	// Make logout request
	req := httptest.NewRequest("DELETE", "/api/v1/auth/logout", nil)
	req.Header.Set("Authorization", "Bearer "+tokenPair.AccessToken)
	req.Header.Set("User-Agent", "test-client/1.0")
	w := httptest.NewRecorder()

	suite.server.GetRouter().ServeHTTP(w, req)

	// Check response
	assert.Equal(suite.T(), http.StatusOK, w.Code)

	// Verify token is in blacklist
	ctx := context.Background()
	claims, err := suite.tokenService.ValidateToken(ctx, tokenPair.AccessToken)
	// Token should be blacklisted, so validation should fail
	assert.Error(suite.T(), err)
	assert.Nil(suite.T(), claims)

	// Direct check in blacklist
	claims, err = suite.tokenService.ValidateToken(context.Background(), tokenPair.AccessToken)
	if err == nil {
		blacklisted, err := suite.blacklistSvc.IsTokenBlacklisted(ctx, claims.ID)
		require.NoError(suite.T(), err)
		assert.True(suite.T(), blacklisted, "Token should be blacklisted after logout")
	}
}

// TestLogout_BlacklistedTokenRejected tests that blacklisted tokens fail validation
func (suite *LogoutTestSuite) TestLogout_BlacklistedTokenRejected() {
	user, tokenPair, err := suite.createTestUser()
	require.NoError(suite.T(), err)

	// Blacklist the token manually
	ctx := context.Background()
	claims, err := suite.tokenService.ValidateToken(ctx, tokenPair.AccessToken)
	require.NoError(suite.T(), err)

	err = suite.blacklistSvc.AddToken(ctx, claims.ID, user.ID.String(), claims.SessionID, claims.ExpiresAt.Time, "logout")
	require.NoError(suite.T(), err)

	// Try to use the blacklisted token
	req := httptest.NewRequest("GET", "/api/v1/notes", nil)
	req.Header.Set("Authorization", "Bearer "+tokenPair.AccessToken)
	req.Header.Set("User-Agent", "test-client/1.0")
	w := httptest.NewRecorder()

	suite.server.GetRouter().ServeHTTP(w, req)

	// Check that request is rejected
	assert.Equal(suite.T(), http.StatusUnauthorized, w.Code)
}

// TestLogout_InvalidClaims tests that logout returns 401 for invalid claims
func (suite *LogoutTestSuite) TestLogout_InvalidClaims() {
	// Make logout request with no user context (token not parsed)
	req := httptest.NewRequest("DELETE", "/api/v1/auth/logout", nil)
	req.Header.Set("Authorization", "Bearer invalid-token")
	req.Header.Set("User-Agent", "test-client/1.0")
	w := httptest.NewRecorder()

	suite.server.GetRouter().ServeHTTP(w, req)

	// Check response - should get 401 from auth middleware
	assert.Equal(suite.T(), http.StatusUnauthorized, w.Code)
}

// TestLogout_InvalidToken tests that logout with invalid token returns 401
func (suite *LogoutTestSuite) TestLogout_InvalidToken() {
	// Make logout request with invalid token
	req := httptest.NewRequest("DELETE", "/api/v1/auth/logout", nil)
	req.Header.Set("Authorization", "Bearer complete-nonsense-token")
	req.Header.Set("User-Agent", "test-client/1.0")
	w := httptest.NewRecorder()

	suite.server.GetRouter().ServeHTTP(w, req)

	// Check response - should get 401 from auth middleware
	assert.Equal(suite.T(), http.StatusUnauthorized, w.Code)
}

// TestLogout_MissingToken tests that logout without token returns 401
func (suite *LogoutTestSuite) TestLogout_MissingToken() {
	// Make logout request without token
	req := httptest.NewRequest("DELETE", "/api/v1/auth/logout", nil)
	req.Header.Set("User-Agent", "test-client/1.0")
	w := httptest.NewRecorder()

	suite.server.GetRouter().ServeHTTP(w, req)

	// Check response - should get 401 from auth middleware
	assert.Equal(suite.T(), http.StatusUnauthorized, w.Code)
}

// Run the test suite
func TestLogoutSuite(t *testing.T) {
	suite.Run(t, new(LogoutTestSuite))
}

// Helper functions for environment variables
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}
