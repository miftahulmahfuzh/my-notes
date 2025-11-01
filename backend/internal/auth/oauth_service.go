package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

// OAuthService handles Google OAuth 2.0 operations with PKCE
type OAuthService struct {
	config         *GoogleConfig
	oauth2Config   *oauth2.Config
	codeVerifierStore map[string]string // In production, use Redis or database
}

// NewOAuthService creates a new OAuthService instance
func NewOAuthService(config *GoogleConfig) *OAuthService {
	oauth2Config := &oauth2.Config{
		ClientID:     config.ClientID,
		ClientSecret: config.ClientSecret,
		RedirectURL:  config.RedirectURL,
		Scopes:       config.Scopes,
		Endpoint:     google.Endpoint,
	}

	return &OAuthService{
		config:           config,
		oauth2Config:     oauth2Config,
		codeVerifierStore: make(map[string]string),
	}
}

// GetAuthURL generates the Google OAuth authorization URL with PKCE
func (s *OAuthService) GetAuthURL(state string) (string, error) {
	// Generate PKCE code verifier and challenge
	codeVerifier, err := GenerateCodeVerifier()
	if err != nil {
		return "", fmt.Errorf("failed to generate code verifier: %w", err)
	}

	codeChallenge := GenerateCodeChallenge(codeVerifier)

	// Store code verifier temporarily (in production, use Redis with expiration)
	s.codeVerifierStore[state] = codeVerifier

	// Clean up old entries (simple cleanup, in production use proper TTL)
	go func() {
		time.Sleep(10 * time.Minute)
		delete(s.codeVerifierStore, state)
	}()

	authURL := s.oauth2Config.AuthCodeURL(state, oauth2.AccessTypeOffline,
		oauth2.S256ChallengeOption(codeChallenge))

	return authURL, nil
}

// ExchangeCodeForToken exchanges the authorization code for access tokens
func (s *OAuthService) ExchangeCodeForToken(code, state, codeVerifier string) (*oauth2.Token, error) {
	// Retrieve stored code verifier
	storedVerifier, exists := s.codeVerifierStore[state]
	if !exists {
		return nil, fmt.Errorf("state parameter not found or expired")
	}

	// In a real implementation, you might want to compare provided verifier
	// with stored one for additional security
	if codeVerifier != "" && codeVerifier != storedVerifier {
		return nil, fmt.Errorf("invalid code verifier")
	}

	// Exchange authorization code for token
	token, err := s.oauth2Config.Exchange(context.Background(), code,
		oauth2.S256ChallengeOption(storedVerifier))
	if err != nil {
		return nil, fmt.Errorf("failed to exchange code for token: %w", err)
	}

	// Clean up the stored code verifier
	delete(s.codeVerifierStore, state)

	return token, nil
}

// GetUserInfo retrieves user information from Google using the access token
func (s *OAuthService) GetUserInfo(token *oauth2.Token) (*GoogleUserInfo, error) {
	client := s.oauth2Config.Client(context.Background(), token)

	resp, err := client.Get("https://www.googleapis.com/oauth2/v2/userinfo")
	if err != nil {
		return nil, fmt.Errorf("failed to get user info: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	var userInfo GoogleUserInfo
	if err := json.Unmarshal(body, &userInfo); err != nil {
		return nil, fmt.Errorf("failed to unmarshal user info: %w", err)
	}

	if err := userInfo.Validate(); err != nil {
		return nil, fmt.Errorf("invalid user info: %w", err)
	}

	return &userInfo, nil
}

// ValidateState validates the state parameter for CSRF protection
func (s *OAuthService) ValidateState(state string) error {
	if state == "" {
		return fmt.Errorf("state parameter is required")
	}

	if len(state) < 16 {
		return fmt.Errorf("state parameter too short")
	}

	// In production, you might want to check if the state exists in your store
	// and hasn't been used before
	_, exists := s.codeVerifierStore[state]
	if !exists {
		return fmt.Errorf("invalid or expired state parameter")
	}

	return nil
}

// GenerateCodeVerifier generates a PKCE code verifier (43-128 characters)
func GenerateCodeVerifier() (string, error) {
	const (
		minLength = 43
		maxLength = 128
		charset  = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~"
	)

	// Generate random bytes
	randomBytes := make([]byte, 32)
	if _, err := rand.Read(randomBytes); err != nil {
		return "", fmt.Errorf("failed to generate random bytes: %w", err)
	}

	// Convert to base64url and ensure proper length
	verifier := base64.RawURLEncoding.EncodeToString(randomBytes)

	// Truncate or pad to meet PKCE requirements
	if len(verifier) > maxLength {
		verifier = verifier[:maxLength]
	} else if len(verifier) < minLength {
		// Pad with additional random characters if needed
		for len(verifier) < minLength {
			extraBytes := make([]byte, 8)
			if _, err := rand.Read(extraBytes); err != nil {
				return "", fmt.Errorf("failed to generate padding bytes: %w", err)
			}
			verifier += base64.RawURLEncoding.EncodeToString(extraBytes)
		}
		verifier = verifier[:minLength]
	}

	return verifier, nil
}

// GenerateCodeChallenge generates a PKCE code challenge from the verifier
func GenerateCodeChallenge(codeVerifier string) string {
	hash := sha256.Sum256([]byte(codeVerifier))
	return base64.RawURLEncoding.EncodeToString(hash[:])
}

// GenerateSecureState generates a cryptographically secure state parameter
func GenerateSecureState() (string, error) {
	const stateLength = 32

	randomBytes := make([]byte, stateLength)
	if _, err := rand.Read(randomBytes); err != nil {
		return "", fmt.Errorf("failed to generate secure state: %w", err)
	}

	return base64.RawURLEncoding.EncodeToString(randomBytes), nil
}

// VerifyRedirectURL ensures the redirect URL is safe and matches expected format
func (s *OAuthService) VerifyRedirectURL(redirectURL string) error {
	if redirectURL == "" {
		return fmt.Errorf("redirect URL is required")
	}

	// Parse the redirect URL
	parsedURL, err := url.Parse(redirectURL)
	if err != nil {
		return fmt.Errorf("invalid redirect URL: %w", err)
	}

	// Check if the redirect URL matches the configured redirect URL
	configURL, err := url.Parse(s.config.RedirectURL)
	if err != nil {
		return fmt.Errorf("invalid configured redirect URL: %w", err)
	}

	// Compare scheme, host, and path
	if parsedURL.Scheme != configURL.Scheme ||
		parsedURL.Host != configURL.Host ||
		parsedURL.Path != configURL.Path {
		return fmt.Errorf("redirect URL does not match configured URL")
	}

	return nil
}