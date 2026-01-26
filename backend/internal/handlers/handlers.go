package handlers

// Handlers groups all API handlers
type Handlers struct {
	Health       *HealthHandler
	Auth         *AuthHandler
	ChromeAuth   *ChromeAuthHandler
	Notes        *NotesHandler
	ExportImport *ExportImportHandler
	// Additional handlers will be added in subsequent phases:
	// Search *SearchHandler
}

// NewHandlers creates a new handlers instance
func NewHandlers() *Handlers {
	return &Handlers{
		Health:       NewHealthHandler(),
		Auth:         nil, // Will be initialized after services are created
		Notes:        nil, // Will be initialized after services are created
		ExportImport: nil, // Will be initialized after services are created
		// Additional handlers will be initialized in subsequent phases:
		// Search: NewSearchHandler(...),
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

// SetExportImportHandler initializes the export/import handler with service dependencies
func (h *Handlers) SetExportImportHandler(exportImportHandler *ExportImportHandler) {
	h.ExportImport = exportImportHandler
}