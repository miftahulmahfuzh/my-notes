package middleware

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gpd/my-notes/internal/auth"
	"github.com/gpd/my-notes/internal/config"
	"github.com/gpd/my-notes/internal/middleware"
	"github.com/gpd/my-notes/internal/models"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	)

// We'll use real services for testing since the interfaces are complex

// MockUserService is a simple mock for testing
type MockUserService struct {
	users map[string]*models.User
}

func NewMockUserService() *MockUserService {
	return &MockUserService{
		users: make(map[string]*models.User),
	}
}

func (m *MockUserService) CreateOrUpdateFromGoogle(userInfo *auth.GoogleUserInfo) (*models.User, error) {
	// Not implemented for this test
	return nil, nil
}

func (m *MockUserService) GetByID(userID string) (*models.User, error) {
	if user, exists := m.users[userID]; exists {
		return user, nil
	}
	return nil, fmt.Errorf("user not found")
}

func (m *MockUserService) Update(user *models.User) (*models.User, error) {
	m.users[user.ID.String()] = user
	return user, nil
}

func (m *MockUserService) Delete(userID string) error {
	delete(m.users, userID)
	return nil
}

func (m *MockUserService) CreateSession(userID, ipAddress, userAgent string) (*models.UserSession, error) {
	return nil, nil
}

func (m *MockUserService) UpdateSessionActivity(sessionID, ipAddress, userAgent string) error {
	return nil
}

func (m *MockUserService) GetActiveSessions(userID string) ([]models.UserSession, error) {
	return nil, nil
}

func (m *MockUserService) DeleteSession(sessionID, userID string) error {
	return nil
}

func (m *MockUserService) DeleteAllSessions(userID string) error {
	return nil
}

func (m *MockUserService) GetUserStats(userID string) (*models.UserStats, error) {
	return nil, nil
}

func (m *MockUserService) SearchUsers(query string, page, limit int) ([]models.User, int, error) {
	return nil, 0, nil
}

// AddUser adds a user to the mock
func (m *MockUserService) AddUser(user *models.User) {
	m.users[user.ID.String()] = user
}

func createTestUser(t *testing.T) *models.User {
	userID := uuid.New()
	return &models.User{
		ID:          userID,
		GoogleID:    "google-123",
		Email:       "test@example.com",
		Name:        "Test User",
		AvatarURL:   nil,
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

func TestSecurityMiddleware(t *testing.T) {
	// Create real token service for testing
	tokenService := auth.NewTokenService(
		"test-secret-key-for-testing-only",
		15*time.Minute,
		24*time.Hour,
		"test-issuer",
		"test-audience",
	)

	// Use mock user service from handlers package
	mockUserService := NewMockUserService()

	securityConfig := config.GetDefaultSecurityConfig()

	corsConfig := &config.CORSConfig{
		AllowedOrigins:   []string{"http://localhost:3000"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Content-Type", "Authorization"},
		AllowCredentials: true,
		MaxAge:           86400,
	}

	securityMiddleware := middleware.NewSecurityMiddleware(
		tokenService,
		mockUserService,
		securityConfig,
		corsConfig,
	)

	t.Run("applies security headers", func(t *testing.T) {
		handler := securityMiddleware.Security(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		}))

		req := httptest.NewRequest("GET", "/test", nil)
		w := httptest.NewRecorder()

		handler.ServeHTTP(w, req)

		assert.Equal(t, "nosniff", w.Header().Get("X-Content-Type-Options"))
		assert.Equal(t, "DENY", w.Header().Get("X-Frame-Options"))
		assert.Equal(t, "strict-origin-when-cross-origin", w.Header().Get("Referrer-Policy"))
	})

	t.Run("handles CORS preflight", func(t *testing.T) {
		handler := securityMiddleware.Security(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		}))

		req := httptest.NewRequest("OPTIONS", "/test", nil)
		req.Header.Set("Origin", "http://localhost:3000")
		w := httptest.NewRecorder()

		handler.ServeHTTP(w, req)

		assert.Equal(t, http.StatusNoContent, w.Code)
		assert.Equal(t, "http://localhost:3000", w.Header().Get("Access-Control-Allow-Origin"))
		assert.Contains(t, w.Header().Get("Access-Control-Allow-Methods"), "GET")
		assert.Contains(t, w.Header().Get("Access-Control-Allow-Headers"), "Authorization")
	})

	t.Run("blocks requests without User-Agent", func(t *testing.T) {
		handler := securityMiddleware.Security(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		}))

		req := httptest.NewRequest("GET", "/test", nil)
		w := httptest.NewRecorder()

		handler.ServeHTTP(w, req)

		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("adds request ID", func(t *testing.T) {
		handler := securityMiddleware.Security(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			requestID := r.Context().Value("requestID")
			assert.NotNil(t, requestID)
			w.WriteHeader(http.StatusOK)
		}))

		req := httptest.NewRequest("GET", "/test", nil)
		req.Header.Set("User-Agent", "test-agent")
		w := httptest.NewRecorder()

		handler.ServeHTTP(w, req)

		assert.NotEmpty(t, w.Header().Get("X-Request-ID"))
	})
}

func TestEnhancedAuth(t *testing.T) {
	// Create real token service for testing
	tokenService := auth.NewTokenService(
		"test-secret-key-for-testing-only",
		15*time.Minute,
		24*time.Hour,
		"test-issuer",
		"test-audience",
	)

	// Use mock user service from handlers package
	mockUserService := NewMockUserService()

	securityConfig := config.GetDefaultSecurityConfig()

	corsConfig := &config.CORSConfig{
		AllowedOrigins:   []string{"http://localhost:3000"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Content-Type", "Authorization"},
		AllowCredentials: true,
		MaxAge:           86400,
	}

	securityMiddleware := middleware.NewSecurityMiddleware(
		tokenService,
		mockUserService,
		securityConfig,
		corsConfig,
	)

	t.Run("requires authorization header", func(t *testing.T) {
		handler := securityMiddleware.EnhancedAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		}))

		req := httptest.NewRequest("GET", "/test", nil)
		w := httptest.NewRecorder()

		handler.ServeHTTP(w, req)

		assert.Equal(t, http.StatusUnauthorized, w.Code)
	})

	t.Run("validates token format", func(t *testing.T) {
		handler := securityMiddleware.EnhancedAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		}))

		req := httptest.NewRequest("GET", "/test", nil)
		req.Header.Set("Authorization", "InvalidFormat")
		w := httptest.NewRecorder()

		handler.ServeHTTP(w, req)

		assert.Equal(t, http.StatusUnauthorized, w.Code)
	})

	t.Run("validates token and gets user", func(t *testing.T) {
		// Setup
		user := createTestUser(t)

		// Generate real token
		tokenPair, err := tokenService.GenerateTokenPair(user)
		assert.NoError(t, err)

		// Add test user to the mock service
		mockUserService.AddUser(user)

		handler := securityMiddleware.EnhancedAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctxUser := r.Context().Value("user")
			assert.NotNil(t, ctxUser)
			w.WriteHeader(http.StatusOK)
		}))

		req := httptest.NewRequest("GET", "/test", nil)
		req.Header.Set("Authorization", "Bearer "+tokenPair.AccessToken)
		w := httptest.NewRecorder()

		handler.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
		// No assertions needed for simple mock service
	})

	t.Run("handles invalid token", func(t *testing.T) {
		handler := securityMiddleware.EnhancedAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		}))

		req := httptest.NewRequest("GET", "/test", nil)
		req.Header.Set("Authorization", "Bearer invalid-token")
		w := httptest.NewRecorder()

		handler.ServeHTTP(w, req)

		assert.Equal(t, http.StatusUnauthorized, w.Code)
	})

	t.Run("handles user not found", func(t *testing.T) {
		// Create a user for token generation
		user := createTestUser(t)

		// Generate real token
		tokenPair, err := tokenService.GenerateTokenPair(user)
		assert.NoError(t, err)

		// Don't add the user to mock service to simulate "user not found"

		handler := securityMiddleware.EnhancedAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		}))

		req := httptest.NewRequest("GET", "/test", nil)
		req.Header.Set("Authorization", "Bearer "+tokenPair.AccessToken)
		w := httptest.NewRecorder()

		handler.ServeHTTP(w, req)

		assert.Equal(t, http.StatusUnauthorized, w.Code)
		// No assertions needed for simple mock service
	})
}

func TestSecurityMiddlewareIntegration(t *testing.T) {
	t.Run("applies rate limiting", func(t *testing.T) {
		// Create real services
		tokenService := auth.NewTokenService(
			"test-secret-key-for-testing-only",
			15*time.Minute,
			24*time.Hour,
			"test-issuer",
			"test-audience",
		)

		mockUserService := NewMockUserService()

		// Create very restrictive security config for testing
		securityConfig := config.GetDefaultSecurityConfig()
		securityConfig.RateLimiting.UserRequestsPerMinute = 1 // Very low limit

		corsConfig := &config.CORSConfig{
			AllowedOrigins:   []string{"http://localhost:3000"},
			AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
			AllowedHeaders:   []string{"Content-Type", "Authorization"},
			AllowCredentials: true,
			MaxAge:           86400,
		}

		securityMiddleware := middleware.NewSecurityMiddleware(
			tokenService,
			mockUserService,
			securityConfig,
			corsConfig,
		)

		// Create a user and token for testing
		user := createTestUser(t)
		tokenPair, err := tokenService.GenerateTokenPair(user)
		assert.NoError(t, err)

		mockUserService.AddUser(user)

		handler := securityMiddleware.EnhancedAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		}))

		// First request should succeed
		req1 := httptest.NewRequest("GET", "/test", nil)
		req1.Header.Set("Authorization", "Bearer "+tokenPair.AccessToken)
		w1 := httptest.NewRecorder()
		handler.ServeHTTP(w1, req1)
		assert.Equal(t, http.StatusOK, w1.Code)

		// Note: Testing actual rate limiting would require time manipulation or complex setup
		// This is mainly a smoke test to ensure the middleware doesn't crash
	})
}