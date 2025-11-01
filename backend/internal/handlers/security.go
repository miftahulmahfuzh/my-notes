package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/gpd/my-notes/internal/middleware"
	"github.com/gpd/my-notes/internal/models"
)

// SecurityHandler handles security-related endpoints
type SecurityHandler struct {
	rateLimitMW *middleware.RateLimitingMiddleware
	sessionMW   *middleware.SessionMiddleware
}

// NewSecurityHandler creates a new security handler
func NewSecurityHandler(rateLimitMW *middleware.RateLimitingMiddleware, sessionMW *middleware.SessionMiddleware) *SecurityHandler {
	return &SecurityHandler{
		rateLimitMW: rateLimitMW,
		sessionMW:   sessionMW,
	}
}

// GetRateLimitInfo returns rate limiting information for the current user
func (h *SecurityHandler) GetRateLimitInfo(w http.ResponseWriter, r *http.Request) {
	// Get user from context (set by auth middleware)
	user, ok := r.Context().Value("user").(*models.User)
	if !ok {
		http.Error(w, "User not found", http.StatusUnauthorized)
		return
	}

	// Get rate limit info for user
	if h.rateLimitMW != nil {
		rateLimitInfo := h.rateLimitMW.GetRateLimitInfo(user.ID.String())

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success":      true,
			"rate_limits":  rateLimitInfo,
			"user_id":      user.ID.String(),
		})
		return
	}

	// Fallback response if rate limiting middleware is not available
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Rate limiting not available",
	})
}

// GetSessionInfo returns session information for the current user
func (h *SecurityHandler) GetSessionInfo(w http.ResponseWriter, r *http.Request) {
	// Get user from context (set by auth middleware)
	user, ok := r.Context().Value("user").(*models.User)
	if !ok {
		http.Error(w, "User not found", http.StatusUnauthorized)
		return
	}

	// Get session from context (set by session middleware)
	session, ok := r.Context().Value("session").(*models.UserSession)
	if !ok {
		http.Error(w, "Session not found", http.StatusUnauthorized)
		return
	}

	// Return session information
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":       true,
		"session_info": map[string]interface{}{
			"session_id":   session.ID,
			"user_id":      user.ID.String(),
			"ip_address":   session.IPAddress,
			"user_agent":   session.UserAgent,
			"created_at":   session.CreatedAt,
			"last_seen":    session.LastSeen,
			"is_active":    session.IsActive,
		},
	})
}

// GetSecurityMetrics returns security metrics (admin only)
func (h *SecurityHandler) GetSecurityMetrics(w http.ResponseWriter, r *http.Request) {
	// This would typically check for admin privileges
	// For now, we'll return basic metrics

	metrics := map[string]interface{}{
		"active_sessions": 0,
		"blocked_requests": 0,
		"rate_limit_violations": 0,
		"security_events": []string{},
	}

	if h.rateLimitMW != nil {
		rateLimitMetrics := h.rateLimitMW.GetMetrics()
		metrics["rate_limiting"] = rateLimitMetrics
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"metrics":  metrics,
		"timestamp": "2024-01-01T00:00:00Z", // Placeholder
	})
}

// User and Session types (these would typically be imported from models package)
type User struct {
	ID string `json:"id"`
}

type Session struct {
	ID        string `json:"id"`
	IPAddress string `json:"ip_address"`
	UserAgent string `json:"user_agent"`
	CreatedAt string `json:"created_at"`
	LastSeen  string `json:"last_seen"`
	IsActive  bool   `json:"is_active"`
}