package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
)

// Note represents a note in the system
type Note struct {
	ID        uuid.UUID  `json:"id" db:"id"`
	UserID    uuid.UUID  `json:"user_id" db:"user_id"`
	Title     *string    `json:"title,omitempty" db:"title"`
	Content   string     `json:"content" db:"content"`
	CreatedAt time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt time.Time  `json:"updated_at" db:"updated_at"`
	Version   int        `json:"version" db:"version"`
}

// NoteResponse is the safe response format for note data
type NoteResponse struct {
	ID           uuid.UUID                `json:"id"`
	UserID       uuid.UUID                `json:"user_id"`
	Title        *string                  `json:"title,omitempty"`
	Content      string                   `json:"content"`
	CreatedAt    time.Time                `json:"created_at"`
	UpdatedAt    time.Time                `json:"updated_at"`
	Version      int                      `json:"version"`
	Tags         []string                 `json:"tags,omitempty"`
	SyncMetadata map[string]interface{}   `json:"sync_metadata,omitempty"`
}

// ToResponse converts Note to NoteResponse
func (n *Note) ToResponse() NoteResponse {
	return NoteResponse{
		ID:        n.ID,
		UserID:    n.UserID,
		Title:     n.Title,
		Content:   n.Content,
		CreatedAt: n.CreatedAt,
		UpdatedAt: n.UpdatedAt,
		Version:   n.Version,
	}
}

// ExtractHashtags extracts hashtags from the note content
func (nr *NoteResponse) ExtractHashtags() []string {
	// Regular expression to match hashtags (#word)
	hashtagRegex := regexp.MustCompile(`#\w+`)
	matches := hashtagRegex.FindAllString(nr.Content, -1)

	// Remove duplicates and ensure they start with #
	uniqueTags := make(map[string]bool)
	var tags []string

	for _, match := range matches {
		if !uniqueTags[match] {
			uniqueTags[match] = true
			tags = append(tags, match)
		}
	}

	// Return empty slice instead of nil if no tags found
	if len(tags) == 0 {
		return []string{}
	}

	return tags
}

// Validate validates the note data
func (n *Note) Validate() error {
	if n.UserID == uuid.Nil {
		return fmt.Errorf("user_id is required")
	}
	if n.Content == "" {
		return fmt.Errorf("content is required")
	}
	if len(n.Content) > 10000 {
		return fmt.Errorf("content too long (max 10000 characters)")
	}
	if n.Title != nil && len(*n.Title) > 500 {
		return fmt.Errorf("title too long (max 500 characters)")
	}
	if n.Version < 1 {
		return fmt.Errorf("version must be at least 1")
	}
	return nil
}

// ExtractHashtags extracts hashtags from the note content
func (n *Note) ExtractHashtags() []string {
	// Regular expression to match hashtags (#word)
	hashtagRegex := regexp.MustCompile(`#\w+`)
	matches := hashtagRegex.FindAllString(n.Content, -1)

	// Remove duplicates and ensure they start with #
	uniqueTags := make(map[string]bool)
	var tags []string

	for _, match := range matches {
		if !uniqueTags[match] {
			uniqueTags[match] = true
			tags = append(tags, match)
		}
	}

	// Return empty slice instead of nil if no tags found
	if len(tags) == 0 {
		return []string{}
	}

	return tags
}

// Scan implements the sql.Scanner interface for UUID
func (n *Note) Scan(value interface{}) error {
	if value == nil {
		return nil
	}
	switch v := value.(type) {
	case []byte:
		return n.ID.Scan(v)
	case string:
		return n.ID.Scan(v)
	default:
		return fmt.Errorf("cannot scan %T into Note", value)
	}
}

// Value implements the driver.Valuer interface for UUID
func (n Note) Value() (driver.Value, error) {
	return n.ID.Value()
}

// TableName returns the table name for the Note model
func (Note) TableName() string {
	return "notes"
}

// NoteList represents a list of notes with pagination
type NoteList struct {
	Notes  []NoteResponse `json:"notes"`
	Total  int            `json:"total"`
	Page   int            `json:"page"`
	Limit  int            `json:"limit"`
	HasMore bool          `json:"has_more"`
}

// CreateNoteRequest represents the request to create a new note
type CreateNoteRequest struct {
	Title   string `json:"title,omitempty" validate:"max=500"`
	Content string `json:"content" validate:"required,max=10000"`
}

// ToNote converts CreateNoteRequest to Note model
func (r *CreateNoteRequest) ToNote(userID uuid.UUID) *Note {
	var title *string
	if r.Title != "" {
		title = &r.Title
	} else {
		// Generate title from first line of content
		lines := strings.Split(r.Content, "\n")
		if len(lines) > 0 && len(lines[0]) > 0 {
			firstLine := lines[0]
			if len(firstLine) > 50 {
				firstLine = firstLine[:47] + "..."
			}
			title = &firstLine
		}
	}

	now := time.Now()
	return &Note{
		ID:        uuid.New(),
		UserID:    userID,
		Title:     title,
		Content:   r.Content,
		CreatedAt: now,
		UpdatedAt: now,
		Version:   1,
	}
}

// UpdateNoteRequest represents the request to update a note
type UpdateNoteRequest struct {
	Title   *string `json:"title,omitempty" validate:"omitempty,max=500"`
	Content *string `json:"content,omitempty" validate:"omitempty,max=10000"`
	Version *int    `json:"version,omitempty" validate:"omitempty,min=1"`
}

// ApplyUpdates applies the updates to the note
func (r *UpdateNoteRequest) ApplyUpdates(note *Note) bool {
	updated := false

	if r.Title != nil {
		note.Title = r.Title
		updated = true
	}

	if r.Content != nil {
		note.Content = *r.Content
		updated = true

		// Auto-update title if not explicitly provided
		if r.Title == nil {
			lines := strings.Split(*r.Content, "\n")
			if len(lines) > 0 && len(lines[0]) > 0 {
				firstLine := lines[0]
				if len(firstLine) > 50 {
					firstLine = firstLine[:47] + "..."
				}
				note.Title = &firstLine
			}
		}
	}

	if updated {
		note.UpdatedAt = time.Now()
	}

	return updated
}

// SearchNotesRequest represents the request to search notes
type SearchNotesRequest struct {
	Query    string   `json:"query,omitempty" form:"query"`
	Tags     []string `json:"tags,omitempty" form:"tags"`
	Limit    int      `json:"limit,omitempty" form:"limit" validate:"min=1,max=100"`
	Offset   int      `json:"offset,omitempty" form:"offset" validate:"min=0"`
	OrderBy  string   `json:"order_by,omitempty" form:"order_by" validate:"oneof=created_at updated_at title"`
	OrderDir string   `json:"order_dir,omitempty" form:"order_dir" validate:"oneof=asc desc"`
}

// Validate validates the search request
func (r *SearchNotesRequest) Validate() error {
	if r.Limit == 0 {
		r.Limit = 20
	}
	if r.Limit > 100 {
		r.Limit = 100
	}
	if r.OrderBy == "" {
		r.OrderBy = "created_at"
	}
	if r.OrderDir == "" {
		r.OrderDir = "desc"
	}
	return nil
}

// MarshalJSON custom JSON marshaling for Note
func (n *Note) MarshalJSON() ([]byte, error) {
	type Alias Note
	return json.Marshal(&struct {
		*Alias
		CreatedAt string `json:"created_at"`
		UpdatedAt string `json:"updated_at"`
	}{
		Alias:     (*Alias)(n),
		CreatedAt: n.CreatedAt.Format(time.RFC3339),
		UpdatedAt: n.UpdatedAt.Format(time.RFC3339),
	})
}

// UnmarshalJSON custom JSON unmarshaling for Note
func (n *Note) UnmarshalJSON(data []byte) error {
	type Alias Note
	aux := &struct {
		*Alias
		CreatedAt string `json:"created_at"`
		UpdatedAt string `json:"updated_at"`
	}{
		Alias: (*Alias)(n),
	}

	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}

	if aux.CreatedAt != "" {
		if t, err := time.Parse(time.RFC3339, aux.CreatedAt); err == nil {
			n.CreatedAt = t
		}
	}

	if aux.UpdatedAt != "" {
		if t, err := time.Parse(time.RFC3339, aux.UpdatedAt); err == nil {
			n.UpdatedAt = t
		}
	}

	return nil
}

// NoteUpdate represents a batch update request for a note
type NoteUpdate struct {
	NoteID  string              `json:"note_id"`
	Request *UpdateNoteRequest  `json:"request"`
}

// NoteStats represents statistics for a user's notes
type NoteStats struct {
	TotalNotes int64     `json:"total_notes"`
	OldestNote time.Time `json:"oldest_note"`
	NewestNote time.Time `json:"newest_note"`
}

// NoteConflict represents a conflict between local and remote note versions
type NoteConflict struct {
	NoteID     uuid.UUID `json:"note_id"`
	LocalNote  *Note     `json:"local_note,omitempty"`
	RemoteNote *Note     `json:"remote_note,omitempty"`
	ConflictType string  `json:"conflict_type"` // "version", "content", "deleted"
	Reason     string    `json:"reason,omitempty"`
	Resolved   bool      `json:"resolved"`
}

// SyncResponse represents the response from a sync operation
type SyncResponse struct {
	Notes      []NoteResponse   `json:"notes"`
	Total      int              `json:"total"`
	Limit      int              `json:"limit"`
	Offset     int              `json:"offset"`
	HasMore    bool             `json:"has_more"`
	SyncToken  string           `json:"sync_token"`
	ServerTime string           `json:"server_time"`
	Conflicts  []NoteConflict   `json:"conflicts,omitempty"`
	Metadata   SyncMetadata     `json:"metadata"`
}

// SyncMetadata contains metadata about sync operations
type SyncMetadata struct {
	LastSyncAt   string `json:"last_sync_at"`
	ServerTime   string `json:"server_time"`
	TotalNotes   int    `json:"total_notes"`
	UpdatedNotes int    `json:"updated_notes"`
	HasConflicts bool   `json:"has_conflicts"`
}

// APIResponse represents the standard API response format
type APIResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   *APIError   `json:"error,omitempty"`
}

// APIError represents the standard API error format
type APIError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Details string `json:"details,omitempty"`
}

// NewAPIResponse creates a successful API response
func NewAPIResponse(data interface{}) *APIResponse {
	return &APIResponse{
		Success: true,
		Data:    data,
	}
}

// NewAPIErrorResponse creates an error API response
func NewAPIErrorResponse(code, message, details string) *APIResponse {
	return &APIResponse{
		Success: false,
		Error: &APIError{
			Code:    code,
			Message: message,
			Details: details,
		},
	}
}