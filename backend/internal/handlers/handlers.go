package handlers

import (
	"github.com/gpd/my-notes/internal/middleware"
)

// Handlers groups all API handlers
type Handlers struct {
	Health   *HealthHandler
	Security *SecurityHandler
	Auth     *AuthHandler
	User     *UserHandler
	Notes    *NotesHandler
	Tags     *TagsHandler
	// Additional handlers will be added in subsequent phases:
	// Search *SearchHandler
}

// NewHandlers creates a new handlers instance
func NewHandlers() *Handlers {
	return &Handlers{
		Health:   NewHealthHandler(),
		Security: nil, // Will be initialized after middleware is created
		Auth:     nil, // Will be initialized after services are created
		User:     nil, // Will be initialized after services are created
		Notes:    nil, // Will be initialized after services are created
		Tags:     nil, // Will be initialized after services are created
		// Additional handlers will be initialized in subsequent phases:
		// Search: NewSearchHandler(...),
	}
}

// SetSecurityMiddleware initializes the security handler with middleware dependencies
func (h *Handlers) SetSecurityMiddleware(rateLimitMW *middleware.RateLimitingMiddleware, sessionMW *middleware.SessionMiddleware) {
	h.Security = NewSecurityHandler(rateLimitMW, sessionMW)
}

// SetAuthHandlers initializes the auth and user handlers with service dependencies
func (h *Handlers) SetAuthHandlers(authHandler *AuthHandler, userHandler *UserHandler) {
	h.Auth = authHandler
	h.User = userHandler
}

// SetNotesHandler initializes the notes handler with service dependencies
func (h *Handlers) SetNotesHandler(notesHandler *NotesHandler) {
	h.Notes = notesHandler
}

// SetTagsHandler initializes the tags handler with service dependencies
func (h *Handlers) SetTagsHandler(tagsHandler *TagsHandler) {
	h.Tags = tagsHandler
}