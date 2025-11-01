package handlers

import (
	"github.com/gpd/my-notes/internal/middleware"
)

// Handlers groups all API handlers
type Handlers struct {
	Health   *HealthHandler
	Security *SecurityHandler
	// Additional handlers will be added in subsequent phases:
	// Auth   *AuthHandler
	// Notes  *NotesHandler
	// Tags   *TagsHandler
	// Search *SearchHandler
	// User   *UserHandler
}

// NewHandlers creates a new handlers instance
func NewHandlers() *Handlers {
	return &Handlers{
		Health:   NewHealthHandler(),
		Security: nil, // Will be initialized after middleware is created
		// Additional handlers will be initialized in subsequent phases:
		// Auth:   NewAuthHandler(...),
		// Notes:  NewNotesHandler(...),
		// Tags:   NewTagsHandler(...),
		// Search: NewSearchHandler(...),
		// User:   NewUserHandler(...),
	}
}

// SetSecurityMiddleware initializes the security handler with middleware dependencies
func (h *Handlers) SetSecurityMiddleware(rateLimitMW *middleware.RateLimitingMiddleware, sessionMW *middleware.SessionMiddleware) {
	h.Security = NewSecurityHandler(rateLimitMW, sessionMW)
}