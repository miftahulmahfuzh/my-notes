package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"

	"github.com/gpd/my-notes/internal/auth"
	"github.com/gpd/my-notes/internal/models"
	"github.com/gpd/my-notes/internal/services"
)

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

	// DEBUG: Log token details (first few chars only for security)
	tokenPreview := req.Token
	if len(tokenPreview) > 20 {
		tokenPreview = tokenPreview[:20]
	}
	log.Printf("DEBUG: Received Chrome token (first %d chars): %s...", len(tokenPreview), tokenPreview)

	// Validate Chrome token with Google
	userInfo, err := h.validateChromeToken(req.Token)
	if err != nil {
		log.Printf("DEBUG: Token validation failed: %v", err)
		respondWithError(w, http.StatusUnauthorized, fmt.Sprintf("Invalid Chrome token: %v", err))
		return
	}

	// Get or create user
	log.Printf("DEBUG: Attempting to get/create user for email: %s", userInfo.Email)
	user, err := h.getOrCreateUser(userInfo)
	if err != nil {
		log.Printf("DEBUG: User creation failed: %v", err)
		respondWithError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to create user: %v", err))
		return
	}

	// Check if user already has an existing Chrome extension session
	existingSessions, err := h.userService.GetActiveSessions(user.ID.String())
	if err != nil {
		log.Printf("DEBUG: Failed to get existing sessions: %v", err)
	} else {
		// Look for existing Chrome extension sessions
		for _, existingSession := range existingSessions {
			if existingSession.UserAgent == "Chrome-Extension" && existingSession.IsActive {
				// Reuse existing Chrome extension session
				sessionID := existingSession.ID
				log.Printf("DEBUG: Reusing existing Chrome session: %s", sessionID)

				// Generate JWT tokens with the existing session ID
				tokenPair, err := h.tokenService.GenerateTokenPairWithSession(user, sessionID)
				if err != nil {
					respondWithError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to generate tokens: %v", err))
					return
				}

				response := ChromeAuthResponse{
					User:         user.ToResponse(),
					AccessToken:  tokenPair.AccessToken,
					RefreshToken: tokenPair.RefreshToken,
					TokenType:    tokenPair.TokenType,
					ExpiresIn:    tokenPair.ExpiresIn,
					SessionID:    sessionID,
				}

				log.Printf("DEBUG: Reused session response - User email: %s, Name: %s, Session: %s", response.User.Email, response.User.Name, sessionID)
				respondWithJSON(w, http.StatusOK, response)
				return
			}
		}
	}

	// No existing Chrome session found, create a new one
	log.Printf("DEBUG: No existing Chrome session found, creating new session for user: %s", user.ID.String())
	session, err := h.userService.CreateSession(user.ID.String(), "127.0.0.1", "Chrome-Extension")
	var sessionID string
	if err != nil {
		// For Chrome extensions, create a simple session if CreateSession fails
		sessionID = fmt.Sprintf("chrome-session-%s", user.ID.String())
		log.Printf("DEBUG: Created simple Chrome session ID: %s", sessionID)
	} else {
		sessionID = session.ID
		log.Printf("DEBUG: Created new session for Chrome extension: %s", sessionID)
	}

	// Generate JWT tokens with the actual session ID
	tokenPair, err := h.tokenService.GenerateTokenPairWithSession(user, sessionID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to generate tokens: %v", err))
		return
	}

	response := ChromeAuthResponse{
		User:         user.ToResponse(),
		AccessToken:  tokenPair.AccessToken,
		RefreshToken: tokenPair.RefreshToken,
		TokenType:    tokenPair.TokenType,
		ExpiresIn:    tokenPair.ExpiresIn,
		SessionID:    sessionID, // Include session ID in response
	}

	// DEBUG: Log the response being sent
	log.Printf("DEBUG: Sending response - User email: %s, Name: %s, Session: %s", response.User.Email, response.User.Name, sessionID)
	respondWithJSON(w, http.StatusOK, response)
}

// validateChromeToken validates Chrome Identity token with Google
func (h *ChromeAuthHandler) validateChromeToken(token string) (*auth.GoogleUserInfo, error) {
	// For Chrome extensions, we need to validate the token with Google's tokeninfo endpoint
	// This is a simpler validation that doesn't require PKCE

	// Google tokeninfo endpoint
	tokenInfoURL := "https://www.googleapis.com/oauth2/v2/tokeninfo"

	req, err := http.NewRequest("GET", tokenInfoURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create tokeninfo request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+token)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to validate token with Google: %w", err)
	}
	defer resp.Body.Close()

	log.Printf("DEBUG: Google tokeninfo response status: %d", resp.StatusCode)

	if resp.StatusCode != http.StatusOK {
		// Read the response body for debugging
		body, _ := io.ReadAll(resp.Body)
		log.Printf("DEBUG: Google tokeninfo error response: %s", string(body))
		return nil, fmt.Errorf("token validation failed with status: %d", resp.StatusCode)
	}

	var tokenInfo struct {
		Email         string `json:"email"`
		Name          string `json:"name"`
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

	// DEBUG: Log what fields we received from Google
	log.Printf("DEBUG: Google tokeninfo response - Email: %s, Name: %s, EmailVerified: %s",
		tokenInfo.Email, tokenInfo.Name, tokenInfo.EmailVerified)

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
		Name:          tokenInfo.Name,
		GivenName:     tokenInfo.GivenName,
		FamilyName:    tokenInfo.FamilyName,
		Picture:       tokenInfo.Picture,
		Locale:        tokenInfo.Locale,
	}

	// For Chrome Identity API, be more lenient with validation
	if googleUserInfo.ID == "" {
		googleUserInfo.ID = "chrome-user-" + tokenInfo.Email // Generate a fallback ID
	}
	if googleUserInfo.Name == "" {
		googleUserInfo.Name = tokenInfo.Email // Use email as fallback name
	}

	// Validate the Google user info (relaxed validation for Chrome)
	if googleUserInfo.Email == "" {
		return nil, fmt.Errorf("invalid Google user info: email is required")
	}

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

