package middleware

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"strings"

	"github.com/gpd/my-notes/internal/auth"
	"github.com/gpd/my-notes/internal/models"
	"github.com/gpd/my-notes/internal/services"
)

// AuthMiddleware handles JWT token validation and user context
type AuthMiddleware struct {
	tokenService *auth.TokenService
	userService  services.UserServiceInterface
}

// NewAuthMiddleware creates a new AuthMiddleware instance
func NewAuthMiddleware(tokenService *auth.TokenService, userService services.UserServiceInterface) *AuthMiddleware {
	return &AuthMiddleware{
		tokenService: tokenService,
		userService:  userService,
	}
}

// Auth middleware validates JWT tokens and adds user to context
func (m *AuthMiddleware) Auth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			respondWithError(w, http.StatusUnauthorized, "Authorization header required")
			return
		}

		// Extract token from "Bearer <token>" format
		tokenParts := strings.Split(authHeader, " ")
		if len(tokenParts) != 2 || tokenParts[0] != "Bearer" {
			respondWithError(w, http.StatusUnauthorized, "Invalid authorization header format")
			return
		}

		tokenString := tokenParts[1]

		// Validate token
		claims, err := m.tokenService.ValidateToken(tokenString)
		if err != nil {
			respondWithError(w, http.StatusUnauthorized, "Invalid token")
			return
		}

		// Check if token is blacklisted (in a real implementation)
		// if m.tokenService.IsTokenBlacklisted(claims.ID) {
		//     respondWithError(w, http.StatusUnauthorized, "Token has been revoked")
		//     return
		// }

		// Get user from database
		user, err := m.userService.GetByID(claims.UserID)
		if err != nil {
			respondWithError(w, http.StatusUnauthorized, "User not found")
			return
		}

		// Update session activity (non-blocking)
		go func() {
			if err := m.userService.UpdateSessionActivity(
				claims.ID,
				getClientIP(r),
				r.UserAgent(),
			); err != nil {
				// Log error but don't fail the request
				log.Printf("Failed to update session activity: %v", err)
			}
		}()

		// Add user and claims to context
		ctx := context.WithValue(r.Context(), "user", user)
		ctx = context.WithValue(ctx, "claims", claims)

		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// OptionalAuth middleware validates tokens if present but doesn't require them
func (m *AuthMiddleware) OptionalAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			// No token provided, continue without authentication
			next.ServeHTTP(w, r)
			return
		}

		// Extract token from "Bearer <token>" format
		tokenParts := strings.Split(authHeader, " ")
		if len(tokenParts) != 2 || tokenParts[0] != "Bearer" {
			// Invalid format, continue without authentication
			next.ServeHTTP(w, r)
			return
		}

		tokenString := tokenParts[1]

		// Validate token
		claims, err := m.tokenService.ValidateToken(tokenString)
		if err != nil {
			// Invalid token, continue without authentication
			next.ServeHTTP(w, r)
			return
		}

		// Get user from database
		user, err := m.userService.GetByID(claims.UserID)
		if err != nil {
			// User not found, continue without authentication
			next.ServeHTTP(w, r)
			return
		}

		// Add user and claims to context
		ctx := context.WithValue(r.Context(), "user", user)
		ctx = context.WithValue(ctx, "claims", claims)

		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// RequireAuth middleware that ensures user is authenticated
func (m *AuthMiddleware) RequireAuth(next http.Handler) http.Handler {
	return m.Auth(next)
}

// RequireRole middleware that ensures user has specific role (placeholder for future use)
func (m *AuthMiddleware) RequireRole(role string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user, ok := r.Context().Value("user").(*models.User)
			if !ok {
				respondWithError(w, http.StatusUnauthorized, "User not authenticated")
				return
			}

			// In a real implementation, you would check user roles
			// For now, all authenticated users are considered to have all roles
			_ = role   // Suppress unused variable warning
			_ = user   // User is available for future role checking

			next.ServeHTTP(w, r)
		})
	}
}

// RateLimitMiddleware simple rate limiting (placeholder for future implementation)
func (m *AuthMiddleware) RateLimitMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Get client identifier (user ID or IP)
		clientID := getClientIdentifier(r)

		// Simple rate limiting - in production, use a proper rate limiting library
		// like golang.org/x/time/rate or Redis-based rate limiting
		if !m.allowRequest(clientID) {
			respondWithError(w, http.StatusTooManyRequests, "Rate limit exceeded")
			return
		}

		next.ServeHTTP(w, r)
	})
}

// getClientIdentifier gets a unique identifier for rate limiting
func getClientIdentifier(r *http.Request) string {
	// Try to get user ID from context first
	if user, ok := r.Context().Value("user").(*models.User); ok {
		return "user:" + user.ID.String()
	}

	// Fall back to IP address
	return "ip:" + getClientIP(r)
}

// Simple in-memory rate limiter (for demonstration only)
type simpleRateLimiter struct {
	requests map[string]int
}

var rateLimiter = &simpleRateLimiter{
	requests: make(map[string]int),
}

// allowRequest checks if a request should be allowed
func (m *AuthMiddleware) allowRequest(clientID string) bool {
	// Very simple rate limiting: allow 100 requests per minute per client
	// In production, use a proper rate limiting implementation
	const maxRequests = 100

	current, exists := rateLimiter.requests[clientID]
	if !exists {
		rateLimiter.requests[clientID] = 1
		return true
	}

	if current >= maxRequests {
		return false
	}

	rateLimiter.requests[clientID]++
	return true
}

// getClientIP extracts the client IP address from the request
func getClientIP(r *http.Request) string {
	// Check X-Forwarded-For header first (for reverse proxies)
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		// X-Forwarded-For can contain multiple IPs, take the first one
		if commaIdx := strings.Index(xff, ","); commaIdx > 0 {
			return xff[:commaIdx]
		}
		return xff
	}

	// Check X-Real-IP header
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return xri
	}

	// Fall back to RemoteAddr
	return r.RemoteAddr
}

// respondWithError sends an error response
func respondWithError(w http.ResponseWriter, code int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	w.Write([]byte(fmt.Sprintf(`{"error":"%s"}`, message)))
}