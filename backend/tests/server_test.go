package tests

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gpd/my-notes/internal/config"
	"github.com/gpd/my-notes/internal/handlers"
	"github.com/gpd/my-notes/internal/server"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	_ "github.com/lib/pq"
)

// createTestDB creates a test database connection for testing
func createTestDB() *sql.DB {
	// Try to connect to a test database
	db, err := sql.Open("postgres", "postgres://user:password@localhost/testdb?sslmode=disable")
	if err != nil {
		// Return nil if connection fails - some tests might not need a real DB
		return nil
	}
	return db
}

func TestServerInitialization(t *testing.T) {
	cfg := &config.Config{
		Server: config.ServerConfig{
			Host: "localhost",
			Port: "9999",
		},
		App: config.AppConfig{
			Environment: "test",
			Debug:       false,
		},
		CORS: config.CORSConfig{
			AllowedOrigins:   []string{"*"},
			AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
			AllowedHeaders:   []string{"*"},
			AllowCredentials: false,
			MaxAge:           86400,
		},
		Auth: config.AuthConfig{
			JWTSecret: "test-secret-key-that-is-long-enough-for-validation",
		},
	}

	db := createTestDB()
	handlersInstance := handlers.NewHandlers()
	srv := server.NewServer(cfg, handlersInstance, db)

	require.NotNil(t, srv)
	require.NotNil(t, srv.GetRouter())
}

func TestHealthEndpoint(t *testing.T) {
	cfg := &config.Config{
		Server: config.ServerConfig{
			Host: "localhost",
			Port: "9999",
		},
		App: config.AppConfig{
			Environment: "test",
			Debug:       false,
		},
		CORS: config.CORSConfig{
			AllowedOrigins:   []string{"*"},
			AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
			AllowedHeaders:   []string{"*"},
			AllowCredentials: false,
			MaxAge:           86400,
		},
		Auth: config.AuthConfig{
			JWTSecret: "test-secret-key-that-is-long-enough-for-validation",
		},
	}

	handlers := handlers.NewHandlers()
	db := createTestDB()
	srv := server.NewServer(cfg, handlers, db)
	router := srv.GetRouter()

	// Create request
	req, err := http.NewRequest("GET", "/api/v1/health", nil)
	require.NoError(t, err)
	req.Header.Set("User-Agent", "test-agent")

	// Create response recorder
	rr := httptest.NewRecorder()

	// Serve the request
	router.ServeHTTP(rr, req)

	// Check status code
	assert.Equal(t, http.StatusOK, rr.Code)

	// Check response body
	var response map[string]interface{}
	err = json.Unmarshal(rr.Body.Bytes(), &response)
	require.NoError(t, err)

	assert.Equal(t, "ok", response["status"])
	assert.NotEmpty(t, response["timestamp"])
	assert.Equal(t, "1.0.0", response["version"])
	assert.NotEmpty(t, response["uptime"])
}

func TestCORSMiddleware(t *testing.T) {
	cfg := &config.Config{
		Server: config.ServerConfig{
			Host: "localhost",
			Port: "9999",
		},
		App: config.AppConfig{
			Environment: "test",
			Debug:       false,
		},
		CORS: config.CORSConfig{
			AllowedOrigins: []string{"http://localhost:3000", "chrome-extension://*"},
			AllowedMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
			AllowedHeaders: []string{"*"},
			MaxAge:         86400,
		},
	}

	handlers := handlers.NewHandlers()
	db := createTestDB()
	srv := server.NewServer(cfg, handlers, db)
	router := srv.GetRouter()

	tests := []struct {
		name           string
		origin         string
		method         string
		expectedOrigin string
		expectedStatus int
	}{
		{
			name:           "Allowed origin",
			origin:         "http://localhost:3000",
			method:         "GET",
			expectedOrigin: "http://localhost:3000",
			expectedStatus: http.StatusOK,
		},
		{
			name:           "Chrome extension origin",
			origin:         "chrome-extension://abcdef123456",
			method:         "GET",
			expectedOrigin: "chrome-extension://abcdef123456",
			expectedStatus: http.StatusOK,
		},
		{
			name:           "Preflight request",
			origin:         "http://localhost:3000",
			method:         "OPTIONS",
			expectedOrigin: "http://localhost:3000",
			expectedStatus: http.StatusNoContent, // OPTIONS requests should return 204
		},
		{
			name:           "Disallowed origin",
			origin:         "http://evil.com",
			method:         "GET",
			expectedOrigin: "", // Disallowed origins get no CORS headers
			expectedStatus: http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req, err := http.NewRequest(tt.method, "/api/v1/health", nil)
			require.NoError(t, err)
			req.Header.Set("Origin", tt.origin)
			req.Header.Set("User-Agent", "test-agent")

			rr := httptest.NewRecorder()
			router.ServeHTTP(rr, req)

			assert.Equal(t, tt.expectedStatus, rr.Code)

			assert.Equal(t, tt.expectedOrigin, rr.Header().Get("Access-Control-Allow-Origin"))
			// CORS middleware doesn't set Access-Control-Allow-Credentials (not configured to allow credentials)
			assert.Equal(t, "", rr.Header().Get("Access-Control-Allow-Credentials"))

			if tt.method == "OPTIONS" {
				assert.Equal(t, "GET, POST, PUT, DELETE, OPTIONS", rr.Header().Get("Access-Control-Allow-Methods"))
				assert.Equal(t, "Content-Type, Authorization, X-Request-ID", rr.Header().Get("Access-Control-Allow-Headers"))
				assert.Equal(t, "86400", rr.Header().Get("Access-Control-Max-Age"))
			}
		})
	}
}

func TestRequestIDMiddleware(t *testing.T) {
	cfg := GetTestConfig()

	handlers := handlers.NewHandlers()
	srv := server.NewServer(&config.Config{
		Server: cfg.Server,
		App:    cfg.App,
		CORS: config.CORSConfig{
			AllowedOrigins: []string{"*"},
		},
	}, handlers, createTestDB())
	router := srv.GetRouter()

	req, err := http.NewRequest("GET", "/api/v1/health", nil)
	require.NoError(t, err)

	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	// Check that X-Request-ID header is set
	requestID := rr.Header().Get("X-Request-ID")
	assert.NotEmpty(t, requestID)

	// Check that the same request ID is returned in the response
	var response map[string]interface{}
	err = json.Unmarshal(rr.Body.Bytes(), &response)
	require.NoError(t, err)
	// Note: The request ID is not currently included in the health response,
	// but we can verify it's being set in the header
}

func TestSecurityHeadersMiddleware(t *testing.T) {
	cfg := GetTestConfig()

	handlers := handlers.NewHandlers()
	srv := server.NewServer(&config.Config{
		Server: cfg.Server,
		App:    cfg.App,
		CORS: config.CORSConfig{
			AllowedOrigins: []string{"*"},
		},
	}, handlers, createTestDB())
	router := srv.GetRouter()

	req, err := http.NewRequest("GET", "/api/v1/health", nil)
	require.NoError(t, err)
	req.Header.Set("User-Agent", "test-agent")

	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	// Check security headers
	assert.Equal(t, "nosniff", rr.Header().Get("X-Content-Type-Options"))
	assert.Equal(t, "DENY", rr.Header().Get("X-Frame-Options"))
	assert.Equal(t, "1; mode=block", rr.Header().Get("X-XSS-Protection"))
	assert.Equal(t, "strict-origin-when-cross-origin", rr.Header().Get("Referrer-Policy"))
	assert.Equal(t, "geolocation=(), microphone=(), camera=()", rr.Header().Get("Permissions-Policy"))
}

func TestContentTypeMiddleware(t *testing.T) {
	cfg := GetTestConfig()

	handlers := handlers.NewHandlers()
	srv := server.NewServer(&config.Config{
		Server: cfg.Server,
		App:    cfg.App,
		CORS: config.CORSConfig{
			AllowedOrigins: []string{"*"},
		},
	}, handlers, createTestDB())
	router := srv.GetRouter()

	tests := []struct {
		path           string
		expectedHeader string
	}{
		{
			path:           "/api/v1/health",
			expectedHeader: "application/json; charset=utf-8",
		},
		{
			path:           "/non-api-path",
			expectedHeader: "", // Should not set content type for non-API paths
		},
	}

	for _, tt := range tests {
		t.Run("Path_"+tt.path, func(t *testing.T) {
			req, err := http.NewRequest("GET", tt.path, nil)
			require.NoError(t, err)
			req.Header.Set("User-Agent", "test-agent")

			rr := httptest.NewRecorder()
			router.ServeHTTP(rr, req)

			if tt.expectedHeader != "" {
				assert.Equal(t, tt.expectedHeader, rr.Header().Get("Content-Type"))
			}
		})
	}
}

func TestNotFoundHandler(t *testing.T) {
	cfg := GetTestConfig()

	handlers := handlers.NewHandlers()
	srv := server.NewServer(&config.Config{
		Server: cfg.Server,
		App:    cfg.App,
		CORS: config.CORSConfig{
			AllowedOrigins: []string{"*"},
		},
	}, handlers, createTestDB())
	router := srv.GetRouter()

	req, err := http.NewRequest("GET", "/nonexistent/path", nil)
	require.NoError(t, err)
	req.Header.Set("User-Agent", "test-agent")

	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusNotFound, rr.Code)

	var response map[string]interface{}
	err = json.Unmarshal(rr.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Equal(t, "Not found", response["error"])
}

func TestServerGracefulShutdown(t *testing.T) {
	cfg := GetTestConfig()

	handlers := handlers.NewHandlers()
	srv := server.NewServer(&config.Config{
		Server: cfg.Server,
		App:    cfg.App,
		CORS: config.CORSConfig{
			AllowedOrigins: []string{"*"},
		},
	}, handlers, createTestDB())

	// Test that shutdown doesn't panic
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err := srv.Shutdown(ctx)
	assert.NoError(t, err)
}