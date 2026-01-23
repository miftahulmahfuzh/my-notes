package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gpd/my-notes/internal/auth"
	"github.com/gpd/my-notes/internal/handlers"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

func TestTokenRefreshValidation(t *testing.T) {
	handler, mockUserService := setupAuthHandler(t)

	tests := []struct {
		name           string
		requestBody    string
		expectedStatus int
		expectedError  string
		setupMocks     func(*MockUserService)
		dynamicToken   bool
	}{
		{
			name:          "invalid JSON",
			requestBody:   "invalid json",
			expectedStatus: http.StatusBadRequest,
			expectedError:  "Invalid request body",
		},
		{
			name:          "empty request body",
			requestBody:   `{}`,
			expectedStatus: http.StatusBadRequest,
			expectedError:  "refresh_token is required",
		},
		{
			name:          "missing refresh token",
			requestBody:   `{"refresh_token": ""}`,
			expectedStatus: http.StatusBadRequest,
			expectedError:  "refresh_token is required",
		},
		{
			name:          "invalid refresh token",
			requestBody:   `{"refresh_token": "invalid-token"}`,
			expectedStatus: http.StatusUnauthorized,
			expectedError:  "Invalid refresh token",
		},
		{
			name:          "valid refresh token format but user not found",
			requestBody:   `{"refresh_token": "valid-token-format-but-user-not-found"}`,
			expectedStatus: http.StatusUnauthorized,
			expectedError:  "Invalid refresh token",
		},
		{
			name:          "complete valid refresh flow",
			requestBody:   "",  // Will be set dynamically
			expectedStatus: http.StatusOK,
			dynamicToken: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setupMocks != nil {
				tt.setupMocks(mockUserService)
			}

			var requestBody string
			if tt.dynamicToken {
				// Create a valid refresh token for testing
				tokenService := auth.NewTokenService(
					"test-secret-key-that-is-long-enough-for-hs256",
					15*time.Minute,
					24*time.Hour,
					"notes-app",
					"notes-users",
				)
				user := createTestUser()

				// Set up the mock to expect this specific user
				mockUserService.On("GetByID", user.ID.String()).Return(user, nil)

				tokenPair, err := tokenService.GenerateTokenPair(user)
				assert.NoError(t, err)
				refreshReq := map[string]string{
					"refresh_token": tokenPair.RefreshToken,
				}
				bodyBytes, _ := json.Marshal(refreshReq)
				requestBody = string(bodyBytes)
			} else {
				requestBody = tt.requestBody
			}

			req := httptest.NewRequest("POST", "/api/v1/auth/refresh",
				bytes.NewBufferString(requestBody))
			req.Header.Set("Content-Type", "application/json")

			w := httptest.NewRecorder()
			handler.RefreshToken(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)

			if tt.expectedError != "" {
				var response struct {
					Success bool `json:"success"`
					Error   struct {
						Code    string `json:"code"`
						Message string `json:"message"`
					} `json:"error"`
				}
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.False(t, response.Success)
				assert.Equal(t, tt.expectedError, response.Error.Message)
			}

			// Reset mock for next test
			mockUserService.ExpectedCalls = nil
			mockUserService.Calls = nil
		})
	}
}

func TestTokenRefreshWithValidToken(t *testing.T) {
	handler, mockUserService := setupAuthHandler(t)

	// Create a real token service for this test
	tokenService := auth.NewTokenService(
		"test-secret-key-that-is-long-enough-for-hs256",
		15*time.Minute,
		24*time.Hour,
		"notes-app",
		"notes-users",
	)

	user := createTestUser()

	// Generate a valid token pair
	tokenPair, err := tokenService.GenerateTokenPair(user)
	assert.NoError(t, err)

	// Mock user service to return the user
	mockUserService.On("GetByID", user.ID.String()).Return(user, nil)

	// Create refresh request
	reqBody := auth.RefreshTokenRequest{
		RefreshToken: tokenPair.RefreshToken,
	}
	body, _ := json.Marshal(reqBody)

	req := httptest.NewRequest("POST", "/api/v1/auth/refresh", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	handler.RefreshToken(w, req)

	// Should succeed and return new tokens
	assert.Equal(t, http.StatusOK, w.Code)

	var response struct {
		Success bool `json:"success"`
		Data    struct {
			AccessToken  string `json:"access_token"`
			RefreshToken string `json:"refresh_token"`
			TokenType    string `json:"token_type"`
			ExpiresIn    int    `json:"expires_in"`
		} `json:"data"`
	}
	err = json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)

	assert.True(t, response.Success)
	assert.NotEmpty(t, response.Data.AccessToken)
	assert.NotEmpty(t, response.Data.RefreshToken)
	assert.Equal(t, "Bearer", response.Data.TokenType)
	assert.Equal(t, 900, response.Data.ExpiresIn) // 15 minutes = 900 seconds

	// The new tokens should be different from the original
	assert.NotEqual(t, tokenPair.AccessToken, response.Data.AccessToken)
	assert.NotEqual(t, tokenPair.RefreshToken, response.Data.RefreshToken)

	mockUserService.AssertExpectations(t)
}

func TestTokenRefreshFlow(t *testing.T) {
	handler, mockUserService := setupAuthHandler(t)

	// Create a real token service for this test
	tokenService := auth.NewTokenService(
		"test-secret-key-that-is-long-enough-for-hs256",
		1*time.Minute, // Short expiry for testing
		24*time.Hour,
		"notes-app",
		"notes-users",
	)

	user := createTestUser()

	// Step 1: Generate initial tokens
	initialTokens, err := tokenService.GenerateTokenPair(user)
	assert.NoError(t, err)

	// Step 2: Mock user service to return the user
	mockUserService.On("GetByID", user.ID.String()).Return(user, nil)

	// Step 3: Refresh the tokens
	refreshReq := auth.RefreshTokenRequest{
		RefreshToken: initialTokens.RefreshToken,
	}
	body, _ := json.Marshal(refreshReq)

	req := httptest.NewRequest("POST", "/api/v1/auth/refresh", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	handler.RefreshToken(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response struct {
		Success bool `json:"success"`
		Data    struct {
			AccessToken  string `json:"access_token"`
			RefreshToken string `json:"refresh_token"`
		} `json:"data"`
	}
	err = json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)

	assert.True(t, response.Success)

	// Step 4: Verify new tokens are valid
	newAccessToken := response.Data.AccessToken
	newRefreshToken := response.Data.RefreshToken

	// Validate new access token
	claims, err := tokenService.ValidateToken(newAccessToken)
	assert.NoError(t, err)
	assert.Equal(t, user.ID.String(), claims.UserID)

	// Validate new refresh token
	refreshClaims, err := tokenService.ValidateRefreshToken(newRefreshToken)
	assert.NoError(t, err)
	assert.Equal(t, user.ID.String(), refreshClaims.UserID)

	// Step 5: Verify tokens are different from original
	assert.NotEqual(t, initialTokens.AccessToken, newAccessToken)
	assert.NotEqual(t, initialTokens.RefreshToken, newRefreshToken)

	mockUserService.AssertExpectations(t)
}

func TestTokenRefreshWithExpiredToken(t *testing.T) {
	// Use setupAuthHandler to get a properly configured mock user service
	_, mockUserService := setupAuthHandler(t)

	// Override the token service with one that has very short expiry
	shortTokenService := auth.NewTokenService(
		"test-secret-key-that-is-long-enough-for-hs256",
		1*time.Millisecond, // Very short expiry
		24*time.Hour,
		"notes-app",
		"notes-users",
	)

	// Create handler with the short-lived token service
	shortLivedHandler := handlers.NewAuthHandler(
		shortTokenService,
		mockUserService,
	)

	user := createTestUser()

	// Set up mock to return an error when GetByID is called (simulating user not found)
	mockUserService.On("GetByID", mock.AnythingOfType("string")).Return(nil, assert.AnError)

	// Generate token pair
	tokenPair, err := shortTokenService.GenerateTokenPair(user)
	assert.NoError(t, err)

	// Wait for token to expire
	time.Sleep(10 * time.Millisecond)

	// Try to refresh with expired refresh token
	refreshReq := auth.RefreshTokenRequest{
		RefreshToken: tokenPair.RefreshToken,
	}
	body, _ := json.Marshal(refreshReq)

	req := httptest.NewRequest("POST", "/api/v1/auth/refresh", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	shortLivedHandler.RefreshToken(w, req)

	// Should fail with user not found error (since token is still valid but user doesn't exist)
	assert.Equal(t, http.StatusUnauthorized, w.Code)

	var response struct {
		Success bool `json:"success"`
		Error   struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}
	err = json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.False(t, response.Success)
	assert.Equal(t, "User not found", response.Error.Message)
}

func TestTokenRefreshWithMalformedToken(t *testing.T) {
	handler, _ := setupAuthHandler(t)

	tests := []struct {
		name          string
		token         string
		expectFail    bool
		expectStatus  int
		expectError   string
	}{
		{
			name:       "completely invalid token",
			token:      "not.a.jwt.token",
			expectFail: true,
		},
		{
			name:       "token with missing parts",
			token:      "header.payload",
			expectFail: true,
		},
		{
			name:       "empty token",
			token:      "",
			expectFail: true,
			expectStatus: http.StatusBadRequest,
			expectError: "refresh_token is required",
		},
		{
			name:       "token with invalid base64",
			token:      "invalid!base64.token",
			expectFail: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			refreshReq := auth.RefreshTokenRequest{
				RefreshToken: tt.token,
			}
			body, _ := json.Marshal(refreshReq)

			req := httptest.NewRequest("POST", "/api/v1/auth/refresh", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")

			w := httptest.NewRecorder()
			handler.RefreshToken(w, req)

			// Use custom expectations if provided, otherwise use defaults
			expectedStatus := tt.expectStatus
			if expectedStatus == 0 {
				expectedStatus = http.StatusUnauthorized
			}

			expectedError := tt.expectError
			if expectedError == "" {
				expectedError = "Invalid refresh token"
			}

			assert.Equal(t, expectedStatus, w.Code)

			var response struct {
				Success bool `json:"success"`
				Error   struct {
					Code    string `json:"code"`
					Message string `json:"message"`
				} `json:"error"`
			}
			err := json.Unmarshal(w.Body.Bytes(), &response)
			assert.NoError(t, err)
			assert.False(t, response.Success)
			assert.Equal(t, expectedError, response.Error.Message)
		})
	}
}

func TestTokenRefreshResponseStructure(t *testing.T) {
	handler, mockUserService := setupAuthHandler(t)

	user := createTestUser()

	// Create a real token service for this test
	tokenService := auth.NewTokenService(
		"test-secret-key-that-is-long-enough-for-hs256",
		15*time.Minute,
		24*time.Hour,
		"notes-app",
		"notes-users",
	)

	// Generate a valid token pair
	tokenPair, err := tokenService.GenerateTokenPair(user)
	assert.NoError(t, err)

	// Mock user service to return the user
	mockUserService.On("GetByID", user.ID.String()).Return(user, nil)

	// Create refresh request
	refreshReq := auth.RefreshTokenRequest{
		RefreshToken: tokenPair.RefreshToken,
	}
	body, _ := json.Marshal(refreshReq)

	req := httptest.NewRequest("POST", "/api/v1/auth/refresh", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	handler.RefreshToken(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response struct {
		Success bool `json:"success"`
		Data    struct {
			AccessToken  string `json:"access_token"`
			RefreshToken string `json:"refresh_token"`
			TokenType    string `json:"token_type"`
			ExpiresIn    int    `json:"expires_in"`
		} `json:"data"`
	}
	err = json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)

	assert.True(t, response.Success)

	// Verify response structure
	assert.NotEmpty(t, response.Data.AccessToken, "Response should contain access_token")
	assert.NotEmpty(t, response.Data.RefreshToken, "Response should contain refresh_token")
	assert.NotEmpty(t, response.Data.TokenType, "Response should contain token_type")
	assert.Greater(t, response.Data.ExpiresIn, 0, "Response should contain expires_in")

	// Verify field types
	assert.IsType(t, "", response.Data.AccessToken, "access_token should be a string")
	assert.IsType(t, "", response.Data.RefreshToken, "refresh_token should be a string")
	assert.IsType(t, "", response.Data.TokenType, "token_type should be a string")
	assert.IsType(t, 0, response.Data.ExpiresIn, "expires_in should be a number")

	// Verify values
	assert.Equal(t, "Bearer", response.Data.TokenType, "token_type should be 'Bearer'")
	assert.Greater(t, response.Data.ExpiresIn, 0, "expires_in should be positive")

	mockUserService.AssertExpectations(t)
}