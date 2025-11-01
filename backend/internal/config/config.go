package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

// Config represents the application configuration
type Config struct {
	Server   ServerConfig   `yaml:"server" env-prefix:"SERVER_"`
	Database DatabaseConfig `yaml:"database" env-prefix:"DB_"`
	Redis    RedisConfig    `yaml:"redis" env-prefix:"REDIS_"`
	Auth     AuthConfig     `yaml:"auth" env-prefix:"AUTH_"`
	App      AppConfig      `yaml:"app" env-prefix:"APP_"`
	CORS     CORSConfig     `yaml:"cors" env-prefix:"CORS_"`
}

// ServerConfig represents server configuration
type ServerConfig struct {
	Host         string `yaml:"host" env:"HOST" envDefault:"localhost"`
	Port         string `yaml:"port" env:"PORT" envDefault:"8080"`
	ReadTimeout  int    `yaml:"read_timeout" env:"READ_TIMEOUT" envDefault:"30"`
	WriteTimeout int    `yaml:"write_timeout" env:"WRITE_TIMEOUT" envDefault:"30"`
	IdleTimeout  int    `yaml:"idle_timeout" env:"IDLE_TIMEOUT" envDefault:"60"`
}

// DatabaseConfig represents database configuration
type DatabaseConfig struct {
	Host     string `yaml:"host" env:"HOST" envDefault:"localhost"`
	Port     int    `yaml:"port" env:"PORT" envDefault:"5432"`
	Name     string `yaml:"name" env:"NAME" envDefault:"notes_dev"`
	User     string `yaml:"user" env:"USER" envDefault:"postgres"`
	Password string `yaml:"password" env:"PASSWORD" envRequired:"true"`
	SSLMode  string `yaml:"ssl_mode" env:"SSLMODE" envDefault:"disable"`
}

// RedisConfig represents Redis configuration
type RedisConfig struct {
	Host     string `yaml:"host" env:"HOST" envDefault:"localhost"`
	Port     int    `yaml:"port" env:"PORT" envDefault:"6379"`
	Password string `yaml:"password" env:"PASSWORD" envDefault:""`
	DB       int    `yaml:"db" env:"DB" envDefault:"0"`
}

// AuthConfig represents authentication configuration
type AuthConfig struct {
	JWTSecret        string `yaml:"jwt_secret" env:"JWT_SECRET" envRequired:"true"`
	GoogleClientID   string `yaml:"google_client_id" env:"GOOGLE_CLIENT_ID"`
	GoogleClientSecret string `yaml:"google_client_secret" env:"GOOGLE_CLIENT_SECRET"`
	GoogleRedirectURL string `yaml:"google_redirect_url" env:"GOOGLE_REDIRECT_URL"`
	TokenExpiry      int    `yaml:"token_expiry" env:"TOKEN_EXPIRY" envDefault:"24"` // hours
	RefreshExpiry    int    `yaml:"refresh_expiry" env:"REFRESH_EXPIRY" envDefault:"168"` // 7 days
}

// AppConfig represents application configuration
type AppConfig struct {
	Environment string `yaml:"environment" env:"ENVIRONMENT" envDefault:"development"`
	Debug       bool   `yaml:"debug" env:"DEBUG" envDefault:"true"`
	LogLevel    string `yaml:"log_level" env:"LOG_LEVEL" envDefault:"info"`
	Version     string `yaml:"version" env:"VERSION" envDefault:"1.0.0"`
}

// CORSConfig represents CORS configuration
type CORSConfig struct {
	AllowedOrigins   []string `yaml:"allowed_origins" env:"ALLOWED_ORIGINS" envDefault:"*"`
	AllowedMethods   []string `yaml:"allowed_methods" env:"ALLOWED_METHODS" envDefault:"GET,POST,PUT,DELETE,OPTIONS"`
	AllowedHeaders   []string `yaml:"allowed_headers" env:"ALLOWED_HEADERS" envDefault:"*"`
	ExposedHeaders   []string `yaml:"exposed_headers" env:"EXPOSED_HEADERS" envDefault:""`
	AllowCredentials bool     `yaml:"allow_credentials" env:"ALLOW_CREDENTIALS" envDefault:"false"`
	MaxAge           int      `yaml:"max_age" env:"MAX_AGE" envDefault:"86400"`
}

// LoadConfig loads configuration from environment variables and optional config file
func LoadConfig(configPath string) (*Config, error) {
	// Load .env file if it exists
	// Try to load from current directory first, then from parent directory
	envPaths := []string{".env", "../.env", "../../.env"}
	var envErr error
	for _, path := range envPaths {
		if err := godotenv.Load(path); err == nil {
			// Successfully loaded .env file
			break
		} else if !os.IsNotExist(err) {
			envErr = fmt.Errorf("failed to load .env file from %s: %w", path, err)
		}
	}

	// If we have a non-file-not-found error, return it
	if envErr != nil {
		return nil, envErr
	}

	config := &Config{
		Server: ServerConfig{
			Host:         getEnv("SERVER_HOST", "localhost"),
			Port:         getEnv("SERVER_PORT", "8080"),
			ReadTimeout:  getEnvInt("SERVER_READ_TIMEOUT", 30),
			WriteTimeout: getEnvInt("SERVER_WRITE_TIMEOUT", 30),
			IdleTimeout:  getEnvInt("SERVER_IDLE_TIMEOUT", 60),
		},
		Database: DatabaseConfig{
			Host:     getEnv("DB_HOST", "localhost"),
			Port:     getEnvInt("DB_PORT", 5432),
			Name:     getEnv("DB_NAME", "notes_dev"),
			User:     getEnv("DB_USER", "postgres"),
			Password: getEnv("DB_PASSWORD", ""),
			SSLMode:  getEnv("DB_SSLMODE", "disable"),
		},
		Redis: RedisConfig{
			Host:     getEnv("REDIS_HOST", "localhost"),
			Port:     getEnvInt("REDIS_PORT", 6379),
			Password: getEnv("REDIS_PASSWORD", ""),
			DB:       getEnvInt("REDIS_DB", 0),
		},
		Auth: AuthConfig{
			JWTSecret:         getEnv("JWT_SECRET", ""),
			GoogleClientID:    getEnv("GOOGLE_CLIENT_ID", ""),
			GoogleClientSecret: getEnv("GOOGLE_CLIENT_SECRET", ""),
			GoogleRedirectURL: getEnv("GOOGLE_REDIRECT_URL", ""),
			TokenExpiry:       getEnvInt("AUTH_TOKEN_EXPIRY", 24),
			RefreshExpiry:     getEnvInt("AUTH_REFRESH_EXPIRY", 168),
		},
		App: AppConfig{
			Environment: getEnv("APP_ENV", "development"),
			Debug:       getEnvBool("APP_DEBUG", true),
			LogLevel:    getEnv("APP_LOG_LEVEL", "info"),
			Version:     getEnv("APP_VERSION", "1.0.0"),
		},
		CORS: CORSConfig{
			AllowedOrigins:   getEnvSlice("CORS_ALLOWED_ORIGINS", []string{"*"}),
			AllowedMethods:   getEnvSlice("CORS_ALLOWED_METHODS", []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}),
			AllowedHeaders:   getEnvSlice("CORS_ALLOWED_HEADERS", []string{"*"}),
			ExposedHeaders:   getEnvSlice("CORS_EXPOSED_HEADERS", []string{}),
			AllowCredentials: getEnvBool("CORS_ALLOW_CREDENTIALS", false),
			MaxAge:           getEnvInt("CORS_MAX_AGE", 86400),
		},
	}

	return config, nil
}

// Validate validates the configuration
func (c *Config) Validate() error {
	// Validate server config
	if c.Server.Port == "" {
		return fmt.Errorf("server port is required")
	}

	// Validate database config
	if c.Database.Host == "" {
		return fmt.Errorf("database host is required")
	}
	if c.Database.Password == "" {
		return fmt.Errorf("database password is required")
	}
	if c.Database.Name == "" {
		return fmt.Errorf("database name is required")
	}

	// Validate auth config
	if c.Auth.JWTSecret == "" {
		return fmt.Errorf("JWT secret is required")
	}
	if len(c.Auth.JWTSecret) < 32 {
		return fmt.Errorf("JWT secret must be at least 32 characters long")
	}

	// Validate app config
	validEnvironments := []string{"development", "test", "staging", "production"}
	if !contains(validEnvironments, c.App.Environment) {
		return fmt.Errorf("invalid environment: %s", c.App.Environment)
	}

	return nil
}

// IsDevelopment returns true if running in development environment
func (c *Config) IsDevelopment() bool {
	return c.App.Environment == "development"
}

// IsTest returns true if running in test environment
func (c *Config) IsTest() bool {
	return c.App.Environment == "test"
}

// IsProduction returns true if running in production environment
func (c *Config) IsProduction() bool {
	return c.App.Environment == "production"
}

// DSN returns the database connection string
func (c *DatabaseConfig) DSN() string {
	return fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		c.Host, c.Port, c.User, c.Password, c.Name, c.SSLMode)
}

// Address returns the server address
func (c *ServerConfig) Address() string {
	return fmt.Sprintf("%s:%s", c.Host, c.Port)
}

// RedisAddr returns the Redis address
func (c *RedisConfig) RedisAddr() string {
	return fmt.Sprintf("%s:%d", c.Host, c.Port)
}

// Helper functions

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

func getEnvBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		if boolValue, err := strconv.ParseBool(value); err == nil {
			return boolValue
		}
	}
	return defaultValue
}

func getEnvSlice(key string, defaultValue []string) []string {
	if value := os.Getenv(key); value != "" {
		return strings.Split(value, ",")
	}
	return defaultValue
}

func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}