package handlers

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gpd/my-notes/internal/auth"
	"github.com/gpd/my-notes/internal/models"
	"github.com/gpd/my-notes/internal/services"
)

// BlacklistAdder adds tokens to the blacklist
type BlacklistAdder interface {
	AddToken(ctx context.Context, tokenID, userID, sessionID string, expiresAt time.Time, reason string) error
}

// AuthHandler handles authentication-related HTTP requests
type AuthHandler struct {
	tokenService *auth.TokenService
	userService  services.UserServiceInterface
	blacklist    BlacklistAdder // optional blacklist adder
}

// NewAuthHandler creates a new AuthHandler instance
func NewAuthHandler(
	tokenService *auth.TokenService,
	userService services.UserServiceInterface,
) *AuthHandler {
	return &AuthHandler{
		tokenService: tokenService,
		userService:  userService,
	}
}

// SetBlacklist sets the blacklist adder
func (h *AuthHandler) SetBlacklist(blacklist BlacklistAdder) {
	h.blacklist = blacklist
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

	// Validate refresh token
	claims, err := h.tokenService.ValidateRefreshToken(r.Context(), req.RefreshToken)
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

	// Get claims from context (set by auth middleware)
	claims, ok := r.Context().Value("claims").(*auth.Claims)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Invalid token claims")
		return
	}

	// Add the current token to the blacklist
	if h.blacklist != nil {
		expiresAt := claims.ExpiresAt.Time
		err := h.blacklist.AddToken(r.Context(), claims.ID, user.ID.String(), claims.SessionID, expiresAt, "logout")
		if err != nil {
			// Log error but don't fail - user is still logged out from client perspective
			// The token will expire naturally
			log.Printf("WARNING: failed to blacklist token during logout: %v", err)
		}
	}

	respondWithJSON(w, http.StatusOK, map[string]string{
		"message": "Successfully logged out",
	})
}

// ValidateToken handles GET /api/v1/auth/validate
func (h *AuthHandler) ValidateToken(w http.ResponseWriter, r *http.Request) {
	// This endpoint is protected by auth middleware, so if we reach here,
	// the token is valid. Just return the user info and claims.

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
