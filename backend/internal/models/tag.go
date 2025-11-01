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

// Tag represents a tag (hashtag) in the system
type Tag struct {
	ID        uuid.UUID `json:"id" db:"id"`
	Name      string    `json:"name" db:"name"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

// TagResponse is the safe response format for tag data
type TagResponse struct {
	ID        uuid.UUID `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
	NoteCount int       `json:"note_count,omitempty"`
}

// ToResponse converts Tag to TagResponse
func (t *Tag) ToResponse() TagResponse {
	return TagResponse{
		ID:        t.ID,
		Name:      t.Name,
		CreatedAt: t.CreatedAt,
	}
}

// Validate validates the tag data
func (t *Tag) Validate() error {
	if t.Name == "" {
		return fmt.Errorf("name is required")
	}
	if len(t.Name) > 100 {
		return fmt.Errorf("name too long (max 100 characters)")
	}

	// Tag must start with # and contain only alphanumeric characters, underscores, and hyphens
	tagRegex := regexp.MustCompile(`^#[a-zA-Z0-9_-]+$`)
	if !tagRegex.MatchString(t.Name) {
		return fmt.Errorf("tag must start with # and contain only alphanumeric characters, underscores, and hyphens")
	}

	return nil
}

// SanitizeName sanitizes the tag name
func (t *Tag) SanitizeName() {
	// Remove leading/trailing whitespace
	t.Name = strings.TrimSpace(t.Name)

	// Return empty if input is empty after trimming
	if t.Name == "" {
		return
	}

	// Ensure it starts with #
	if !strings.HasPrefix(t.Name, "#") {
		t.Name = "#" + t.Name
	}

	// Convert to lowercase
	t.Name = strings.ToLower(t.Name)

	// Remove invalid characters
	validRegex := regexp.MustCompile(`[^a-zA-Z0-9_#-]`)
	t.Name = validRegex.ReplaceAllString(t.Name, "")

	// Ensure it starts with # after sanitization
	if !strings.HasPrefix(t.Name, "#") && t.Name != "" {
		t.Name = "#" + t.Name
	}
}

// Scan implements the sql.Scanner interface for UUID
func (t *Tag) Scan(value interface{}) error {
	if value == nil {
		return nil
	}
	switch v := value.(type) {
	case []byte:
		return t.ID.Scan(v)
	case string:
		return t.ID.Scan(v)
	default:
		return fmt.Errorf("cannot scan %T into Tag", value)
	}
}

// Value implements the driver.Valuer interface for UUID
func (t Tag) Value() (driver.Value, error) {
	return t.ID.Value()
}

// TableName returns the table name for the Tag model
func (Tag) TableName() string {
	return "tags"
}

// TagList represents a list of tags with pagination
type TagList struct {
	Tags   []TagResponse `json:"tags"`
	Total  int            `json:"total"`
	Page   int            `json:"page"`
	Limit  int            `json:"limit"`
	HasMore bool          `json:"has_more"`
}

// NoteTag represents the relationship between notes and tags
type NoteTag struct {
	NoteID    uuid.UUID `json:"note_id" db:"note_id"`
	TagID     uuid.UUID `json:"tag_id" db:"tag_id"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

// Validate validates the note tag relationship
func (nt *NoteTag) Validate() error {
	if nt.NoteID == uuid.Nil {
		return fmt.Errorf("note_id is required")
	}
	if nt.TagID == uuid.Nil {
		return fmt.Errorf("tag_id is required")
	}
	return nil
}

// TableName returns the table name for the NoteTag model
func (NoteTag) TableName() string {
	return "note_tags"
}

// CreateTagRequest represents the request to create a new tag
type CreateTagRequest struct {
	Name string `json:"name" validate:"required,max=100"`
}

// ToTag converts CreateTagRequest to Tag model
func (r *CreateTagRequest) ToTag() *Tag {
	tag := &Tag{
		Name:      r.Name,
		CreatedAt: time.Now(),
	}
	tag.SanitizeName()
	return tag
}

// ExtractTagsFromContent extracts all hashtags from content
func ExtractTagsFromContent(content string) []string {
	// Regular expression to match hashtags (including those with spaces)
	// This regex matches # followed by optional spaces, then word characters
	hashtagRegex := regexp.MustCompile(`#\s*\w+`)
	matches := hashtagRegex.FindAllString(content, -1)

	// Remove duplicates and normalize
	uniqueTags := make(map[string]bool)
	var tags []string

	for _, match := range matches {
		// Remove spaces and convert to lowercase
		normalized := strings.ToLower(strings.ReplaceAll(match, " ", ""))
		if !uniqueTags[normalized] && len(normalized) > 1 {
			uniqueTags[normalized] = true
			tags = append(tags, normalized)
		}
	}

	// Return empty slice instead of nil if no tags found
	if len(tags) == 0 {
		return []string{}
	}

	return tags
}

// ValidateTags validates a list of tag names
func ValidateTags(tagNames []string) error {
	tagRegex := regexp.MustCompile(`^#[a-zA-Z0-9_-]+$`)

	for _, name := range tagNames {
		if len(name) > 100 {
			return fmt.Errorf("tag %s too long (max 100 characters)", name)
		}
		if !tagRegex.MatchString(name) {
			return fmt.Errorf("tag %s must start with # and contain only alphanumeric characters, underscores, and hyphens", name)
		}
	}
	return nil
}

// GetTagSuggestions returns tag suggestions based on partial input
func GetTagSuggestions(partial string, existingTags []string) []string {
	var suggestions []string
	partial = strings.ToLower(partial)

	for _, tag := range existingTags {
		if strings.HasPrefix(strings.ToLower(tag), partial) {
			suggestions = append(suggestions, tag)
		}
	}

	return suggestions
}

// MarshalJSON custom JSON marshaling for Tag
func (t *Tag) MarshalJSON() ([]byte, error) {
	type Alias Tag
	return json.Marshal(&struct {
		*Alias
		CreatedAt string `json:"created_at"`
	}{
		Alias:     (*Alias)(t),
		CreatedAt: t.CreatedAt.Format(time.RFC3339),
	})
}

// UnmarshalJSON custom JSON unmarshaling for Tag
func (t *Tag) UnmarshalJSON(data []byte) error {
	type Alias Tag
	aux := &struct {
		*Alias
		CreatedAt string `json:"created_at"`
	}{
		Alias: (*Alias)(t),
	}

	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}

	if aux.CreatedAt != "" {
		if parsedTime, err := time.Parse(time.RFC3339, aux.CreatedAt); err == nil {
			t.CreatedAt = parsedTime
		}
	}

	return nil
}