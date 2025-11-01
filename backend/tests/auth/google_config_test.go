package auth

import (
	"testing"

	"github.com/gpd/my-notes/internal/auth"
	"github.com/stretchr/testify/assert"
)

func TestGoogleConfigValidation(t *testing.T) {
	tests := []struct {
		name    string
		config  auth.GoogleConfig
		wantErr bool
	}{
		{
			name: "valid config",
			config: auth.GoogleConfig{
				ClientID:     "test-client-id",
				ClientSecret: "test-client-secret",
				RedirectURL:  "http://localhost:8080/auth/callback",
				Scopes:       []string{"openid", "email", "profile"},
			},
			wantErr: false,
		},
		{
			name: "missing client ID",
			config: auth.GoogleConfig{
				ClientSecret: "test-client-secret",
				RedirectURL:  "http://localhost:8080/auth/callback",
				Scopes:       []string{"openid", "email", "profile"},
			},
			wantErr: true,
		},
		{
			name: "missing client secret",
			config: auth.GoogleConfig{
				ClientID:    "test-client-id",
				RedirectURL: "http://localhost:8080/auth/callback",
				Scopes:      []string{"openid", "email", "profile"},
			},
			wantErr: true,
		},
		{
			name: "missing redirect URL",
			config: auth.GoogleConfig{
				ClientID:     "test-client-id",
				ClientSecret: "test-client-secret",
				Scopes:       []string{"openid", "email", "profile"},
			},
			wantErr: true,
		},
		{
			name: "empty scopes",
			config: auth.GoogleConfig{
				ClientID:     "test-client-id",
				ClientSecret: "test-client-secret",
				RedirectURL:  "http://localhost:8080/auth/callback",
				Scopes:       []string{},
			},
			wantErr: true,
		},
		{
			name: "invalid redirect URL",
			config: auth.GoogleConfig{
				ClientID:     "test-client-id",
				ClientSecret: "test-client-secret",
				RedirectURL:  "invalid-url",
				Scopes:       []string{"openid", "email", "profile"},
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.config.Validate()
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestDefaultScopes(t *testing.T) {
	scopes := auth.DefaultScopes()

	expectedScopes := []string{"openid", "email", "profile"}
	assert.Equal(t, expectedScopes, scopes)
}

func TestNewGoogleConfig(t *testing.T) {
	config := auth.NewGoogleConfig()

	assert.NotNil(t, config)
	assert.Equal(t, auth.DefaultScopes(), config.Scopes)
	assert.Empty(t, config.ClientID)
	assert.Empty(t, config.ClientSecret)
	assert.Empty(t, config.RedirectURL)
}

func TestGoogleConfigWithValidURL(t *testing.T) {
	config := auth.GoogleConfig{
		ClientID:     "test-client-id",
		ClientSecret: "test-client-secret",
		RedirectURL:  "https://example.com/auth/callback",
		Scopes:       []string{"openid", "email"},
	}

	err := config.Validate()
	assert.NoError(t, err)
}