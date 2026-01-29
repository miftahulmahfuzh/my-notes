package middleware

import (
	"encoding/json"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gpd/my-notes/internal/auth"
	"github.com/gpd/my-notes/internal/models"
	"github.com/gpd/my-notes/internal/services"
)

// RateLimitingMiddleware provides advanced rate limiting
type RateLimitingMiddleware struct {
	userService    services.UserServiceInterface
	tokenService   *auth.TokenService
	config         *RateLimitConfig
	globalLimiter  *TokenBucket
	userLimiters   map[string]*TokenBucket
	mu             sync.RWMutex
}

// RateLimitConfig holds rate limiting configuration
type RateLimitConfig struct {
	// Global rate limits
	GlobalRequestsPerSecond float64
	GlobalBurstSize         int

	// User rate limits
	UserRequestsPerMinute   int
	UserRequestsPerHour     int
	UserRequestsPerDay      int

	// Endpoint-specific limits
	AuthRequestsPerMinute   int
	ProfileRequestsPerMinute int
	SearchRequestsPerMinute int

	// Whitelist for unlimited access
	WhitelistedIPs []string
	WhitelistedUsers []string
}

// TokenBucket implements token bucket algorithm
type TokenBucket struct {
	capacity       float64
	tokens         float64
	refillRate     float64
	lastRefillTime time.Time
	mu             sync.Mutex
}

// NewTokenBucket creates a new token bucket
func NewTokenBucket(capacity, refillRate float64) *TokenBucket {
	return &TokenBucket{
		capacity:       capacity,
		tokens:         capacity,
		refillRate:     refillRate,
		lastRefillTime: time.Now(),
	}
}

// Allow checks if a request is allowed
func (tb *TokenBucket) Allow() bool {
	tb.mu.Lock()
	defer tb.mu.Unlock()

	now := time.Now()
	elapsed := now.Sub(tb.lastRefillTime).Seconds()

	// Refill tokens
	tb.tokens += elapsed * tb.refillRate
	if tb.tokens > tb.capacity {
		tb.tokens = tb.capacity
	}
	tb.lastRefillTime = now

	// Check if we have enough tokens
	if tb.tokens >= 1 {
		tb.tokens--
		return true
	}

	return false
}

// NewRateLimitingMiddleware creates a new rate limiting middleware
func NewRateLimitingMiddleware(
	userService services.UserServiceInterface,
	tokenService *auth.TokenService,
	config *RateLimitConfig,
) *RateLimitingMiddleware {
	if config == nil {
		config = &RateLimitConfig{
			GlobalRequestsPerSecond: 100,
			GlobalBurstSize:         200,
			UserRequestsPerMinute:   60,
			UserRequestsPerHour:     1000,
			UserRequestsPerDay:      10000,
			AuthRequestsPerMinute:   10,
			ProfileRequestsPerMinute: 30,
			SearchRequestsPerMinute: 20,
		}
	}

	return &RateLimitingMiddleware{
		userService:   userService,
		tokenService:  tokenService,
		config:        config,
		globalLimiter: NewTokenBucket(float64(config.GlobalBurstSize), config.GlobalRequestsPerSecond),
		userLimiters:  make(map[string]*TokenBucket),
	}
}

// RateLimit applies rate limiting to requests
func (rlm *RateLimitingMiddleware) RateLimit(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Check if IP is whitelisted
		clientIP := getClientIP(r)
		if rlm.isIPWhitelisted(clientIP) {
			next.ServeHTTP(w, r)
			return
		}

		// Apply global rate limiting
		if !rlm.globalLimiter.Allow() {
			rlm.writeRateLimitResponse(w, "Global rate limit exceeded")
			return
		}

		// Try to get user from token
		userID := rlm.getUserIDFromRequest(r)
		if userID != "" {
			// Check if user is whitelisted
			if rlm.isUserWhitelisted(userID) {
				next.ServeHTTP(w, r)
				return
			}

			// Apply user-specific rate limiting
			if !rlm.allowUserRequest(userID, r) {
				rlm.writeRateLimitResponse(w, "User rate limit exceeded")
				return
			}
		}

		// Apply endpoint-specific rate limiting
		if !rlm.allowEndpointRequest(r) {
			rlm.writeRateLimitResponse(w, "Endpoint rate limit exceeded")
			return
		}

		next.ServeHTTP(w, r)
	})
}

// getUserIDFromRequest extracts user ID from request
func (rlm *RateLimitingMiddleware) getUserIDFromRequest(r *http.Request) string {
	// Try to get user from context first
	if user, ok := r.Context().Value("user").(*models.User); ok {
		return user.ID.String()
	}

	// Try to extract from token
	authHeader := r.Header.Get("Authorization")
	if authHeader != "" {
		tokenParts := strings.Split(authHeader, " ")
		if len(tokenParts) == 2 && tokenParts[0] == "Bearer" {
			claims, err := rlm.tokenService.ValidateToken(r.Context(), tokenParts[1])
			if err == nil {
				return claims.UserID
			}
		}
	}

	return ""
}

// allowUserRequest checks if user request is allowed
func (rlm *RateLimitingMiddleware) allowUserRequest(userID string, r *http.Request) bool {
	rlm.mu.Lock()
	defer rlm.mu.Unlock()

	// Get or create user limiter
	limiter, exists := rlm.userLimiters[userID]
	if !exists {
		// Create rate limiter based on user tier
		limiter = rlm.createUserLimiter(userID)
		rlm.userLimiters[userID] = limiter
	}

	return limiter.Allow()
}

// createUserLimiter creates a rate limiter for a user based on their tier
func (rlm *RateLimitingMiddleware) createUserLimiter(userID string) *TokenBucket {
	// Get user to check their tier/status
	_, err := rlm.userService.GetByID(userID)
	if err != nil {
		// Default rate limiting for unknown users
		return NewTokenBucket(60, 1) // 60 requests per minute
	}

	// Standard rate limiting for all users
	// This could be enhanced with subscription tiers in the future
	return NewTokenBucket(float64(rlm.config.UserRequestsPerMinute), 1)
}

// allowEndpointRequest checks if endpoint request is allowed
func (rlm *RateLimitingMiddleware) allowEndpointRequest(r *http.Request) bool {
	path := r.URL.Path

	// Different endpoints have different rate limits
	switch {
	case strings.HasPrefix(path, "/api/v1/auth"):
		return rlm.checkAuthRateLimit()
	case strings.HasPrefix(path, "/api/v1/users/profile"):
		return rlm.checkProfileRateLimit()
	case strings.HasPrefix(path, "/api/v1/users/search"):
		return rlm.checkSearchRateLimit()
	case strings.HasPrefix(path, "/api/v1/notes"):
		return rlm.checkNotesRateLimit()
	default:
		return true // No specific limit for other endpoints
	}
}

// checkAuthRateLimit checks authentication endpoint rate limit
func (rlm *RateLimitingMiddleware) checkAuthRateLimit() bool {
	// Implement auth-specific rate limiting
	return true // Placeholder
}

// checkProfileRateLimit checks profile endpoint rate limit
func (rlm *RateLimitingMiddleware) checkProfileRateLimit() bool {
	// Implement profile-specific rate limiting
	return true // Placeholder
}

// checkSearchRateLimit checks search endpoint rate limit
func (rlm *RateLimitingMiddleware) checkSearchRateLimit() bool {
	// Implement search-specific rate limiting
	return true // Placeholder
}

// checkNotesRateLimit checks notes endpoint rate limit
func (rlm *RateLimitingMiddleware) checkNotesRateLimit() bool {
	// Implement notes-specific rate limiting
	return true // Placeholder
}

// isIPWhitelisted checks if IP is whitelisted
func (rlm *RateLimitingMiddleware) isIPWhitelisted(ip string) bool {
	for _, whitelistedIP := range rlm.config.WhitelistedIPs {
		if whitelistedIP == ip || (strings.HasSuffix(whitelistedIP, "*") && strings.HasPrefix(ip, strings.TrimSuffix(whitelistedIP, "*"))) {
			return true
		}
	}
	return false
}

// isUserWhitelisted checks if user is whitelisted
func (rlm *RateLimitingMiddleware) isUserWhitelisted(userID string) bool {
	for _, whitelistedUser := range rlm.config.WhitelistedUsers {
		if whitelistedUser == userID {
			return true
		}
	}
	return false
}

// writeRateLimitResponse writes a rate limit error response
func (rlm *RateLimitingMiddleware) writeRateLimitResponse(w http.ResponseWriter, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusTooManyRequests)

	response := map[string]interface{}{
		"error":       message,
		"code":        http.StatusTooManyRequests,
		"success":     false,
		"retry_after": "60", // Suggest retry after 60 seconds
	}

	json.NewEncoder(w).Encode(response)
}

// RateLimitInfo provides information about current rate limits
type RateLimitInfo struct {
	Limit     int     `json:"limit"`
	Remaining int     `json:"remaining"`
	ResetTime int64   `json:"reset_time"`
	Window    string  `json:"window"`
}

// GetRateLimitInfo returns rate limit information for a user
func (rlm *RateLimitingMiddleware) GetRateLimitInfo(userID string) *RateLimitInfo {
	rlm.mu.RLock()
	defer rlm.mu.RUnlock()

	limiter, exists := rlm.userLimiters[userID]
	if !exists {
		return &RateLimitInfo{
			Limit:     rlm.config.UserRequestsPerMinute,
			Remaining: rlm.config.UserRequestsPerMinute,
			ResetTime: time.Now().Add(time.Minute).Unix(),
			Window:    "minute",
		}
	}

	return &RateLimitInfo{
		Limit:     int(limiter.capacity),
		Remaining: int(limiter.tokens),
		ResetTime: time.Now().Add(time.Duration(limiter.capacity/limiter.refillRate) * time.Second).Unix(),
		Window:    "custom",
	}
}

// CleanupExpiredLimiters removes old rate limiters
func (rlm *RateLimitingMiddleware) CleanupExpiredLimiters() {
	rlm.mu.Lock()
	defer rlm.mu.Unlock()

	// Remove limiters that haven't been used recently
	// This is a simplified implementation
	for userID := range rlm.userLimiters {
		// In production, you'd track last access time
		if time.Now().Unix()%3600 == 0 { // Cleanup every hour
			delete(rlm.userLimiters, userID)
		}
	}
}

// RateLimitMetrics provides metrics about rate limiting
type RateLimitMetrics struct {
	GlobalRequestsBlocked    int64            `json:"global_requests_blocked"`
	UserRequestsBlocked      int64            `json:"user_requests_blocked"`
	TotalRequests           int64            `json:"total_requests"`
	ActiveLimiters          int              `json:"active_limiters"`
	TopBlockedIPs          []BlockedMetric `json:"top_blocked_ips"`
	TopBlockedUsers         []BlockedMetric `json:"top_blocked_users"`
}

// BlockedMetric represents a blocked request metric
type BlockedMetric struct {
	Identifier string `json:"identifier"`
	Count      int64  `json:"count"`
	LastBlocked string `json:"last_blocked"`
}

// GetMetrics returns rate limiting metrics
func (rlm *RateLimitingMiddleware) GetMetrics() *RateLimitMetrics {
	rlm.mu.RLock()
	defer rlm.mu.RUnlock()

	return &RateLimitMetrics{
		GlobalRequestsBlocked: 0, // Implement tracking
		UserRequestsBlocked:   0, // Implement tracking
		TotalRequests:        0, // Implement tracking
		ActiveLimiters:       len(rlm.userLimiters),
		TopBlockedIPs:        []BlockedMetric{},
		TopBlockedUsers:       []BlockedMetric{},
	}
}

// ResetGlobalRateLimiter resets the global rate limiter (for testing)
func (rlm *RateLimitingMiddleware) ResetGlobalRateLimiter() {
	rlm.mu.Lock()
	defer rlm.mu.Unlock()

	// Create a new global token bucket
	rlm.globalLimiter = NewTokenBucket(float64(rlm.config.GlobalBurstSize), rlm.config.GlobalRequestsPerSecond)
}

// ResetUserRateLimiters resets all user rate limiters (for testing)
func (rlm *RateLimitingMiddleware) ResetUserRateLimiters() {
	rlm.mu.Lock()
	defer rlm.mu.Unlock()

	// Create a new map to clear all existing user rate limiters
	rlm.userLimiters = make(map[string]*TokenBucket)
}

// AdaptiveRateLimiting adjusts rate limits based on system load
type AdaptiveRateLimiting struct {
	baseLimit    float64
	currentLimit float64
	loadFactor   float64
	minLimit     float64
	maxLimit     float64
}

// NewAdaptiveRateLimiting creates adaptive rate limiting
func NewAdaptiveRateLimiting(baseLimit, minLimit, maxLimit float64) *AdaptiveRateLimiting {
	return &AdaptiveRateLimiting{
		baseLimit:    baseLimit,
		currentLimit: baseLimit,
		loadFactor:   1.0,
		minLimit:     minLimit,
		maxLimit:     maxLimit,
	}
}

// AdjustLimit adjusts the rate limit based on system load
func (arl *AdaptiveRateLimiting) AdjustLimit(load float64) {
	// Simple linear adjustment
	arl.loadFactor = 1.0 - load
	if arl.loadFactor < 0.1 {
		arl.loadFactor = 0.1
	}
	if arl.loadFactor > 2.0 {
		arl.loadFactor = 2.0
	}

	arl.currentLimit = arl.baseLimit * arl.loadFactor
	if arl.currentLimit < arl.minLimit {
		arl.currentLimit = arl.minLimit
	}
	if arl.currentLimit > arl.maxLimit {
		arl.currentLimit = arl.maxLimit
	}
}

// GetLimit returns the current limit
func (arl *AdaptiveRateLimiting) GetLimit() float64 {
	return arl.currentLimit
}