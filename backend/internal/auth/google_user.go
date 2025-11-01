package auth

import (
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/gpd/my-notes/internal/models"
)

// GoogleUserInfo represents user information from Google OAuth
type GoogleUserInfo struct {
	ID            string `json:"id"`
	Email         string `json:"email"`
	VerifiedEmail bool   `json:"verified_email"`
	Name          string `json:"name"`
	GivenName     string `json:"given_name"`
	FamilyName    string `json:"family_name"`
	Picture       string `json:"picture"`
	Locale        string `json:"locale"`
}

// Validate validates the Google user info
func (g *GoogleUserInfo) Validate() error {
	if g.ID == "" {
		return errors.New("google user ID is required")
	}
	if g.Email == "" {
		return errors.New("google user email is required")
	}
	if g.Name == "" {
		return errors.New("google user name is required")
	}
	return nil
}

// ToUser converts GoogleUserInfo to a User model
func (g *GoogleUserInfo) ToUser() models.User {
	now := time.Now()
	return models.User{
		ID:        uuid.New(),
		GoogleID:  g.ID,
		Email:     g.Email,
		Name:      g.Name,
		AvatarURL: &g.Picture,
		Preferences: models.UserPreferences{
			Theme:              "light",
			Language:           "en",
			TimeZone:           "UTC",
			EmailNotifications: true,
			AutoSave:           true,
			DefaultNoteView:    "grid",
		},
		CreatedAt: now,
		UpdatedAt: now,
	}
}

// GoogleTokenResponse represents the token response from Google OAuth
type GoogleTokenResponse struct {
	AccessToken      string `json:"access_token"`
	TokenType        string `json:"token_type"`
	ExpiresIn        int    `json:"expires_in"`
	RefreshToken     string `json:"refresh_token"`
	Scope            string `json:"scope"`
	IDToken          string `json:"id_token"`
	Error            string `json:"error"`
	ErrorDescription string `json:"error_description"`
}