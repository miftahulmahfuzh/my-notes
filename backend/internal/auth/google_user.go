package auth

import (
	"errors"
)

// GoogleUserInfo represents user information from Google OAuth
type GoogleUserInfo struct {
	ID            string `json:"id"`
	Email         string `json:"email"`
	VerifiedEmail bool   `json:"verified_email"`
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
	return nil
}