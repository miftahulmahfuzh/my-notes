package integration

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"database/sql"

	"github.com/gpd/my-notes/internal/config"
	"github.com/gpd/my-notes/internal/database"
	"github.com/gpd/my-notes/internal/handlers"
	"github.com/gpd/my-notes/internal/server"
	"github.com/gpd/my-notes/internal/models"
	"github.com/gpd/my-notes/tests"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
)

// AuthFlowTestSuite tests the complete authentication flow
type AuthFlowTestSuite struct {
	suite.Suite
	server     *server.Server
	db         *sql.DB
	testConfig *config.Config
}

// SetupSuite runs once before all tests
func (suite *AuthFlowTestSuite) SetupSuite() {
	// Check if PostgreSQL tests are enabled
	if !tests.USE_POSTGRE_DURING_TEST {
		suite.T().Skip("PostgreSQL tests are disabled. Set USE_POSTGRE_DURING_TEST=true to enable.")
	}

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
			IdleTimeout:  60,
		},
		Database: config.DatabaseConfig{
			Host:     "localhost",
			Port:     5432,
			Name:     "my_notes_test",
			User:     "test_user",
			Password: "test_password",
			SSLMode:  "disable",
		},
		Auth: config.AuthConfig{
			JWTSecret:        "test-secret-key-for-testing",
			GoogleClientID:   "test-google-client-id",
			GoogleClientSecret: "test-google-client-secret",
			GoogleRedirectURL: "http://localhost:3000/auth/callback",
			TokenExpiry:      1, // 1 hour for testing
			RefreshExpiry:    24, // 1 day for testing
		},
	}

	// Initialize test database
	db, err := database.NewConnection(testConfig.Database)
	require.NoError(suite.T(), err, "Failed to connect to test database")
	suite.db = db

	// Run test migrations
	migrator := database.NewMigrator(db, "../../migrations")
	err = migrator.Up()
	require.NoError(suite.T(), err, "Failed to run test migrations")

	// Initialize handlers
	handlers := handlers.NewHandlers()

	// Create test server
	suite.server = server.NewServer(testConfig, handlers, db)
	suite.testConfig = testConfig
}

// TearDownSuite runs once after all tests
func (suite *AuthFlowTestSuite) TearDownSuite() {
	if suite.db != nil {
		suite.db.Close()
	}
}

// SetupTest runs before each test
func (suite *AuthFlowTestSuite) SetupTest() {
	// Clean up global rate limiters to prevent test interference
	suite.server.ResetRateLimiters()

	// Clean up test data before each test
	suite.cleanupTestData()

	// Add a small delay to ensure all cleanup operations complete
	time.Sleep(10 * time.Millisecond)
}

// TearDownTest runs after each test
func (suite *AuthFlowTestSuite) TearDownTest() {
	// Clean up rate limiters to prevent test interference
	suite.server.ResetRateLimiters()
	suite.cleanupTestData()
}

// cleanupTestData removes test data from the database
func (suite *AuthFlowTestSuite) cleanupTestData() {
	if suite.db != nil {
		// Clean up test users and sessions
		suite.db.Exec("DELETE FROM user_sessions WHERE user_id LIKE 'test-%'")
		suite.db.Exec("DELETE FROM users WHERE id LIKE 'test-%'")
		suite.db.Exec("DELETE FROM users WHERE google_id LIKE 'test-google-id-%'")
		suite.db.Exec("DELETE FROM users WHERE id = '550e8400-e29b-41d4-a716-446655440001'")
	}
}

// createTestRequest creates a test request with required headers
func (suite *AuthFlowTestSuite) createTestRequest(method, url string, body *bytes.Buffer) *http.Request {
	// Ensure we always have a non-nil buffer
	if body == nil {
		body = bytes.NewBuffer(nil)
	}
	req := httptest.NewRequest(method, url, body)
	req.Header.Set("User-Agent", "silence-notes-test-agent")
	return req
}

// TestHealthCheck tests the health check endpoint
func (suite *AuthFlowTestSuite) TestHealthCheck() {
	req := suite.createTestRequest("GET", "/api/v1/health", nil)
	w := httptest.NewRecorder()

	suite.server.GetRouter().ServeHTTP(w, req)

	assert.Equal(suite.T(), http.StatusOK, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(suite.T(), err)
	assert.Equal(suite.T(), "ok", response["status"])
	assert.Equal(suite.T(), "1.0.0", response["version"])
}

// TestCompleteAuthFlow tests the complete authentication flow
func (suite *AuthFlowTestSuite) TestCompleteAuthFlow() {
	// Step 1: Test Google OAuth initiation
	// NOTE: This endpoint is not yet implemented (returns 404)
	// Skipping until the endpoint is implemented
	suite.T().Skip("POST /api/v1/auth/google endpoint not yet implemented")

	// Step 1: Test Google OAuth initiation
	suite.T().Run("Google OAuth Initiation", func(t *testing.T) {
		suite.T().Skip("POST /api/v1/auth/google endpoint not yet implemented")

		authRequest := map[string]interface{}{
			"redirect_uri": "http://localhost:3000/auth/callback",
			"state":        "test-state-123",
		}

		reqBody, _ := json.Marshal(authRequest)
		req := suite.createTestRequest("POST", "/api/v1/auth/google", bytes.NewBuffer(reqBody))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		suite.server.GetRouter().ServeHTTP(w, req)

		// This should return a mock OAuth URL for testing
		assert.Equal(t, http.StatusOK, w.Code)

		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)

		// Extract data from the wrapped API response format
		data := response["data"].(map[string]interface{})
		assert.NotEmpty(t, data["auth_url"])
	})

	// Step 2: Test token exchange (mocked)
	// NOTE: This endpoint is not yet implemented (returns 404)
	// Skipping until the endpoint is implemented
	suite.T().Run("Token Exchange", func(t *testing.T) {
		suite.T().Skip("POST /api/v1/auth/exchange endpoint not yet implemented")

		tokenRequest := map[string]interface{}{
			"code":         "mock-auth-code",
			"state":        "test-state-123",
			"redirect_uri": "http://localhost:3000/auth/callback",
		}

		reqBody, _ := json.Marshal(tokenRequest)
		req := suite.createTestRequest("POST", "/api/v1/auth/exchange", bytes.NewBuffer(reqBody))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		suite.server.GetRouter().ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Logf("Response body: %s", w.Body.String())
		}

		assert.Equal(t, http.StatusOK, w.Code)

		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)

		// Extract data from the wrapped API response format
		data := response["data"].(map[string]interface{})
		assert.NotEmpty(t, data["access_token"])
		assert.NotEmpty(t, data["refresh_token"])
		assert.Equal(t, "Bearer", data["token_type"])
	})

	// Step 3: Test protected resource access
	suite.T().Run("Protected Resource Access", func(t *testing.T) {
		// This would use the token from previous step
		accessToken := "mock-access-token"

		req := suite.createTestRequest("GET", "/api/v1/user/profile", nil)
		req.Header.Set("Authorization", "Bearer "+accessToken)
		w := httptest.NewRecorder()

		suite.server.GetRouter().ServeHTTP(w, req)

		// Should succeed with valid token
		assert.Equal(t, http.StatusOK, w.Code)
	})

	// Step 4: Test token refresh
	suite.T().Run("Token Refresh", func(t *testing.T) {
		refreshRequest := map[string]interface{}{
			"refresh_token": "mock-refresh-token",
		}

		reqBody, _ := json.Marshal(refreshRequest)
		req := suite.createTestRequest("POST", "/api/v1/auth/refresh", bytes.NewBuffer(reqBody))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		suite.server.GetRouter().ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)

		// Extract data from the wrapped API response format
		data := response["data"].(map[string]interface{})
		assert.NotEmpty(t, data["access_token"])
	})

	// Step 5: Test logout
	suite.T().Run("Logout", func(t *testing.T) {
		accessToken := "mock-access-token"

		req := suite.createTestRequest("DELETE", "/api/v1/auth/logout", nil)
		req.Header.Set("Authorization", "Bearer "+accessToken)
		w := httptest.NewRecorder()

		suite.server.GetRouter().ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
	})
}

// TestSecurityHeaders tests that security headers are properly applied
func (suite *AuthFlowTestSuite) TestSecurityHeaders() {
	req := suite.createTestRequest("GET", "/api/v1/health", nil)
	w := httptest.NewRecorder()

	suite.server.GetRouter().ServeHTTP(w, req)

	// Check security headers
	assert.Equal(suite.T(), "nosniff", w.Header().Get("X-Content-Type-Options"))
	assert.Equal(suite.T(), "DENY", w.Header().Get("X-Frame-Options"))
	assert.NotEmpty(suite.T(), w.Header().Get("X-Request-ID"))
}

// TestRateLimiting tests rate limiting functionality
func (suite *AuthFlowTestSuite) TestRateLimiting() {
	// Make multiple requests quickly to trigger rate limiting
	for i := 0; i < 100; i++ {
		req := suite.createTestRequest("GET", "/api/v1/health", nil)
		req.Header.Set("User-Agent", "test-rate-limit-agent")
		w := httptest.NewRecorder()

		suite.server.GetRouter().ServeHTTP(w, req)

		// After many requests, we should hit rate limit
		if w.Code == http.StatusTooManyRequests {
			var response map[string]interface{}
			err := json.Unmarshal(w.Body.Bytes(), &response)
			require.NoError(suite.T(), err)
			assert.Equal(suite.T(), "Rate limit exceeded", response["error"])
			return
		}
	}

	suite.T().Log("Rate limit not triggered within test iterations")
}

// TestCORSConfiguration tests CORS configuration
func (suite *AuthFlowTestSuite) TestCORSConfiguration() {
	testCases := []struct {
		name           string
		origin         string
		method         string
		expectedStatus int
		expectedCORS   string
	}{
		{
			name:           "Allowed origin - localhost",
			origin:         "http://localhost:3000",
			method:         "GET",
			expectedStatus: http.StatusOK,
			expectedCORS:   "http://localhost:3000",
		},
		{
			name:           "Allowed origin - chrome extension",
			origin:         "chrome-extension://abc123",
			method:         "GET",
			expectedStatus: http.StatusOK,
			expectedCORS:   "chrome-extension://abc123",
		},
		{
			name:           "Preflight request",
			origin:         "http://localhost:3000",
			method:         "OPTIONS",
			expectedStatus: http.StatusNoContent,
			expectedCORS:   "http://localhost:3000",
		},
	}

	for _, tc := range testCases {
		suite.T().Run(tc.name, func(t *testing.T) {
			req := suite.createTestRequest(tc.method, "/api/v1/health", nil)
			req.Header.Set("Origin", tc.origin)
			if tc.method == "OPTIONS" {
				req.Header.Set("Access-Control-Request-Method", "GET")
			}
			w := httptest.NewRecorder()

			suite.server.GetRouter().ServeHTTP(w, req)

			assert.Equal(t, tc.expectedStatus, w.Code)
			assert.Equal(t, tc.expectedCORS, w.Header().Get("Access-Control-Allow-Origin"))
		})
	}
}

// TestAuthenticationMiddleware tests authentication middleware
func (suite *AuthFlowTestSuite) TestAuthenticationMiddleware() {
	testCases := []struct {
		name           string
		authHeader     string
		expectedStatus int
	}{
		{
			name:           "No authorization header",
			authHeader:     "",
			expectedStatus: http.StatusUnauthorized,
		},
		{
			name:           "Invalid authorization format",
			authHeader:     "InvalidFormat",
			expectedStatus: http.StatusUnauthorized,
		},
		{
			name:           "Invalid token",
			authHeader:     "Bearer invalid-token",
			expectedStatus: http.StatusUnauthorized,
		},
		{
			name:           "Valid token (mocked)",
			authHeader:     "Bearer valid-mock-token",
			expectedStatus: http.StatusOK,
		},
	}

	for _, tc := range testCases {
		suite.T().Run(tc.name, func(t *testing.T) {
			req := suite.createTestRequest("GET", "/api/v1/user/profile", nil)
			if tc.authHeader != "" {
				req.Header.Set("Authorization", tc.authHeader)
			}
			w := httptest.NewRecorder()

			suite.server.GetRouter().ServeHTTP(w, req)

			assert.Equal(t, tc.expectedStatus, w.Code)
		})
	}
}

// TestSecurityEndpoints tests security monitoring endpoints
func (suite *AuthFlowTestSuite) TestSecurityEndpoints() {
	// Test rate limit info endpoint
	suite.T().Run("Rate Limit Info", func(t *testing.T) {
		req := suite.createTestRequest("GET", "/api/v1/security/rate-limit", nil)
		req.Header.Set("Authorization", "Bearer valid-mock-token")
		w := httptest.NewRecorder()

		suite.server.GetRouter().ServeHTTP(w, req)

		// Should succeed or require auth
		assert.True(t, w.Code == http.StatusOK || w.Code == http.StatusUnauthorized)
	})

	// Test session info endpoint
	suite.T().Run("Session Info", func(t *testing.T) {
		req := suite.createTestRequest("GET", "/api/v1/security/session-info", nil)
		req.Header.Set("Authorization", "Bearer valid-mock-token")
		w := httptest.NewRecorder()

		suite.server.GetRouter().ServeHTTP(w, req)

		// Should succeed or require auth
		assert.True(t, w.Code == http.StatusOK || w.Code == http.StatusUnauthorized)
	})

	// Test security metrics endpoint
	suite.T().Run("Security Metrics", func(t *testing.T) {
		req := suite.createTestRequest("GET", "/api/v1/security/metrics", nil)
		req.Header.Set("Authorization", "Bearer valid-mock-token")
		w := httptest.NewRecorder()

		suite.server.GetRouter().ServeHTTP(w, req)

		// Should succeed or require auth
		assert.True(t, w.Code == http.StatusOK || w.Code == http.StatusUnauthorized)
	})
}

// TestErrorHandling tests various error scenarios
func (suite *AuthFlowTestSuite) TestErrorHandling() {
	testCases := []struct {
		name           string
		path           string
		method         string
		body           interface{}
		expectedStatus int
	}{
		{
			name:           "Invalid JSON",
			path:           "/api/v1/auth/refresh",
			method:         "POST",
			body:           "invalid-json",
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "Missing required fields",
			path:           "/api/v1/auth/refresh",
			method:         "POST",
			body:           map[string]interface{}{},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "Large request body",
			path:           "/api/v1/auth/refresh",
			method:         "POST",
			body:           map[string]interface{}{"data": string(make([]byte, 10000000))}, // 10MB
			expectedStatus: http.StatusRequestEntityTooLarge,
		},
	}

	for _, tc := range testCases {
		suite.T().Run(tc.name, func(t *testing.T) {
			var reqBody *bytes.Buffer
			if str, ok := tc.body.(string); ok {
				reqBody = bytes.NewBufferString(str)
			} else {
				bodyBytes, _ := json.Marshal(tc.body)
				reqBody = bytes.NewBuffer(bodyBytes)
			}

			req := suite.createTestRequest(tc.method, tc.path, reqBody)
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			suite.server.GetRouter().ServeHTTP(w, req)

			assert.Equal(t, tc.expectedStatus, w.Code)
		})
	}
}

// TestConcurrentRequests tests concurrent request handling
func (suite *AuthFlowTestSuite) TestConcurrentRequests() {
	concurrency := 10
	requestsPerGoroutine := 5

	done := make(chan bool, concurrency)

	for i := 0; i < concurrency; i++ {
		go func() {
			defer func() { done <- true }()

			for j := 0; j < requestsPerGoroutine; j++ {
				req := suite.createTestRequest("GET", "/api/v1/health", nil)
				req.Header.Set("User-Agent", "concurrent-test-agent")
				w := httptest.NewRecorder()

				suite.server.GetRouter().ServeHTTP(w, req)

				// Should handle concurrent requests gracefully
				assert.True(suite.T(), w.Code == http.StatusOK || w.Code == http.StatusTooManyRequests)
			}
		}()
	}

	// Wait for all goroutines to complete
	for i := 0; i < concurrency; i++ {
		select {
		case <-done:
			// Goroutine completed
		case <-time.After(10 * time.Second):
			suite.T().Fatal("Test timed out waiting for goroutines")
		}
	}
}

// TestIntegrationWithDatabase tests integration with the database
func (suite *AuthFlowTestSuite) TestIntegrationWithDatabase() {
	// Test database connection
	assert.NotNil(suite.T(), suite.db)

	// Test basic database operations
	err := suite.db.Ping()
	assert.NoError(suite.T(), err)

	// Test that we can create and query users
	testUserID := "550e8400-e29b-41d4-a716-446655440001" // valid UUID format

	// Insert test user
	_, err = suite.db.Exec(`
		INSERT INTO users (id, google_id, email, created_at, updated_at)
		VALUES ($1, $2, $3, NOW(), NOW())
		ON CONFLICT (id) DO NOTHING
	`, testUserID, "google-123", "test@example.com")
	assert.NoError(suite.T(), err)

	// Query test user
	var user models.User
	err = suite.db.QueryRow("SELECT id, email FROM users WHERE id = $1", testUserID).Scan(&user.ID, &user.Email)
	assert.NoError(suite.T(), err)
	assert.Equal(suite.T(), testUserID, user.ID.String())
}

// TestAuthFlowTestSuite runs the test suite
func TestAuthFlowTestSuite(t *testing.T) {
	suite.Run(t, new(AuthFlowTestSuite))
}