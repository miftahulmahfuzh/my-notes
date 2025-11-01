package handlers

// Handlers groups all API handlers
type Handlers struct {
	Health *HealthHandler
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
		Health: NewHealthHandler(),
		// Additional handlers will be initialized in subsequent phases:
		// Auth:   NewAuthHandler(...),
		// Notes:  NewNotesHandler(...),
		// Tags:   NewTagsHandler(...),
		// Search: NewSearchHandler(...),
		// User:   NewUserHandler(...),
	}
}