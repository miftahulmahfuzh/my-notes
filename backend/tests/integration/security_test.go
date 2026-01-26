package integration

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gpd/my-notes/tests"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
)

// SecurityTestSuite tests security features
type SecurityTestSuite struct {
	AuthFlowTestSuite
}

// SetupSuite runs once before all security tests
func (suite *SecurityTestSuite) SetupSuite() {
	// Check if PostgreSQL tests are enabled
	if !tests.USE_POSTGRE_DURING_TEST {
		suite.T().Skip("PostgreSQL tests are disabled. Set USE_POSTGRE_DURING_TEST=true to enable.")
	}

	// Call parent SetupSuite
	suite.AuthFlowTestSuite.SetupSuite()
}

// createTestRequest creates a test request with required headers
func (suite *SecurityTestSuite) createTestRequest(method, url string, body *bytes.Buffer) *http.Request {
	// Ensure we always have a non-nil buffer
	if body == nil {
		body = bytes.NewBuffer(nil)
	}
	req := httptest.NewRequest(method, url, body)
	req.Header.Set("User-Agent", "silence-notes-security-test-agent")
	return req
}

// TestSecurityHeaders tests comprehensive security headers
func (suite *SecurityTestSuite) TestSecurityHeaders() {
	testCases := []struct {
		name          string
		endpoint      string
		expectedHeaders map[string]string
	}{
		{
			name:     "Health endpoint headers",
			endpoint: "/api/v1/health",
			expectedHeaders: map[string]string{
				"X-Content-Type-Options": "nosniff",
				"X-Frame-Options":        "DENY",
				"Referrer-Policy":        "strict-origin-when-cross-origin",
			},
		},
		{
			name:     "Protected endpoint headers",
			endpoint: "/api/v1/notes",
			expectedHeaders: map[string]string{
				"X-Content-Type-Options": "nosniff",
				"X-Frame-Options":        "DENY",
				"Referrer-Policy":        "strict-origin-when-cross-origin",
			},
		},
	}

	for _, tc := range testCases {
		suite.T().Run(tc.name, func(t *testing.T) {
			req := suite.createTestRequest("GET", tc.endpoint, nil)
			w := httptest.NewRecorder()

			suite.server.GetRouter().ServeHTTP(w, req)

			for header, expectedValue := range tc.expectedHeaders {
				assert.Equal(t, expectedValue, w.Header().Get(header),
					"Header %s should have value %s", header, expectedValue)
			}

			// Request ID should always be present
			assert.NotEmpty(t, w.Header().Get("X-Request-ID"))
		})
	}
}

// TestInputValidation tests input validation and sanitization
func (suite *SecurityTestSuite) TestInputValidation() {
	testCases := []struct {
		name           string
		endpoint       string
		method         string
		body           interface{}
		expectedStatus int
		expectedError  string
	}{
		{
			name:           "SQL injection attempt in auth request",
			endpoint:       "/api/v1/auth/refresh",
			method:         "POST",
			body:           map[string]interface{}{"refresh_token": "'; DROP TABLE users; --"},
			expectedStatus: http.StatusUnauthorized,
		},
		{
			name:           "XSS attempt in auth request",
			endpoint:       "/api/v1/auth/refresh",
			method:         "POST",
			body:           map[string]interface{}{"refresh_token": "<script>alert('xss')</script>"},
			expectedStatus: http.StatusUnauthorized,
		},
		{
			name:           "Malicious JSON with null bytes",
			endpoint:       "/api/v1/auth/refresh",
			method:         "POST",
			body:           map[string]interface{}{"refresh_token": "test\x00value"},
			expectedStatus: http.StatusUnauthorized,
		},
		{
			name:           "Oversized payload",
			endpoint:       "/api/v1/auth/refresh",
			method:         "POST",
			body:           map[string]interface{}{"refresh_token": strings.Repeat("A", 2000000)}, // 2MB
			expectedStatus: http.StatusRequestEntityTooLarge,
		},
	}

	for _, tc := range testCases {
		suite.T().Run(tc.name, func(t *testing.T) {
			var reqBody *bytes.Buffer
			if str, ok := tc.body.(string); ok {
				reqBody = bytes.NewBufferString(str)
			} else {
				bodyBytes, err := json.Marshal(tc.body)
				require.NoError(t, err)
				reqBody = bytes.NewBuffer(bodyBytes)
			}

			req := suite.createTestRequest(tc.method, tc.endpoint, reqBody)
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			suite.server.GetRouter().ServeHTTP(w, req)

			assert.Equal(t, tc.expectedStatus, w.Code)
		})
	}
}

// TestRateLimitingBypass attempts to bypass rate limiting
func (suite *SecurityTestSuite) TestRateLimitingBypass() {
	suite.T().Run("Multiple IP addresses", func(t *testing.T) {
		// Try to bypass rate limiting using different IP headers
		ipHeaders := []string{
			"X-Forwarded-For",
			"X-Real-IP",
			"X-Client-IP",
		}

		for _, header := range ipHeaders {
			for i := 0; i < 10; i++ {
				req := suite.createTestRequest("GET", "/api/v1/health", nil)
				req.Header.Set("User-Agent", "rate-limit-test")
				req.Header.Set(header, "192.168.1."+string(rune(100+i)))
				w := httptest.NewRecorder()

				suite.server.GetRouter().ServeHTTP(w, req)

				// Should still be rate limited eventually
				if w.Code == http.StatusTooManyRequests {
					return
				}
			}
		}

		t.Log("Rate limiting bypass test completed")
	})

	suite.T().Run("User-Agent rotation", func(t *testing.T) {
		userAgents := []string{
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
			"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
		}

		for _, ua := range userAgents {
			for i := 0; i < 20; i++ {
				req := suite.createTestRequest("GET", "/api/v1/health", nil)
				req.Header.Set("User-Agent", ua)
				w := httptest.NewRecorder()

				suite.server.GetRouter().ServeHTTP(w, req)

				if w.Code == http.StatusTooManyRequests {
					return
				}
			}
		}

		t.Log("User-Agent rotation test completed")
	})
}

// TestAuthenticationBypass attempts to bypass authentication
func (suite *SecurityTestSuite) TestAuthenticationBypass() {
	testCases := []struct {
		name           string
		authHeader     string
		expectedStatus int
	}{
		{
			name:           "No token",
			authHeader:     "",
			expectedStatus: http.StatusUnauthorized,
		},
		{
			name:           "Empty Bearer token",
			authHeader:     "Bearer ",
			expectedStatus: http.StatusUnauthorized,
		},
		{
			name:           "Multiple Bearer tokens",
			authHeader:     "Bearer token1,Bearer token2",
			expectedStatus: http.StatusUnauthorized,
		},
		{
			name:           "Wrong scheme",
			authHeader:     "Basic dGVzdDp0ZXN0", // base64 encoded "test:test"
			expectedStatus: http.StatusUnauthorized,
		},
		{
			name:           "Malformed token",
			authHeader:     "Bearer not.a.valid.jwt",
			expectedStatus: http.StatusUnauthorized,
		},
		{
			name:           "Expired token (simulated)",
			authHeader:     "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.invalid",
			expectedStatus: http.StatusUnauthorized,
		},
	}

	for _, tc := range testCases {
		suite.T().Run(tc.name, func(t *testing.T) {
			req := suite.createTestRequest("GET", "/api/v1/notes", nil)
			if tc.authHeader != "" {
				req.Header.Set("Authorization", tc.authHeader)
			}
			w := httptest.NewRecorder()

			suite.server.GetRouter().ServeHTTP(w, req)

			assert.Equal(t, tc.expectedStatus, w.Code)
		})
	}
}

// TestCSRFProtection tests CSRF protection measures
func (suite *SecurityTestSuite) TestCSRFProtection() {
	suite.T().Run("Cross-origin request without proper headers", func(t *testing.T) {
		req := suite.createTestRequest("POST", "/api/v1/auth/refresh", nil)
		req.Header.Set("Origin", "http://malicious-site.com")
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		suite.server.GetRouter().ServeHTTP(w, req)

		// Should be blocked or not have proper CORS headers
		assert.NotEqual(t, http.StatusOK, w.Code)
	})

	suite.T().Run("Missing Content-Type on POST", func(t *testing.T) {
		req := suite.createTestRequest("POST", "/api/v1/auth/refresh", nil)
		req.Header.Set("Authorization", "Bearer mock-token")
		// Intentionally not setting Content-Type
		w := httptest.NewRecorder()

		suite.server.GetRouter().ServeHTTP(w, req)

		// Should be rejected
		assert.NotEqual(t, http.StatusOK, w.Code)
	})
}

// TestSessionSecurity tests session security features
func (suite *SecurityTestSuite) TestSessionSecurity() {
	suite.T().Run("Session fixation prevention", func(t *testing.T) {
		// Simulate session fixation attempt
		req := suite.createTestRequest("GET", "/api/v1/notes", nil)
		req.Header.Set("Authorization", "Bearer mock-token")
		req.Header.Set("Cookie", "session-id=attacker-controlled-session")
		w := httptest.NewRecorder()

		suite.server.GetRouter().ServeHTTP(w, req)

		// Session should be regenerated or invalidated
		// This test would need to be enhanced based on actual session handling
		if w.Code == http.StatusOK {
			// Check that session cookie is not the same
			setCookieHeader := w.Header().Get("Set-Cookie")
			if setCookieHeader != "" {
				assert.NotContains(t, setCookieHeader, "attacker-controlled-session")
			}
		}
	})
}

// TestSecurityMonitoring tests security event monitoring
func (suite *SecurityTestSuite) TestSecurityMonitoring() {
	suite.T().Run("Security events logged", func(t *testing.T) {
		// Trigger various security events
		events := []struct {
			name   string
			action func()
		}{
			{
				name: "Failed authentication",
				action: func() {
					req := suite.createTestRequest("GET", "/api/v1/notes", nil)
					req.Header.Set("Authorization", "Bearer invalid-token")
					w := httptest.NewRecorder()
					suite.server.GetRouter().ServeHTTP(w, req)
				},
			},
			{
				name: "Rate limit exceeded",
				action: func() {
					for i := 0; i < 200; i++ {
						req := suite.createTestRequest("GET", "/api/v1/health", nil)
						req.Header.Set("User-Agent", "security-monitor-test")
						w := httptest.NewRecorder()
						suite.server.GetRouter().ServeHTTP(w, req)
						if w.Code == http.StatusTooManyRequests {
							break
						}
					}
				},
			},
			{
				name: "Missing User-Agent",
				action: func() {
					req := suite.createTestRequest("GET", "/api/v1/health", nil)
					// Remove User-Agent header to test missing header scenario
					req.Header.Del("User-Agent")
					w := httptest.NewRecorder()
					suite.server.GetRouter().ServeHTTP(w, req)
				},
			},
		}

		for _, event := range events {
			t.Run(event.name, func(t *testing.T) {
				event.action()
				// Security events should be logged
				// This would require checking logs or monitoring endpoints
			})
		}
	})
}

// TestErrorInformationLeakage tests that errors don't leak sensitive information
func (suite *SecurityTestSuite) TestErrorInformationLeakage() {
	testCases := []struct {
		name       string
		endpoint   string
		method     string
		body       interface{}
		authHeader string
	}{
		{
			name:       "Invalid token error",
			endpoint:   "/api/v1/notes",
			method:     "GET",
			body:       nil,
			authHeader: "Bearer invalid-token",
		},
		{
			name:       "Malformed request error",
			endpoint:   "/api/v1/auth/refresh",
			method:     "POST",
			body:       "invalid-json",
			authHeader: "",
		},
		{
			name:       "Missing fields error",
			endpoint:   "/api/v1/auth/refresh",
			method:     "POST",
			body:       map[string]interface{}{},
			authHeader: "",
		},
	}

	for _, tc := range testCases {
		suite.T().Run(tc.name, func(t *testing.T) {
			var reqBody *bytes.Buffer
			if str, ok := tc.body.(string); ok {
				reqBody = bytes.NewBufferString(str)
			} else if tc.body != nil {
				bodyBytes, err := json.Marshal(tc.body)
				require.NoError(t, err)
				reqBody = bytes.NewBuffer(bodyBytes)
			}

			// Ensure we always have a non-nil buffer
			if reqBody == nil {
				reqBody = bytes.NewBuffer(nil)
			}

			req := httptest.NewRequest(tc.method, tc.endpoint, reqBody)
			req.Header.Set("User-Agent", "test-agent")
			if tc.authHeader != "" {
				req.Header.Set("Authorization", tc.authHeader)
			}
			if tc.body != nil {
				req.Header.Set("Content-Type", "application/json")
			}
			w := httptest.NewRecorder()

			suite.server.GetRouter().ServeHTTP(w, req)

			// Parse error response
			var response map[string]interface{}
			err := json.Unmarshal(w.Body.Bytes(), &response)
			require.NoError(t, err)

			// Check that error messages don't leak sensitive information
			if errorMsg, ok := response["error"].(string); ok {
				// Should not contain sensitive information
				sensitiveTerms := []string{
					"password", "secret", "key", "token", "database",
					"internal", "stack trace", "file path", "sql",
				}

				errorMsgLower := strings.ToLower(errorMsg)
				for _, term := range sensitiveTerms {
					assert.NotContains(t, errorMsgLower, term,
						"Error message contains sensitive term: %s", term)
				}
			}

			// Should not contain stack traces or internal paths
			responseStr := w.Body.String()
			assert.NotContains(t, responseStr, "internal/")
			assert.NotContains(t, responseStr, ".go:")
			assert.NotContains(t, responseStr, "stack trace")
		})
	}
}

// TestDenialOfServiceProtection tests DoS protection measures
func (suite *SecurityTestSuite) TestDenialOfServiceProtection() {
	suite.T().Run("Request size limits", func(t *testing.T) {
		// Test various payload sizes
		sizes := []int{1024, 10240, 102400, 1048576, 10485760} // 1KB to 10MB

		for _, size := range sizes {
			t.Run(fmt.Sprintf("Size_%d_bytes", size), func(t *testing.T) {
				payload := map[string]interface{}{
					"data": strings.Repeat("A", size),
				}

				bodyBytes, err := json.Marshal(payload)
				require.NoError(t, err)

				req := suite.createTestRequest("POST", "/api/v1/auth/refresh", bytes.NewBuffer(bodyBytes))
				req.Header.Set("Content-Type", "application/json")
				w := httptest.NewRecorder()

				start := time.Now()
				suite.server.GetRouter().ServeHTTP(w, req)
				duration := time.Since(start)

				// Large requests should be rejected quickly
				if size > 1048576 { // > 1MB
					assert.Equal(t, http.StatusRequestEntityTooLarge, w.Code)
					assert.Less(t, duration, 100*time.Millisecond,
						"Large request should be rejected quickly")
				}

				// Request should be processed in reasonable time
				assert.Less(t, duration, 5*time.Second,
					"Request took too long to process")
			})
		}
	})

	suite.T().Run("Connection timeout", func(t *testing.T) {
		// Test that slow requests are handled appropriately
		// This would need to be enhanced based on actual timeout configuration
		req := suite.createTestRequest("GET", "/api/v1/health", nil)
		w := httptest.NewRecorder()

		start := time.Now()
		suite.server.GetRouter().ServeHTTP(w, req)
		duration := time.Since(start)

		// Request should complete quickly
		assert.Less(t, duration, 1*time.Second,
			"Health check should complete quickly")
	})
}

// TestSecurityTestSuite runs the security test suite
func TestSecurityTestSuite(t *testing.T) {
	suite.Run(t, new(SecurityTestSuite))
}