package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"

	"github.com/gpd/my-notes/internal/auth"
	"github.com/gpd/my-notes/internal/models"
	"github.com/gpd/my-notes/internal/services"
)

// tokenCacheEntry holds cached token validation result
type tokenCacheEntry struct {
	userInfo  *auth.GoogleUserInfo
	expiresAt time.Time
}

// Global in-memory cache for Chrome token validation
// Key: token string, Value: *tokenCacheEntry
var tokenCache sync.Map

// ChromeAuthRequest represents the request from Chrome extension
type ChromeAuthRequest struct {
	Token string `json:"token" validate:"required"`
}

// ChromeAuthResponse represents the response to Chrome extension
type ChromeAuthResponse struct {
	User         models.UserResponse `json:"user"`
	AccessToken  string              `json:"access_token"`
	RefreshToken string              `json:"refresh_token"`
	TokenType    string              `json:"token_type"`
	ExpiresIn    int                 `json:"expires_in"`
	SessionID    string              `json:"session_id"`
}

// ChromeAuthHandler handles Chrome extension authentication
type ChromeAuthHandler struct {
	tokenService *auth.TokenService
	userService  services.UserServiceInterface
}

// NewChromeAuthHandler creates a new ChromeAuthHandler instance
func NewChromeAuthHandler(
	tokenService *auth.TokenService,
	userService services.UserServiceInterface,
) *ChromeAuthHandler {
	return &ChromeAuthHandler{
		tokenService: tokenService,
		userService:  userService,
	}
}

// ExchangeChromeToken exchanges Chrome Identity token for app tokens
func (h *ChromeAuthHandler) ExchangeChromeToken(w http.ResponseWriter, r *http.Request) {
	var req ChromeAuthRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Token == "" {
		respondWithError(w, http.StatusBadRequest, "Chrome token is required")
		return
	}

	// Validate Chrome token with Google
	userInfo, err := h.validateChromeToken(req.Token)
	if err != nil {
		respondWithError(w, http.StatusUnauthorized, fmt.Sprintf("Invalid Chrome token: %v", err))
		return
	}

	// Get or create user
	user, err := h.getOrCreateUser(userInfo)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to create user: %v", err))
		return
	}

	// Check if user already has an existing Chrome extension session
	existingSessions, err := h.userService.GetActiveSessions(user.ID.String())
	if err == nil {
		// Look for existing Chrome extension sessions
		for _, existingSession := range existingSessions {
			if existingSession.UserAgent == "Chrome-Extension" && existingSession.IsActive {
				// Reuse existing Chrome extension session
				if err := h.sendAuthResponse(w, user, existingSession.ID); err != nil {
					respondWithError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to generate tokens: %v", err))
					return
				}
				return
			}
		}
	}

	// No existing Chrome session found, create a new one
	session, err := h.userService.CreateSession(user.ID.String(), "127.0.0.1", "Chrome-Extension")
	var sessionID string
	if err != nil {
		// For Chrome extensions, create a simple session if CreateSession fails
		sessionID = fmt.Sprintf("chrome-session-%s", user.ID.String())
	} else {
		sessionID = session.ID
	}

	if err := h.sendAuthResponse(w, user, sessionID); err != nil {
		respondWithError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to generate tokens: %v", err))
		return
	}
}

// Cache duration for token validation (50 minutes, less than Google's 1-hour token lifetime)
const tokenCacheDuration = 50 * time.Minute

// validateChromeToken validates Chrome Identity token with Google
func (h *ChromeAuthHandler) validateChromeToken(token string) (*auth.GoogleUserInfo, error) {
	// Check cache first
	if cached, ok := tokenCache.Load(token); ok {
		entry := cached.(*tokenCacheEntry)
		if time.Now().Before(entry.expiresAt) {
			// Cache hit - return cached user info
			return entry.userInfo, nil
		}
		// Cache expired - remove it
		tokenCache.Delete(token)
	}

	// Cache miss - validate with Google
	// For Chrome extensions, we need to validate the token with Google's tokeninfo endpoint
	// This is a simpler validation that doesn't require PKCE

	// Google tokeninfo endpoint
	tokenInfoURL := "https://www.googleapis.com/oauth2/v2/tokeninfo"

	req, err := http.NewRequest("GET", tokenInfoURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create tokeninfo request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+token)

	client := &http.Client{
		Timeout: 10 * time.Second,
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to validate token with Google: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		// Read the response body for debugging
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("token validation failed with status: %d, response: %s", resp.StatusCode, string(body))
	}

	var tokenInfo struct {
		Email         string `json:"email"`
		Picture       string `json:"picture"`
		EmailVerified string `json:"email_verified"`
		Scope         string `json:"scope"`
		Audience      string `json:"aud"`
		UserID        string `json:"user_id"`
		GivenName     string `json:"given_name"`
		FamilyName    string `json:"family_name"`
		Locale        string `json:"locale"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&tokenInfo); err != nil {
		return nil, fmt.Errorf("failed to decode tokeninfo response: %w", err)
	}

	// Validate required fields
	if tokenInfo.Email == "" {
		return nil, fmt.Errorf("token does not contain email")
	}

	// For Chrome Identity API, email_verified might not be returned
	// but if we got the token from Google Identity API, the email should be valid
	// Only check email_verified if it's present
	if tokenInfo.EmailVerified != "" && tokenInfo.EmailVerified != "true" {
		return nil, fmt.Errorf("email is not verified")
	}

	// Create GoogleUserInfo from tokeninfo response
	// For Chrome Identity API, some fields might be empty, so handle gracefully
	googleUserInfo := &auth.GoogleUserInfo{
		ID:            tokenInfo.UserID,
		Email:         tokenInfo.Email,
		VerifiedEmail: tokenInfo.EmailVerified == "true" || tokenInfo.EmailVerified == "",
		GivenName:     tokenInfo.GivenName,
		FamilyName:    tokenInfo.FamilyName,
		Picture:       tokenInfo.Picture,
		Locale:        tokenInfo.Locale,
	}

	// For Chrome Identity API, be more lenient with validation
	if googleUserInfo.ID == "" {
		googleUserInfo.ID = "chrome-user-" + tokenInfo.Email // Generate a fallback ID
	}

	// Validate the Google user info (relaxed validation for Chrome)
	if googleUserInfo.Email == "" {
		return nil, fmt.Errorf("invalid Google user info: email is required")
	}

	// Store in cache for future requests
	tokenCache.Store(token, &tokenCacheEntry{
		userInfo:  googleUserInfo,
		expiresAt: time.Now().Add(tokenCacheDuration),
	})

	return googleUserInfo, nil
}

// getOrCreateUser gets an existing user or creates a new one
func (h *ChromeAuthHandler) getOrCreateUser(googleUserInfo *auth.GoogleUserInfo) (*models.User, error) {
	// Use the existing user service to create or update user from Google info
	user, err := h.userService.CreateOrUpdateFromGoogle(googleUserInfo)
	if err != nil {
		return nil, fmt.Errorf("failed to create or update user: %w", err)
	}

	return user, nil
}

// sendAuthResponse generates tokens and sends auth response for Chrome extension
func (h *ChromeAuthHandler) sendAuthResponse(w http.ResponseWriter, user *models.User, sessionID string) error {
	// Generate JWT tokens with the session ID
	tokenPair, err := h.tokenService.GenerateTokenPairWithSession(user, sessionID)
	if err != nil {
		return fmt.Errorf("failed to generate tokens: %w", err)
	}

	response := ChromeAuthResponse{
		User:         user.ToResponse(),
		AccessToken:  tokenPair.AccessToken,
		RefreshToken: tokenPair.RefreshToken,
		TokenType:    tokenPair.TokenType,
		ExpiresIn:    tokenPair.ExpiresIn,
		SessionID:    sessionID,
	}

	respondWithJSON(w, http.StatusOK, response)
	return nil
}
