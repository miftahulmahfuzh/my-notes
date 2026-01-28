package handlers

// Handlers groups all API handlers
type Handlers struct {
	Health     *HealthHandler
	Auth       *AuthHandler
	ChromeAuth *ChromeAuthHandler
	Notes      *NotesHandler
	Tags       *TagsHandler
}

// NewHandlers creates a new handlers instance
func NewHandlers() *Handlers {
	return &Handlers{
		Health: NewHealthHandler(),
		Auth:   nil, // Will be initialized after services are created
		Notes:  nil, // Will be initialized after services are created
		Tags:   nil, // Will be initialized after services are created
	}
}

// SetAuthHandlers initializes the auth handlers with service dependencies
func (h *Handlers) SetAuthHandlers(authHandler *AuthHandler, chromeAuthHandler *ChromeAuthHandler) {
	h.Auth = authHandler
	h.ChromeAuth = chromeAuthHandler
}

// SetNotesHandler initializes the notes handler with service dependencies
func (h *Handlers) SetNotesHandler(notesHandler *NotesHandler) {
	h.Notes = notesHandler
}

// SetTagsHandler initializes the tags handler with service dependencies
func (h *Handlers) SetTagsHandler(tagsHandler *TagsHandler) {
	h.Tags = tagsHandler
}