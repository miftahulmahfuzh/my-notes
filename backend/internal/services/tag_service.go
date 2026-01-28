package services

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/gpd/my-notes/internal/models"
	"github.com/google/uuid"
)

// TagServiceInterface defines the interface for tag service operations
type TagServiceInterface interface {
	CreateTag(request *models.CreateTagRequest) (*models.Tag, error)
	GetTagByID(tagID string) (*models.Tag, error)
	GetTagByName(tagName string) (*models.Tag, error)
	GetAllTags(userID string, limit int, offset int) (*models.TagList, error)
	ExtractTagsFromContent(content string) []string
	ProcessTagsForNote(noteID string, tags []string) error
	UpdateTagsForNote(noteID string, tags []string) error
	ValidateTagNames(tagNames []string) error
}

// TagService handles tag-related operations
type TagService struct {
	db *sql.DB
}

// NewTagService creates a new TagService instance
func NewTagService(db *sql.DB) *TagService {
	return &TagService{
		db: db,
	}
}

// CreateTag creates a new tag with deduplication
func (s *TagService) CreateTag(request *models.CreateTagRequest) (*models.Tag, error) {
	ctx := context.Background()

	// Convert request to tag model
	tag := request.ToTag()

	// Validate tag
	if err := tag.Validate(); err != nil {
		return nil, fmt.Errorf("invalid tag: %w", err)
	}

	// Check if tag already exists (case-insensitive)
	var existingTag models.Tag
	err := s.db.QueryRowContext(ctx,
		"SELECT id, name, created_at FROM tags WHERE LOWER(name) = LOWER($1)",
		tag.Name).Scan(&existingTag.ID, &existingTag.Name, &existingTag.CreatedAt)

	if err == nil {
		// Tag already exists, return existing tag
		return &existingTag, nil
	}

	if err != sql.ErrNoRows {
		return nil, fmt.Errorf("failed to check for existing tag: %w", err)
	}

	// Create new tag
	tag.ID = uuid.New()
	query := `
		INSERT INTO tags (id, name, created_at)
		VALUES ($1, $2, $3)
		RETURNING id, name, created_at
	`

	err = s.db.QueryRowContext(ctx, query,
		tag.ID, tag.Name, tag.CreatedAt).Scan(
		&tag.ID, &tag.Name, &tag.CreatedAt)

	if err != nil {
		return nil, fmt.Errorf("failed to create tag: %w", err)
	}

	return tag, nil
}

// GetTagByID retrieves a tag by ID
func (s *TagService) GetTagByID(tagID string) (*models.Tag, error) {
	ctx := context.Background()

	var tag models.Tag
	query := `
		SELECT id, name, created_at
		FROM tags
		WHERE id = $1
	`

	err := s.db.QueryRowContext(ctx, query, tagID).Scan(
		&tag.ID, &tag.Name, &tag.CreatedAt)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("tag not found")
		}
		return nil, fmt.Errorf("failed to get tag: %w", err)
	}

	return &tag, nil
}

// GetTagByName retrieves a tag by name (case-insensitive)
func (s *TagService) GetTagByName(tagName string) (*models.Tag, error) {
	ctx := context.Background()

	var tag models.Tag
	query := `
		SELECT id, name, created_at
		FROM tags
		WHERE LOWER(name) = LOWER($1)
	`

	err := s.db.QueryRowContext(ctx, query, tagName).Scan(
		&tag.ID, &tag.Name, &tag.CreatedAt)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("tag not found")
		}
		return nil, fmt.Errorf("failed to get tag: %w", err)
	}

	return &tag, nil
}


// ExtractTagsFromContent extracts hashtags from content using the model utility
func (s *TagService) ExtractTagsFromContent(content string) []string {
	return models.ExtractTagsFromContent(content)
}

// ProcessTagsForNote creates tags and associations for a note
func (s *TagService) ProcessTagsForNote(noteID string, tags []string) error {
	ctx := context.Background()

	for _, tagName := range tags {
		// Create or get tag
		tag, err := s.getOrCreateTagByName(ctx, tagName)
		if err != nil {
			return fmt.Errorf("failed to get or create tag %s: %w", tagName, err)
		}

		// Associate tag with note
		if err := s.associateNoteWithTag(ctx, noteID, tag.ID); err != nil {
			return fmt.Errorf("failed to associate note with tag %s: %w", tagName, err)
		}
	}
	return nil
}

// UpdateTagsForNote updates tags for a note (replaces all existing tags)
func (s *TagService) UpdateTagsForNote(noteID string, tags []string) error {
	ctx := context.Background()

	// Delete existing tag associations
	if err := s.deleteAllNoteTags(ctx, noteID); err != nil {
		return err
	}

	// Process new tags
	return s.ProcessTagsForNote(noteID, tags)
}

// ValidateTagNames validates a list of tag names
func (s *TagService) ValidateTagNames(tagNames []string) error {
	return models.ValidateTags(tagNames)
}

// Private helper methods

// getOrCreateTagByName gets an existing tag by name or creates a new one
func (s *TagService) getOrCreateTagByName(ctx context.Context, tagName string) (*models.Tag, error) {
	// Try to get existing tag
	var tag models.Tag
	err := s.db.QueryRowContext(ctx,
		"SELECT id, name, created_at FROM tags WHERE LOWER(name) = LOWER($1)",
		tagName).Scan(&tag.ID, &tag.Name, &tag.CreatedAt)

	if err == nil {
		return &tag, nil
	}

	if err != sql.ErrNoRows {
		return nil, fmt.Errorf("failed to query tag: %w", err)
	}

	// Create new tag
	tag.ID = uuid.New()
	tag.Name = tagName
	tag.CreatedAt = time.Now()

	insertQuery := "INSERT INTO tags (id, name, created_at) VALUES ($1, $2, $3)"
	_, err = s.db.ExecContext(ctx, insertQuery, tag.ID, tag.Name, tag.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to create tag: %w", err)
	}

	return &tag, nil
}

// associateNoteWithTag creates an association between a note and a tag
func (s *TagService) associateNoteWithTag(ctx context.Context, noteID string, tagID uuid.UUID) error {
	query := "INSERT INTO note_tags (note_id, tag_id, created_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING"
	_, err := s.db.ExecContext(ctx, query, noteID, tagID, time.Now())
	if err != nil {
		return fmt.Errorf("failed to associate note with tag: %w", err)
	}
	return nil
}

// deleteAllNoteTags deletes all tag associations for a note
func (s *TagService) deleteAllNoteTags(ctx context.Context, noteID string) error {
	query := "DELETE FROM note_tags WHERE note_id = $1"
	_, err := s.db.ExecContext(ctx, query, noteID)
	if err != nil {
		return fmt.Errorf("failed to delete note tags: %w", err)
	}
	return nil
}

// GetAllTags retrieves all tags for the current user with pagination
func (s *TagService) GetAllTags(userID string, limit int, offset int) (*models.TagList, error) {
	ctx := context.Background()

	// Set defaults
	if limit <= 0 {
		limit = 100
	}
	if limit > 1000 {
		limit = 1000
	}
	if offset < 0 {
		offset = 0
	}

	// Query to get all tags with their note counts for this user
	// Note: Tags are global (not per-user), but we only want tags used by this user's notes
	query := `
		SELECT DISTINCT
			t.id,
			t.name,
			t.created_at,
			COUNT(nt.note_id) as note_count
		FROM tags t
		INNER JOIN note_tags nt ON t.id = nt.tag_id
		INNER JOIN notes n ON nt.note_id = n.id
		WHERE n.user_id = $1
		GROUP BY t.id, t.name, t.created_at
		ORDER BY t.name ASC
		LIMIT $2 OFFSET $3
	`

	rows, err := s.db.QueryContext(ctx, query, userID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to query tags: %w", err)
	}
	defer rows.Close()

	var tags []models.TagResponse
	for rows.Next() {
		var tag models.TagResponse
		err := rows.Scan(&tag.ID, &tag.Name, &tag.CreatedAt, &tag.NoteCount)
		if err != nil {
			return nil, fmt.Errorf("failed to scan tag: %w", err)
		}
		tags = append(tags, tag)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating tags: %w", err)
	}

	// Get total count
	var total int
	countQuery := `
		SELECT COUNT(DISTINCT t.id)
		FROM tags t
		INNER JOIN note_tags nt ON t.id = nt.tag_id
		INNER JOIN notes n ON nt.note_id = n.id
		WHERE n.user_id = $1
	`
	err = s.db.QueryRowContext(ctx, countQuery, userID).Scan(&total)
	if err != nil {
		return nil, fmt.Errorf("failed to count tags: %w", err)
	}

	return &models.TagList{
		Tags:   tags,
		Total:  total,
		Limit:  limit,
		Offset: offset,
		HasMore: offset + limit < total,
	}, nil
}