package auth

import (
	"errors"

	"github.com/go-playground/validator/v10"
)

// GoogleConfig represents Google OAuth 2.0 configuration
type GoogleConfig struct {
	ClientID     string   `yaml:"client_id" env:"GOOGLE_CLIENT_ID" envRequired:"true" validate:"required"`
	ClientSecret string   `yaml:"client_secret" env:"GOOGLE_CLIENT_SECRET" envRequired:"true" validate:"required"`
	RedirectURL  string   `yaml:"redirect_url" env:"GOOGLE_REDIRECT_URL" envRequired:"true" validate:"required,url"`
	Scopes       []string `yaml:"scopes" env:"GOOGLE_SCOPES" envDefault:"openid,email,profile" validate:"required,dive,required"`
}

// Validate validates the Google OAuth configuration
func (g *GoogleConfig) Validate() error {
	validate := validator.New()

	if err := validate.Struct(g); err != nil {
		return err
	}

	if g.ClientID == "" {
		return errors.New("google client ID is required")
	}
	if g.ClientSecret == "" {
		return errors.New("google client secret is required")
	}
	if g.RedirectURL == "" {
		return errors.New("google redirect URL is required")
	}
	if len(g.Scopes) == 0 {
		return errors.New("google OAuth scopes are required")
	}

	return nil
}

// DefaultScopes returns the default OAuth scopes for Google
func DefaultScopes() []string {
	return []string{"openid", "email", "profile"}
}