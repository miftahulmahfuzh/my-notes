package tests

import (
	"os"
	"testing"

	"github.com/gpd/my-notes/internal/config"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestConfigLoading(t *testing.T) {
	// Test loading default configuration
	cfg, err := config.LoadConfig("")
	require.NoError(t, err)
	require.NotNil(t, cfg)

	// Test default values (these may be overridden by .env file)
	assert.Equal(t, "localhost", cfg.Server.Host)
	assert.Equal(t, "8080", cfg.Server.Port)

	// The environment should be "test" if .env file is loaded, otherwise "development"
	// Both are valid depending on whether .env exists
	validEnvs := []string{"development", "test"}
	assert.Contains(t, validEnvs, cfg.App.Environment)

	// Debug should be true for both development and test environments
	assert.True(t, cfg.App.Debug)
}

func TestConfigWithEnvironmentVariables(t *testing.T) {
	// Set environment variables
	os.Setenv("SERVER_PORT", "9000")
	os.Setenv("APP_ENV", "test")
	os.Setenv("APP_DEBUG", "false")
	os.Setenv("DB_HOST", "testhost")
	os.Setenv("DB_PASSWORD", "testpass")
	os.Setenv("JWT_SECRET", "test_secret_that_is_long_enough_for_validation")

	defer func() {
		// Clean up environment variables
		os.Unsetenv("SERVER_PORT")
		os.Unsetenv("APP_ENV")
		os.Unsetenv("APP_DEBUG")
		os.Unsetenv("DB_HOST")
		os.Unsetenv("DB_PASSWORD")
		os.Unsetenv("JWT_SECRET")
	}()

	// Load configuration
	cfg, err := config.LoadConfig("")
	require.NoError(t, err)

	// Test environment variable overrides
	assert.Equal(t, "9000", cfg.Server.Port)
	assert.Equal(t, "test", cfg.App.Environment)
	assert.False(t, cfg.App.Debug)
	assert.Equal(t, "testhost", cfg.Database.Host)
	assert.Equal(t, "testpass", cfg.Database.Password)
	assert.Equal(t, "test_secret_that_is_long_enough_for_validation", cfg.Auth.JWTSecret)
}

func TestConfigValidation(t *testing.T) {
	tests := []struct {
		name        string
		config      *config.Config
		expectError bool
		errorMsg    string
	}{
		{
			name: "Valid config",
			config: &config.Config{
				Server: config.ServerConfig{
					Port: "8080",
				},
				Database: config.DatabaseConfig{
					Host:     "localhost",
					Password: "password123",
					Name:     "testdb",
				},
				Auth: config.AuthConfig{
					JWTSecret: "this_is_a_very_long_secret_that_meets_requirements",
				},
				App: config.AppConfig{
					Environment: "development",
				},
			},
			expectError: false,
		},
		{
			name: "Missing server port",
			config: &config.Config{
				Server: config.ServerConfig{
					Port: "",
				},
				Database: config.DatabaseConfig{
					Host:     "localhost",
					Password: "password123",
					Name:     "testdb",
				},
				Auth: config.AuthConfig{
					JWTSecret: "this_is_a_very_long_secret_that_meets_requirements",
				},
				App: config.AppConfig{
					Environment: "development",
				},
			},
			expectError: true,
			errorMsg:    "server port is required",
		},
		{
			name: "Missing database password",
			config: &config.Config{
				Server: config.ServerConfig{
					Port: "8080",
				},
				Database: config.DatabaseConfig{
					Host:     "localhost",
					Password: "",
					Name:     "testdb",
				},
				Auth: config.AuthConfig{
					JWTSecret: "this_is_a_very_long_secret_that_meets_requirements",
				},
				App: config.AppConfig{
					Environment: "development",
				},
			},
			expectError: true,
			errorMsg:    "database password is required",
		},
		{
			name: "Short JWT secret",
			config: &config.Config{
				Server: config.ServerConfig{
					Port: "8080",
				},
				Database: config.DatabaseConfig{
					Host:     "localhost",
					Password: "password123",
					Name:     "testdb",
				},
				Auth: config.AuthConfig{
					JWTSecret: "short",
				},
				App: config.AppConfig{
					Environment: "development",
				},
			},
			expectError: true,
			errorMsg:    "JWT secret must be at least 32 characters long",
		},
		{
			name: "Invalid environment",
			config: &config.Config{
				Server: config.ServerConfig{
					Port: "8080",
				},
				Database: config.DatabaseConfig{
					Host:     "localhost",
					Password: "password123",
					Name:     "testdb",
				},
				Auth: config.AuthConfig{
					JWTSecret: "this_is_a_very_long_secret_that_meets_requirements",
				},
				App: config.AppConfig{
					Environment: "invalid",
				},
			},
			expectError: true,
			errorMsg:    "invalid environment: invalid",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.config.Validate()

			if tt.expectError {
				assert.Error(t, err)
				if tt.errorMsg != "" {
					assert.Contains(t, err.Error(), tt.errorMsg)
				}
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestConfigHelperMethods(t *testing.T) {
	cfg := &config.Config{
		App: config.AppConfig{
			Environment: "development",
		},
		Server: config.ServerConfig{
			Host: "localhost",
			Port: "8080",
		},
		Database: config.DatabaseConfig{
			Host:     "localhost",
			Port:     5432,
			User:     "postgres",
			Password: "password",
			Name:     "testdb",
			SSLMode:  "disable",
		},
	}

	// Test environment helpers
	assert.True(t, cfg.IsDevelopment())
	assert.False(t, cfg.IsTest())
	assert.False(t, cfg.IsProduction())

	// Test address methods
	assert.Equal(t, "localhost:8080", cfg.Server.Address())
	assert.Equal(t, "host=localhost port=5432 user=postgres password=password dbname=testdb sslmode=disable", cfg.Database.DSN())
}

func TestConfigEnvironmentDetection(t *testing.T) {
	environments := []string{"development", "test", "staging", "production"}

	for _, env := range environments {
		t.Run("Environment_"+env, func(t *testing.T) {
			os.Setenv("APP_ENV", env)
			defer os.Unsetenv("APP_ENV")

			cfg, err := config.LoadConfig("")
			require.NoError(t, err)

			assert.Equal(t, env, cfg.App.Environment)

			switch env {
			case "development":
				assert.True(t, cfg.IsDevelopment())
				assert.False(t, cfg.IsTest())
				assert.False(t, cfg.IsProduction())
			case "test":
				assert.False(t, cfg.IsDevelopment())
				assert.True(t, cfg.IsTest())
				assert.False(t, cfg.IsProduction())
			case "production":
				assert.False(t, cfg.IsDevelopment())
				assert.False(t, cfg.IsTest())
				assert.True(t, cfg.IsProduction())
			}
		})
	}
}