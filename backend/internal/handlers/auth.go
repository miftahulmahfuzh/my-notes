package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/gpd/my-notes/internal/auth"
	"github.com/gpd/my-notes/internal/models"
	"github.com/gorilla/sessions"
)

// AuthHandler handles authentication-related HTTP requests
type AuthHandler struct {
	oauthService *auth.OAuthService
	tokenService *auth.TokenService
	userService  UserServiceInterface
	sessionStore sessions.Store
}

// UserServiceInterface defines the interface for user service operations
type UserServiceInterface interface {
	CreateOrUpdateFromGoogle(userInfo *auth.GoogleUserInfo) (*models.User, error)
	GetByID(userID string) (*models.User, error)
	CreateSession(userID, ipAddress, userAgent string) (*models.UserSession, error)
	UpdateSessionActivity(sessionID, ipAddress, userAgent string) error
	GetActiveSessions(userID string) ([]models.UserSession, error)
}

// NewAuthHandler creates a new AuthHandler instance
func NewAuthHandler(
	oauthService *auth.OAuthService,
	tokenService *auth.TokenService,
	userService UserServiceInterface,
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

// GoogleAuthRequest represents the request to start Google OAuth
type GoogleAuthRequest struct {
	Redirect string `json:"redirect,omitempty"`
}

// GoogleAuthResponse represents the response with OAuth URL
type GoogleAuthResponse struct {
	AuthURL string `json:"auth_url"`
	State   string `json:"state"`
}

// GoogleAuth handles GET /api/v1/auth/google
func (h *AuthHandler) GoogleAuth(w http.ResponseWriter, r *http.Request) {
	// Generate state parameter for CSRF protection
	state, err := auth.GenerateSecureState()
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to generate state parameter")
		return
	}

	// Store state in session
	session, err := h.sessionStore.Get(r, "auth-session")
	if err != nil {
		session, _ = h.sessionStore.New(r, "auth-session")
	}
	session.Values["oauth_state"] = state

	// Get redirect parameter from request
	var req GoogleAuthRequest
	if r.Body != nil {
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			// Non-critical error, continue without redirect
			req.Redirect = ""
		}
	}
	session.Values["oauth_redirect"] = req.Redirect

	if err := session.Save(r, w); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to save session")
		return
	}

	// Generate auth URL
	authURL, err := h.oauthService.GetAuthURL(state)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to generate auth URL")
		return
	}

	respondWithJSON(w, http.StatusOK, GoogleAuthResponse{
		AuthURL: authURL,
		State:   state,
	})
}

// GoogleCallback handles POST /api/v1/auth/google/callback
func (h *AuthHandler) GoogleCallback(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Code  string `json:"code" validate:"required"`
		State string `json:"state" validate:"required"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Code == "" {
		respondWithError(w, http.StatusBadRequest, "Authorization code is required")
		return
	}

	if req.State == "" {
		respondWithError(w, http.StatusBadRequest, "State parameter is required")
		return
	}

	// Verify state parameter
	session, err := h.sessionStore.Get(r, "auth-session")
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Failed to get session")
		return
	}
	storedState, ok := session.Values["oauth_state"].(string)
	if !ok || storedState != req.State {
		respondWithError(w, http.StatusBadRequest, "Invalid state parameter")
		return
	}

	// Exchange authorization code for tokens
	oauthToken, err := h.oauthService.ExchangeCodeForToken(req.Code, req.State, "")
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to exchange code for token")
		return
	}

	// Get user info from Google
	userInfo, err := h.oauthService.GetUserInfo(oauthToken)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to get user info")
		return
	}

	// Create or update user
	user, err := h.userService.CreateOrUpdateFromGoogle(userInfo)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to create or update user")
		return
	}

	// Generate JWT tokens
	tokenPair, err := h.tokenService.GenerateTokenPair(user)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to generate tokens")
		return
	}

	// Create user session
	_, err = h.userService.CreateSession(
		user.ID.String(),
		getClientIP(r),
		r.UserAgent(),
	)
	if err != nil {
		// Log error but don't fail the request
		fmt.Printf("Failed to create user session: %v\n", err)
	}

	// Clean up session
	session.Values["oauth_state"] = nil
	session.Values["oauth_redirect"] = nil
	if err := session.Save(r, w); err != nil {
		fmt.Printf("Failed to clean up session: %v\n", err)
	}

	respondWithJSON(w, http.StatusOK, AuthResponse{
		User:         user.ToResponse(),
		AccessToken:  tokenPair.AccessToken,
		RefreshToken: tokenPair.RefreshToken,
		TokenType:    tokenPair.TokenType,
		ExpiresIn:    tokenPair.ExpiresIn,
	})
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
		if idx := len(xff); idx > 0 {
			if commaIdx := 0; commaIdx < idx {
				for i, c := range xff {
					if c == ',' {
						commaIdx = i
						break
					}
				}
				if commaIdx > 0 {
					return xff[:commaIdx]
				}
			}
			return xff
		}
	}

	// Check X-Real-IP header
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return xri
	}

	// Fall back to RemoteAddr
	return r.RemoteAddr
}

// respondWithError sends an error response
func respondWithError(w http.ResponseWriter, code int, message string) {
	respondWithJSON(w, code, map[string]string{"error": message})
}

// respondWithJSON sends a JSON response
func respondWithJSON(w http.ResponseWriter, code int, payload interface{}) {
	response, err := json.Marshal(payload)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to marshal response")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	w.Write(response)
}