package config

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

// SecurityConfig holds all security-related configuration
type SecurityConfig struct {
	// Rate limiting configuration
	RateLimiting RateLimitConfig `yaml:"rate_limiting"`

	// CORS configuration
	CORS CORSConfig `yaml:"cors"`

	// Session management
	Session SessionConfig `yaml:"session"`

	// Security headers
	Headers SecurityHeadersConfig `yaml:"headers"`

	// Monitoring and logging
	Monitoring MonitoringConfig `yaml:"monitoring"`

	// Token configuration
	Token TokenConfig `yaml:"token"`

	// Database security
	Database DatabaseSecurityConfig `yaml:"database"`
}

// RateLimitConfig holds rate limiting configuration
type RateLimitConfig struct {
	// Global rate limits
	GlobalRequestsPerSecond float64 `yaml:"global_requests_per_second" default:"100"`
	GlobalBurstSize         int     `yaml:"global_burst_size" default:"200"`

	// User rate limits
	UserRequestsPerMinute   int `yaml:"user_requests_per_minute" default:"60"`
	UserRequestsPerHour     int `yaml:"user_requests_per_hour" default:"1000"`
	UserRequestsPerDay      int `yaml:"user_requests_per_day" default:"10000"`

	// Endpoint-specific limits
	AuthRequestsPerMinute   int `yaml:"auth_requests_per_minute" default:"10"`
	ProfileRequestsPerMinute int `yaml:"profile_requests_per_minute" default:"30"`
	SearchRequestsPerMinute int `yaml:"search_requests_per_minute" default:"20"`
	NotesRequestsPerMinute  int `yaml:"notes_requests_per_minute" default:"100"`

	// Whitelist for unlimited access
	WhitelistedIPs  []string `yaml:"whitelisted_ips"`
	WhitelistedUsers []string `yaml:"whitelisted_users"`
}


// SessionConfig holds session management configuration
type SessionConfig struct {
	SessionTimeout     time.Duration `yaml:"session_timeout" default:"24h"`
	MaxSessions        int           `yaml:"max_sessions" default:"10"` // Increased from 5 to accommodate Chrome extension behavior
	EnableConcurrency  bool          `yaml:"enable_concurrency" default:"true"`
	InactiveTimeout    time.Duration `yaml:"inactive_timeout" default:"168h"` // 7 days
	RefreshThreshold   time.Duration `yaml:"refresh_threshold" default:"5m"`
	CleanupInterval    time.Duration `yaml:"cleanup_interval" default:"1h"`
}

// SecurityHeadersConfig holds security headers configuration
type SecurityHeadersConfig struct {
	// Content Security Policy
	ContentSecurityPolicy string `yaml:"content_security_policy" default:"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; font-src 'self';"`

	// Frame protection
	XFrameOptions string `yaml:"x_frame_options" default:"DENY"`

	// Content type protection
	XContentTypeOptions string `yaml:"x_content_type_options" default:"nosniff"`

	// XSS protection
	XSSProtection string `yaml:"xss_protection" default:"1; mode=block"`

	// HTTP Strict Transport Security
	StrictTransportSecurity string `yaml:"strict_transport_security" default:"max-age=31536000; includeSubDomains"`

	// Referrer policy
	ReferrerPolicy string `yaml:"referrer_policy" default:"strict-origin-when-cross-origin"`

	// Additional headers
	PermissionsPolicy string `yaml:"permissions_policy" default:"geolocation=(), microphone=(), camera=()"`
}

// MonitoringConfig holds monitoring and logging configuration
type MonitoringConfig struct {
	// Request logging
	LogRequests    bool   `yaml:"log_requests" default:"true"`
	LogLevel       string `yaml:"log_level" default:"info"`

	// Request ID
	EnableRequestID bool   `yaml:"enable_request_id" default:"true"`

	// Performance monitoring
	TrackResponseTime bool          `yaml:"track_response_time" default:"true"`
	SlowRequestThreshold time.Duration `yaml:"slow_request_threshold" default:"1s"`

	// Security monitoring
	LogSecurityEvents bool `yaml:"log_security_events" default:"true"`
	EnableAuditLog     bool `yaml:"enable_audit_log" default:"true"`

	// Metrics
	EnableMetrics bool `yaml:"enable_metrics" default:"true"`
	MetricsPort   int  `yaml:"metrics_port" default:"9090"`
}

// TokenConfig holds token configuration
type TokenConfig struct {
	// JWT configuration
	SecretKey      string        `yaml:"secret_key"`
	AccessExpiry   time.Duration `yaml:"access_expiry" default:"15m"`
	RefreshExpiry  time.Duration `yaml:"refresh_expiry" default:"24h"`
	Issuer         string        `yaml:"issuer" default:"silence-notes"`
	Audience       string        `yaml:"audience" default:"silence-notes-users"`

	// Token validation
	ValidateIssuer bool          `yaml:"validate_issuer" default:"true"`
	ValidateAudience bool         `yaml:"validate_audience" default:"true"`
	Leeway         time.Duration `yaml:"leeway" default:"10s"`

	// Token blacklist
	EnableBlacklist bool          `yaml:"enable_blacklist" default:"true"`
	BlacklistCache  time.Duration `yaml:"blacklist_cache" default:"5m"`
}

// DatabaseSecurityConfig holds database security configuration
type DatabaseSecurityConfig struct {
	// Connection security
	SSLMode        string `yaml:"ssl_mode" default:"require"`
	MaxConnections  int    `yaml:"max_connections" default:"100"`
	MaxIdleTime     int    `yaml:"max_idle_time" default:"30"`

	// Query security
	QueryTimeout    time.Duration `yaml:"query_timeout" default:"30s"`
	MaxQueryRows    int           `yaml:"max_query_rows" default:"10000"`

	// Connection pooling
	MaxIdleConns    int `yaml:"max_idle_conns" default:"10"`
	MinConns        int `yaml:"min_conns" default:"1"`
	MaxConnLifetime int `yaml:"max_conn_lifetime" default:"3600"`

	// Encryption
	EncryptDataAtRest bool `yaml:"encrypt_data_at_rest" default:"true"`
	EncryptionKey    string `yaml:"encryption_key"`
}

// GetDefaultSecurityConfig returns the default security configuration
func GetDefaultSecurityConfig() *SecurityConfig {
	// Helper functions to get environment variables with defaults
	getEnvInt := func(key string, defaultValue int) int {
		if value := os.Getenv(key); value != "" {
			if intValue, err := strconv.Atoi(value); err == nil {
				return intValue
			}
		}
		return defaultValue
	}

	getEnvFloat := func(key string, defaultValue float64) float64 {
		if value := os.Getenv(key); value != "" {
			if floatValue, err := strconv.ParseFloat(value, 64); err == nil {
				return floatValue
			}
		}
		return defaultValue
	}

	getEnvBool := func(key string, defaultValue bool) bool {
		if value := os.Getenv(key); value != "" {
			if boolValue, err := strconv.ParseBool(value); err == nil {
				return boolValue
			}
		}
		return defaultValue
	}

	return &SecurityConfig{
		RateLimiting: RateLimitConfig{
			GlobalRequestsPerSecond: getEnvFloat("GLOBAL_REQUESTS_PER_SECOND", 100),
			GlobalBurstSize:         getEnvInt("GLOBAL_BURST_SIZE", 200),
			UserRequestsPerMinute:   getEnvInt("USER_REQUESTS_PER_MINUTE", 60),
			UserRequestsPerHour:     getEnvInt("USER_REQUESTS_PER_HOUR", 1000),
			UserRequestsPerDay:      getEnvInt("USER_REQUESTS_PER_DAY", 10000),
			AuthRequestsPerMinute:   getEnvInt("AUTH_REQUESTS_PER_MINUTE", 10),
			ProfileRequestsPerMinute: getEnvInt("PROFILE_REQUESTS_PER_MINUTE", 30),
			SearchRequestsPerMinute: getEnvInt("SEARCH_REQUESTS_PER_MINUTE", 20),
			NotesRequestsPerMinute:  getEnvInt("NOTES_REQUESTS_PER_MINUTE", 100),
			WhitelistedIPs:          []string{},
			WhitelistedUsers:        []string{},
		},
		CORS: CORSConfig{
			AllowedOrigins:   []string{"http://localhost:3000", "chrome-extension://*"},
			AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
			AllowedHeaders:   []string{"Content-Type", "Authorization", "X-Request-ID"},
			ExposedHeaders:   []string{},
			AllowCredentials: false,
			MaxAge:           86400,
		},
		Session: SessionConfig{
			SessionTimeout:     24 * time.Hour,
			MaxSessions:        10, // Increased from 5 to accommodate Chrome extension behavior
			EnableConcurrency:  true,
			InactiveTimeout:    7 * 24 * time.Hour,
			RefreshThreshold:   5 * time.Minute,
			CleanupInterval:    time.Hour,
		},
		Headers: SecurityHeadersConfig{
			ContentSecurityPolicy:   "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; font-src 'self';",
			XFrameOptions:          "DENY",
			XContentTypeOptions:     "nosniff",
			XSSProtection:          "1; mode=block",
			StrictTransportSecurity: "max-age=31536000; includeSubDomains",
			ReferrerPolicy:         "strict-origin-when-cross-origin",
			PermissionsPolicy:       "geolocation=(), microphone=(), camera=()",
		},
		Monitoring: MonitoringConfig{
			LogRequests:         getEnvBool("LOG_REQUESTS", true),
			LogLevel:            getEnv("LOG_LEVEL", "info"),
			EnableRequestID:      getEnvBool("ENABLE_REQUEST_ID", true),
			TrackResponseTime:    getEnvBool("TRACK_RESPONSE_TIME", true),
			SlowRequestThreshold: time.Duration(getEnvInt("SLOW_REQUEST_THRESHOLD", 1)) * time.Second,
			LogSecurityEvents:   getEnvBool("LOG_SECURITY_EVENTS", true),
			EnableAuditLog:       getEnvBool("ENABLE_AUDIT_LOG", true),
			EnableMetrics:        getEnvBool("ENABLE_METRICS", true),
			MetricsPort:          getEnvInt("METRICS_PORT", 9090),
		},
		Token: TokenConfig{
			AccessExpiry:    15 * time.Minute,
			RefreshExpiry:   24 * time.Hour,
			Issuer:          "silence-notes",
			Audience:        "silence-notes-users",
			ValidateIssuer:   true,
			ValidateAudience: true,
			Leeway:          10 * time.Second,
			EnableBlacklist: true,
			BlacklistCache:  5 * time.Minute,
		},
		Database: DatabaseSecurityConfig{
			SSLMode:        "require",
			MaxConnections:  100,
			MaxIdleTime:     30,
			QueryTimeout:    30 * time.Second,
			MaxQueryRows:    10000,
			MaxIdleConns:    10,
			MinConns:        1,
			MaxConnLifetime: 3600,
			EncryptDataAtRest: true,
		},
	}
}

// GetDevelopmentSecurityConfig returns security config for development
func GetDevelopmentSecurityConfig() *SecurityConfig {
	config := GetDefaultSecurityConfig()

	// Relax security for development
	config.Headers.StrictTransportSecurity = ""
	config.Headers.ContentSecurityPolicy = "default-src 'self' 'unsafe-inline' 'unsafe-eval';"
	config.Headers.XSSProtection = ""

	// Increase rate limits for development
	config.RateLimiting.GlobalRequestsPerSecond = 1000
	config.RateLimiting.UserRequestsPerMinute = 600
	config.RateLimiting.UserRequestsPerHour = 10000

	// Allow more origins for development
	config.CORS.AllowedOrigins = []string{
		"http://localhost:3000",
		"http://localhost:8080",
		"http://127.0.0.1:3000",
		"chrome-extension://*",
	}
	config.CORS.AllowCredentials = true

	return config
}

// GetProductionSecurityConfig returns security config for production
func GetProductionSecurityConfig() *SecurityConfig {
	config := GetDefaultSecurityConfig()

	// Strengthen security for production
	config.Headers.StrictTransportSecurity = "max-age=31536000; includeSubDomains; preload"
	config.Headers.ContentSecurityPolicy = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https:; connect-src 'self'; font-src 'self'; frame-ancestors 'none';"

	// Stricter rate limits for production
	config.RateLimiting.GlobalRequestsPerSecond = 50
	config.RateLimiting.UserRequestsPerMinute = 30
	config.RateLimiting.UserRequestsPerHour = 500
	config.RateLimiting.UserRequestsPerDay = 5000

	// Shorter session timeout for production
	config.Session.SessionTimeout = 8 * time.Hour
	config.Session.MaxSessions = 3

	// Enable all monitoring
	config.Monitoring.LogRequests = true
	config.Monitoring.LogSecurityEvents = true
	config.Monitoring.EnableAuditLog = true
	config.Monitoring.EnableMetrics = true

	return config
}

// ValidateSecurityConfig validates the security configuration
func ValidateSecurityConfig(config *SecurityConfig) error {
	// Validate rate limiting
	if config.RateLimiting.GlobalRequestsPerSecond <= 0 {
		return fmt.Errorf("global_requests_per_second must be positive")
	}

	if config.RateLimiting.GlobalBurstSize <= 0 {
		return fmt.Errorf("global_burst_size must be positive")
	}

	if config.RateLimiting.UserRequestsPerMinute <= 0 {
		return fmt.Errorf("user_requests_per_minute must be positive")
	}

	// Validate session configuration
	if config.Session.SessionTimeout <= 0 {
		return fmt.Errorf("session_timeout must be positive")
	}

	if config.Session.MaxSessions <= 0 {
		return fmt.Errorf("max_sessions must be positive")
	}

	// Validate token configuration
	if config.Token.AccessExpiry <= 0 {
		return fmt.Errorf("access_expiry must be positive")
	}

	if config.Token.RefreshExpiry <= 0 {
		return fmt.Errorf("refresh_expiry must be positive")
	}

	if config.Token.RefreshExpiry <= config.Token.AccessExpiry {
		return fmt.Errorf("refresh_expiry must be greater than access_expiry")
	}

	// Validate database configuration
	if config.Database.MaxConnections <= 0 {
		return fmt.Errorf("max_connections must be positive")
	}

	if config.Database.QueryTimeout <= 0 {
		return fmt.Errorf("query_timeout must be positive")
	}

	return nil
}

// IsDevelopmentMode checks if the application is running in development mode
func IsDevelopmentMode() bool {
	// This would typically check an environment variable
	// For now, we'll assume production
	return false
}