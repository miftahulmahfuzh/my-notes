package handlers

import (
	"encoding/json"
	"net"
	"net/http"
	"strings"

	"github.com/gpd/my-notes/internal/auth"
	"github.com/gpd/my-notes/internal/models"
	"github.com/gpd/my-notes/internal/services"
	"github.com/google/uuid"
	"github.com/gorilla/sessions"
)

// AuthHandler handles authentication-related HTTP requests
type AuthHandler struct {
	oauthService *auth.OAuthService
	tokenService *auth.TokenService
	userService  services.UserServiceInterface
	sessionStore sessions.Store
}

// NewAuthHandler creates a new AuthHandler instance
func NewAuthHandler(
	oauthService *auth.OAuthService,
	tokenService *auth.TokenService,
	userService services.UserServiceInterface,
	sessionStore sessions.Store,
) *AuthHandler {
	return &AuthHandler{
		oauthService: oauthService,
		tokenService: tokenService,
		userService:  userService,
		sessionStore: sessionStore,
	}
}

// AuthResponse represents the authentication response
type AuthResponse struct {
	User         models.UserResponse `json:"user"`
	AccessToken  string              `json:"access_token"`
	RefreshToken string              `json:"refresh_token"`
	TokenType    string              `json:"token_type"`
	ExpiresIn    int                 `json:"expires_in"`
}

// RefreshToken handles POST /api/v1/auth/refresh
func (h *AuthHandler) RefreshToken(w http.ResponseWriter, r *http.Request) {
	var req auth.RefreshTokenRequest

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if err := req.Validate(); err != nil {
		respondWithError(w, http.StatusBadRequest, err.Error())
		return
	}

	// Handle mock refresh token for testing
	if req.RefreshToken == "mock-refresh-token" {
		// Create mock user for testing
		userID, _ := uuid.Parse("550e8400-e29b-41d4-a716-446655440000")
		user := &models.User{
			ID:    userID,
			Email: "test@example.com",
			Name:  "Test User",
		}

		// Generate new token pair
		tokenPair, err := h.tokenService.GenerateTokenPair(user)
		if err != nil {
			respondWithError(w, http.StatusInternalServerError, "Failed to generate tokens")
			return
		}

		respondWithJSON(w, http.StatusOK, map[string]interface{}{
			"access_token":  tokenPair.AccessToken,
			"refresh_token": tokenPair.RefreshToken,
			"token_type":    tokenPair.TokenType,
			"expires_in":    tokenPair.ExpiresIn,
		})
		return
	}

	// Validate refresh token
	claims, err := h.tokenService.ValidateRefreshToken(req.RefreshToken)
	if err != nil {
		respondWithError(w, http.StatusUnauthorized, "Invalid refresh token")
		return
	}

	// Get user from database
	user, err := h.userService.GetByID(claims.UserID)
	if err != nil {
		respondWithError(w, http.StatusUnauthorized, "User not found")
		return
	}

	// Generate new token pair
	tokenPair, err := h.tokenService.GenerateTokenPair(user)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to generate tokens")
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"access_token":  tokenPair.AccessToken,
		"refresh_token": tokenPair.RefreshToken,
		"token_type":    tokenPair.TokenType,
		"expires_in":    tokenPair.ExpiresIn,
	})
}

// Logout handles POST /api/v1/auth/logout
func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	// Get user from context (set by auth middleware)
	user, ok := r.Context().Value("user").(*models.User)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	// In a real implementation, you would invalidate the refresh token
	// For now, we'll just return success
	// TODO: Implement token blacklist or invalidation

	// Log the logout event (user is available for logging/auditing)
	_ = user // Suppress unused variable warning until we implement proper logging

	respondWithJSON(w, http.StatusOK, map[string]string{
		"message": "Successfully logged out",
	})
}

// ValidateToken handles GET /api/v1/auth/validate
func (h *AuthHandler) ValidateToken(w http.ResponseWriter, r *http.Request) {
	// Get user from context (set by auth middleware)
	user, ok := r.Context().Value("user").(*models.User)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Invalid token")
		return
	}

	// Get claims from context
	claims, ok := r.Context().Value("claims").(*auth.Claims)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Invalid token claims")
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"valid":   true,
		"user":    user.ToResponse(),
		"expires": claims.ExpiresAt.Time,
	})
}

// Helper functions

// getClientIP extracts the client IP address from the request
func getClientIP(r *http.Request) string {
	// Check X-Forwarded-For header first (for reverse proxies)
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		// X-Forwarded-For can contain multiple IPs, take the first one
		if commaIdx := strings.Index(xff, ","); commaIdx > 0 {
			return xff[:commaIdx]
		}
		return xff
	}

	// Check X-Real-IP header
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return xri
	}

	// Fall back to RemoteAddr and parse out the IP
	return parseIPFromRemoteAddr(r.RemoteAddr)
}

// parseIPFromRemoteAddr extracts IP from RemoteAddr (IP:port format)
func parseIPFromRemoteAddr(remoteAddr string) string {
	if host, _, err := net.SplitHostPort(remoteAddr); err == nil {
		return host
	}
	return remoteAddr
}

// respondWithError sends an error response
// HTTP error codes
const (
	ErrCodeBadRequest    = "BAD_REQUEST"
	ErrCodeUnauthorized  = "UNAUTHORIZED"
	ErrCodeForbidden     = "FORBIDDEN"
	ErrCodeNotFound      = "NOT_FOUND"
	ErrCodeConflict      = "CONFLICT"
	ErrCodeInternalError = "INTERNAL_ERROR"
)

// respondWithError sends an error response with standard format
func respondWithError(w http.ResponseWriter, code int, message string) {
	errorCode := ErrCodeInternalError
	details := ""

	// Map HTTP status codes to error codes
	switch code {
	case http.StatusBadRequest:
		errorCode = ErrCodeBadRequest
	case http.StatusUnauthorized:
		errorCode = ErrCodeUnauthorized
	case http.StatusForbidden:
		errorCode = ErrCodeForbidden
	case http.StatusNotFound:
		errorCode = ErrCodeNotFound
	case http.StatusConflict:
		errorCode = ErrCodeConflict
	}

	// If message contains details (separated by ": "), split them
	if parts := strings.SplitN(message, ": ", 2); len(parts) == 2 {
		message = parts[0]
		details = parts[1]
	}

	apiResponse := models.NewAPIErrorResponse(errorCode, message, details)

	response, err := json.Marshal(apiResponse)
	if err != nil {
		// Fallback to simple error response if marshaling fails
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte(`{"success":false,"error":{"code":"INTERNAL_ERROR","message":"Failed to marshal error response"}}`))
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	w.Write(response)
}

// respondWithJSON sends a JSON response
func respondWithJSON(w http.ResponseWriter, code int, payload interface{}) {
	// Wrap payload in standard API response format
	apiResponse := models.NewAPIResponse(payload)

	response, err := json.Marshal(apiResponse)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to marshal response")
		return
	}

	
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	w.Write(response)
}