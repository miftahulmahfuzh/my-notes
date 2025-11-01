package services

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/gpd/my-notes/internal/models"
	"github.com/google/uuid"
)

// NoteServiceInterface defines the interface for note service operations
type NoteServiceInterface interface {
	CreateNote(userID string, request *models.CreateNoteRequest) (*models.Note, error)
	GetNoteByID(userID, noteID string) (*models.Note, error)
	UpdateNote(userID, noteID string, request *models.UpdateNoteRequest) (*models.Note, error)
	DeleteNote(userID, noteID string) error
	ListNotes(userID string, limit, offset int, orderBy, orderDir string) (*models.NoteList, error)
	SearchNotes(userID string, request *models.SearchNotesRequest) (*models.NoteList, error)
	GetNotesByTag(userID, tag string, limit, offset int) (*models.NoteList, error)
	GetNotesWithTimestamp(userID string, since time.Time) ([]models.Note, error)
	BatchCreateNotes(userID string, requests []*models.CreateNoteRequest) ([]models.Note, error)
	BatchUpdateNotes(userID string, requests []struct {
		NoteID  string
		Request *models.UpdateNoteRequest
	}) ([]models.Note, error)
	IncrementVersion(noteID string) error
}

// NoteService handles note-related operations
type NoteService struct {
	db *sql.DB
}

// NewNoteService creates a new NoteService instance
func NewNoteService(db *sql.DB) *NoteService {
	return &NoteService{
		db: db,
	}
}

// CreateNote creates a new note for a user
func (s *NoteService) CreateNote(userID string, request *models.CreateNoteRequest) (*models.Note, error) {
	ctx := context.Background()

	// Validate request manually
	if request.Content == "" {
		return nil, fmt.Errorf("invalid request: content is required")
	}
	if len(request.Content) > 10000 {
		return nil, fmt.Errorf("invalid request: content too long (max 10000 characters)")
	}
	if len(request.Title) > 500 {
		return nil, fmt.Errorf("invalid request: title too long (max 500 characters)")
	}

	// Convert request to note model
	note := request.ToNote(uuid.MustParse(userID))

	// Validate note
	if err := note.Validate(); err != nil {
		return nil, fmt.Errorf("invalid note: %w", err)
	}

	// Insert note into database
	query := `
		INSERT INTO notes (id, user_id, title, content, created_at, updated_at, version)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, user_id, title, content, created_at, updated_at, version
	`

	err := s.db.QueryRowContext(ctx, query,
		note.ID, note.UserID, note.Title, note.Content,
		note.CreatedAt, note.UpdatedAt, note.Version).Scan(
		&note.ID, &note.UserID, &note.Title, &note.Content,
		&note.CreatedAt, &note.UpdatedAt, &note.Version)

	if err != nil {
		return nil, fmt.Errorf("failed to create note: %w", err)
	}

	// Extract and process hashtags
	tags := note.ExtractHashtags()
	if len(tags) > 0 {
		if err := s.processNoteTags(ctx, note.ID.String(), tags); err != nil {
			// Log error but don't fail note creation
			fmt.Printf("Warning: failed to process tags for note %s: %v\n", note.ID, err)
		}
	}

	return note, nil
}

// GetNoteByID retrieves a note by ID for a specific user
func (s *NoteService) GetNoteByID(userID, noteID string) (*models.Note, error) {
	ctx := context.Background()

	var note models.Note
	query := `
		SELECT id, user_id, title, content, created_at, updated_at, version
		FROM notes
		WHERE id = $1 AND user_id = $2
	`

	err := s.db.QueryRowContext(ctx, query, noteID, userID).Scan(
		&note.ID, &note.UserID, &note.Title, &note.Content,
		&note.CreatedAt, &note.UpdatedAt, &note.Version)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("note not found")
	} else if err != nil {
		return nil, fmt.Errorf("failed to get note: %w", err)
	}

	return &note, nil
}

// UpdateNote updates an existing note with optimistic locking
func (s *NoteService) UpdateNote(userID, noteID string, request *models.UpdateNoteRequest) (*models.Note, error) {
	ctx := context.Background()

	// Get current note first
	currentNote, err := s.GetNoteByID(userID, noteID)
	if err != nil {
		return nil, err
	}

	// Check version if provided
	if request.Version != nil && *request.Version != currentNote.Version {
		return nil, fmt.Errorf("note has been modified by another process (version mismatch)")
	}

	// Apply updates
	if !request.ApplyUpdates(currentNote) {
		return nil, fmt.Errorf("no updates provided")
	}

	// Validate updated note
	if err := currentNote.Validate(); err != nil {
		return nil, fmt.Errorf("invalid updated note: %w", err)
	}

	// Increment version for optimistic locking
	currentNote.Version++

	// Update in database
	query := `
		UPDATE notes
		SET title = $1, content = $2, updated_at = $3, version = $4
		WHERE id = $5 AND user_id = $6 AND version = $7 - 1
		RETURNING id, user_id, title, content, created_at, updated_at, version
	`

	err = s.db.QueryRowContext(ctx, query,
		currentNote.Title, currentNote.Content, currentNote.UpdatedAt,
		currentNote.Version, currentNote.ID, currentNote.UserID, currentNote.Version).Scan(
		&currentNote.ID, &currentNote.UserID, &currentNote.Title, &currentNote.Content,
		&currentNote.CreatedAt, &currentNote.UpdatedAt, &currentNote.Version)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("note has been modified by another process (concurrent update)")
		}
		return nil, fmt.Errorf("failed to update note: %w", err)
	}

	// Process hashtags for updated content
	tags := currentNote.ExtractHashtags()
	if err := s.updateNoteTags(ctx, currentNote.ID.String(), tags); err != nil {
		// Log error but don't fail note update
		fmt.Printf("Warning: failed to update tags for note %s: %v\n", currentNote.ID, err)
	}

	return currentNote, nil
}

// DeleteNote soft deletes a note by moving it to trash (or hard delete if preferred)
func (s *NoteService) DeleteNote(userID, noteID string) error {
	ctx := context.Background()

	// Verify note exists and belongs to user
	_, err := s.GetNoteByID(userID, noteID)
	if err != nil {
		return err
	}

	// Delete note tags first
	if err := s.deleteAllNoteTags(ctx, noteID); err != nil {
		fmt.Printf("Warning: failed to delete tags for note %s: %v\n", noteID, err)
	}

	// Delete the note
	query := `DELETE FROM notes WHERE id = $1 AND user_id = $2`
	result, err := s.db.ExecContext(ctx, query, noteID, userID)
	if err != nil {
		return fmt.Errorf("failed to delete note: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to check rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("note not found")
	}

	return nil
}

// ListNotes retrieves a paginated list of notes for a user
func (s *NoteService) ListNotes(userID string, limit, offset int, orderBy, orderDir string) (*models.NoteList, error) {
	ctx := context.Background()

	// Validate pagination parameters
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}
	if orderBy == "" {
		orderBy = "created_at"
	}
	if orderDir == "" {
		orderDir = "desc"
	}

	// Validate order_by field
	validOrderBy := map[string]bool{
		"created_at": true,
		"updated_at": true,
		"title":      true,
	}
	if !validOrderBy[orderBy] {
		orderBy = "created_at"
	}

	// Validate order_dir
	if orderDir != "asc" && orderDir != "desc" {
		orderDir = "desc"
	}

	// Get total count
	var total int
	err := s.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM notes WHERE user_id = $1", userID).Scan(&total)
	if err != nil {
		return nil, fmt.Errorf("failed to get total notes count: %w", err)
	}

	// Get notes with pagination
	query := fmt.Sprintf(`
		SELECT id, user_id, title, content, created_at, updated_at, version
		FROM notes
		WHERE user_id = $1
		ORDER BY %s %s
		LIMIT $2 OFFSET $3
	`, orderBy, orderDir)

	rows, err := s.db.QueryContext(ctx, query, userID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to list notes: %w", err)
	}
	defer rows.Close()

	var notes []models.NoteResponse
	for rows.Next() {
		var note models.Note
		err := rows.Scan(&note.ID, &note.UserID, &note.Title, &note.Content,
			&note.CreatedAt, &note.UpdatedAt, &note.Version)
		if err != nil {
			return nil, fmt.Errorf("failed to scan note: %w", err)
		}

		// Get tags for this note
		tags, err := s.getNoteTags(ctx, note.ID.String())
		if err != nil {
			// Log error but continue without tags
			fmt.Printf("Warning: failed to get tags for note %s: %v\n", note.ID, err)
			tags = []string{}
		}

		noteResponse := note.ToResponse()
		noteResponse.Tags = tags
		notes = append(notes, noteResponse)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating notes: %w", err)
	}

	// Calculate pagination info
	page := (offset / limit) + 1
	hasMore := (offset + limit) < total

	return &models.NoteList{
		Notes:  notes,
		Total:  total,
		Page:   page,
		Limit:  limit,
		HasMore: hasMore,
	}, nil
}

// SearchNotes searches notes by content, title, and tags
func (s *NoteService) SearchNotes(userID string, request *models.SearchNotesRequest) (*models.NoteList, error) {
	ctx := context.Background()

	// Validate request manually
	if err := request.Validate(); err != nil {
		return nil, fmt.Errorf("invalid search request: %w", err)
	}

	// Build search query
	var conditions []string
	var args []interface{}
	argIndex := 1

	// Always include user filter
	conditions = append(conditions, fmt.Sprintf("user_id = $%d", argIndex))
	args = append(args, userID)
	argIndex++

	// Add text search if query provided
	if request.Query != "" {
		conditions = append(conditions, fmt.Sprintf("(title ILIKE $%d OR content ILIKE $%d)", argIndex, argIndex+1))
		args = append(args, "%"+request.Query+"%", "%"+request.Query+"%")
		argIndex += 2
	}

	// Add tag filter if tags provided
	if len(request.Tags) > 0 {
		// Join with note_tags and tags tables
		conditions = append(conditions, fmt.Sprintf(`
			id IN (
				SELECT note_id FROM note_tags nt
				JOIN tags t ON nt.tag_id = t.id
				WHERE t.name IN (%s)
				GROUP BY note_id
				HAVING COUNT(DISTINCT t.id) = $%d
			)
		`, strings.Repeat("?,", len(request.Tags)-1)+"?", argIndex))

		for _, tag := range request.Tags {
			args = append(args, tag)
		}
		argIndex++
	}

	// Combine conditions
	whereClause := "WHERE " + strings.Join(conditions, " AND ")

	// Get total count
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM notes %s", whereClause)
	var total int
	err := s.db.QueryRowContext(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, fmt.Errorf("failed to get search results count: %w", err)
	}

	// Build the main query
	query := fmt.Sprintf(`
		SELECT DISTINCT id, user_id, title, content, created_at, updated_at, version
		FROM notes
		%s
		ORDER BY %s %s
		LIMIT $%d OFFSET $%d
	`, whereClause, request.OrderBy, request.OrderDir, argIndex, argIndex+1)

	args = append(args, request.Limit, request.Offset)

	// Execute search query
	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to search notes: %w", err)
	}
	defer rows.Close()

	var notes []models.NoteResponse
	for rows.Next() {
		var note models.Note
		err := rows.Scan(&note.ID, &note.UserID, &note.Title, &note.Content,
			&note.CreatedAt, &note.UpdatedAt, &note.Version)
		if err != nil {
			return nil, fmt.Errorf("failed to scan note: %w", err)
		}

		// Get tags for this note
		tags, err := s.getNoteTags(ctx, note.ID.String())
		if err != nil {
			fmt.Printf("Warning: failed to get tags for note %s: %v\n", note.ID, err)
			tags = []string{}
		}

		noteResponse := note.ToResponse()
		noteResponse.Tags = tags
		notes = append(notes, noteResponse)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating search results: %w", err)
	}

	// Calculate pagination info
	page := (request.Offset / request.Limit) + 1
	hasMore := (request.Offset + request.Limit) < total

	return &models.NoteList{
		Notes:  notes,
		Total:  total,
		Page:   page,
		Limit:  request.Limit,
		HasMore: hasMore,
	}, nil
}

// GetNotesByTag retrieves notes filtered by a specific tag
func (s *NoteService) GetNotesByTag(userID, tag string, limit, offset int) (*models.NoteList, error) {
	ctx := context.Background()

	// Validate pagination parameters
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	// Get total count
	var total int
	err := s.db.QueryRowContext(ctx, `
		SELECT COUNT(DISTINCT n.id)
		FROM notes n
		JOIN note_tags nt ON n.id = nt.note_id
		JOIN tags t ON nt.tag_id = t.id
		WHERE n.user_id = $1 AND t.name = $2
	`, userID, tag).Scan(&total)
	if err != nil {
		return nil, fmt.Errorf("failed to get total notes count for tag: %w", err)
	}

	// Get notes with tag filter
	query := `
		SELECT n.id, n.user_id, n.title, n.content, n.created_at, n.updated_at, n.version
		FROM notes n
		JOIN note_tags nt ON n.id = nt.note_id
		JOIN tags t ON nt.tag_id = t.id
		WHERE n.user_id = $1 AND t.name = $2
		ORDER BY n.updated_at DESC
		LIMIT $3 OFFSET $4
	`

	rows, err := s.db.QueryContext(ctx, query, userID, tag, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to get notes by tag: %w", err)
	}
	defer rows.Close()

	var notes []models.NoteResponse
	for rows.Next() {
		var note models.Note
		err := rows.Scan(&note.ID, &note.UserID, &note.Title, &note.Content,
			&note.CreatedAt, &note.UpdatedAt, &note.Version)
		if err != nil {
			return nil, fmt.Errorf("failed to scan note: %w", err)
		}

		// Get all tags for this note
		tags, err := s.getNoteTags(ctx, note.ID.String())
		if err != nil {
			fmt.Printf("Warning: failed to get tags for note %s: %v\n", note.ID, err)
			tags = []string{}
		}

		noteResponse := note.ToResponse()
		noteResponse.Tags = tags
		notes = append(notes, noteResponse)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating notes by tag: %w", err)
	}

	// Calculate pagination info
	page := (offset / limit) + 1
	hasMore := (offset + limit) < total

	return &models.NoteList{
		Notes:  notes,
		Total:  total,
		Page:   page,
		Limit:  limit,
		HasMore: hasMore,
	}, nil
}

// GetNotesWithTimestamp retrieves notes updated since a given timestamp (for sync)
func (s *NoteService) GetNotesWithTimestamp(userID string, since time.Time) ([]models.Note, error) {
	ctx := context.Background()

	query := `
		SELECT id, user_id, title, content, created_at, updated_at, version
		FROM notes
		WHERE user_id = $1 AND updated_at > $2
		ORDER BY updated_at ASC
	`

	rows, err := s.db.QueryContext(ctx, query, userID, since)
	if err != nil {
		return nil, fmt.Errorf("failed to get notes with timestamp: %w", err)
	}
	defer rows.Close()

	var notes []models.Note
	for rows.Next() {
		var note models.Note
		err := rows.Scan(&note.ID, &note.UserID, &note.Title, &note.Content,
			&note.CreatedAt, &note.UpdatedAt, &note.Version)
		if err != nil {
			return nil, fmt.Errorf("failed to scan note: %w", err)
		}
		notes = append(notes, note)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating notes with timestamp: %w", err)
	}

	return notes, nil
}

// BatchCreateNotes creates multiple notes in a single transaction
func (s *NoteService) BatchCreateNotes(userID string, requests []*models.CreateNoteRequest) ([]models.Note, error) {
	ctx := context.Background()

	// Start transaction
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	var notes []models.Note

	for i, request := range requests {
		// Validate request manually
		if request.Content == "" {
			return nil, fmt.Errorf("invalid request in batch at index %d: content is required", i)
		}
		if len(request.Content) > 10000 {
			return nil, fmt.Errorf("invalid request in batch at index %d: content too long (max 10000 characters)", i)
		}
		if len(request.Title) > 500 {
			return nil, fmt.Errorf("invalid request in batch at index %d: title too long (max 500 characters)", i)
		}

		// Convert to note model
		note := request.ToNote(uuid.MustParse(userID))

		// Validate note
		if err := note.Validate(); err != nil {
			return nil, fmt.Errorf("invalid note in batch: %w", err)
		}

		// Insert note
		query := `
			INSERT INTO notes (id, user_id, title, content, created_at, updated_at, version)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
			RETURNING id, user_id, title, content, created_at, updated_at, version
		`

		err := tx.QueryRowContext(ctx, query,
			note.ID, note.UserID, note.Title, note.Content,
			note.CreatedAt, note.UpdatedAt, note.Version).Scan(
			&note.ID, &note.UserID, &note.Title, &note.Content,
			&note.CreatedAt, &note.UpdatedAt, &note.Version)

		if err != nil {
			return nil, fmt.Errorf("failed to create note in batch: %w", err)
		}

		notes = append(notes, *note)
	}

	// Commit transaction
	if err = tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit batch create: %w", err)
	}

	// Process tags for all notes (outside transaction to avoid blocking)
	for _, note := range notes {
		tags := note.ExtractHashtags()
		if len(tags) > 0 {
			if err := s.processNoteTags(context.Background(), note.ID.String(), tags); err != nil {
				fmt.Printf("Warning: failed to process tags for note %s: %v\n", note.ID, err)
			}
		}
	}

	return notes, nil
}

// BatchUpdateNotes updates multiple notes in a single transaction
func (s *NoteService) BatchUpdateNotes(userID string, requests []struct {
	NoteID  string
	Request *models.UpdateNoteRequest
}) ([]models.Note, error) {
	ctx := context.Background()

	// Start transaction
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	var notes []models.Note

	for _, req := range requests {
		// Get current note
		currentNote, err := s.GetNoteByID(userID, req.NoteID)
		if err != nil {
			return nil, fmt.Errorf("failed to get note %s in batch: %w", req.NoteID, err)
		}

		// Check version if provided
		if req.Request.Version != nil && *req.Request.Version != currentNote.Version {
			return nil, fmt.Errorf("note %s has been modified by another process", req.NoteID)
		}

		// Apply updates
		if !req.Request.ApplyUpdates(currentNote) {
			return nil, fmt.Errorf("no updates provided for note %s", req.NoteID)
		}

		// Validate updated note
		if err := currentNote.Validate(); err != nil {
			return nil, fmt.Errorf("invalid updated note %s: %w", req.NoteID, err)
		}

		// Increment version
		currentNote.Version++

		// Update in database
		query := `
			UPDATE notes
			SET title = $1, content = $2, updated_at = $3, version = $4
			WHERE id = $5 AND user_id = $6 AND version = $7 - 1
			RETURNING id, user_id, title, content, created_at, updated_at, version
		`

		err = tx.QueryRowContext(ctx, query,
			currentNote.Title, currentNote.Content, currentNote.UpdatedAt,
			currentNote.Version, currentNote.ID, currentNote.UserID, currentNote.Version).Scan(
			&currentNote.ID, &currentNote.UserID, &currentNote.Title, &currentNote.Content,
			&currentNote.CreatedAt, &currentNote.UpdatedAt, &currentNote.Version)

		if err != nil {
			if err == sql.ErrNoRows {
				return nil, fmt.Errorf("note %s has been modified by another process", req.NoteID)
			}
			return nil, fmt.Errorf("failed to update note %s in batch: %w", req.NoteID, err)
		}

		notes = append(notes, *currentNote)
	}

	// Commit transaction
	if err = tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit batch update: %w", err)
	}

	// Process tags for all updated notes
	for _, note := range notes {
		tags := note.ExtractHashtags()
		if err := s.updateNoteTags(context.Background(), note.ID.String(), tags); err != nil {
			fmt.Printf("Warning: failed to update tags for note %s: %v\n", note.ID, err)
		}
	}

	return notes, nil
}

// IncrementVersion increments the version of a note (for conflict resolution)
func (s *NoteService) IncrementVersion(noteID string) error {
	ctx := context.Background()

	query := `UPDATE notes SET version = version + 1 WHERE id = $1`
	_, err := s.db.ExecContext(ctx, query, noteID)
	if err != nil {
		return fmt.Errorf("failed to increment note version: %w", err)
	}

	return nil
}

// Private helper methods for tag management

// processNoteTags creates tags and associations for a note
func (s *NoteService) processNoteTags(ctx context.Context, noteID string, tags []string) error {
	for _, tagName := range tags {
		// Create or get tag
		tagID, err := s.getOrCreateTag(ctx, tagName)
		if err != nil {
			return fmt.Errorf("failed to get or create tag %s: %w", tagName, err)
		}

		// Associate tag with note
		if err := s.associateNoteWithTag(ctx, noteID, tagID); err != nil {
			return fmt.Errorf("failed to associate note with tag %s: %w", tagName, err)
		}
	}
	return nil
}

// updateNoteTags updates tags for a note (replaces all existing tags)
func (s *NoteService) updateNoteTags(ctx context.Context, noteID string, tags []string) error {
	// Delete existing tag associations
	if err := s.deleteAllNoteTags(ctx, noteID); err != nil {
		return err
	}

	// Process new tags
	return s.processNoteTags(ctx, noteID, tags)
}

// getOrCreateTag gets an existing tag or creates a new one
func (s *NoteService) getOrCreateTag(ctx context.Context, tagName string) (uuid.UUID, error) {
	var tagID uuid.UUID

	// Try to get existing tag
	err := s.db.QueryRowContext(ctx, "SELECT id FROM tags WHERE name = $1", tagName).Scan(&tagID)
	if err == nil {
		return tagID, nil
	}

	if err != sql.ErrNoRows {
		return uuid.Nil, fmt.Errorf("failed to query tag: %w", err)
	}

	// Create new tag
	tagID = uuid.New()
	query := "INSERT INTO tags (id, name, created_at) VALUES ($1, $2, $3)"
	_, err = s.db.ExecContext(ctx, query, tagID, tagName, time.Now())
	if err != nil {
		return uuid.Nil, fmt.Errorf("failed to create tag: %w", err)
	}

	return tagID, nil
}

// associateNoteWithTag creates an association between a note and a tag
func (s *NoteService) associateNoteWithTag(ctx context.Context, noteID string, tagID uuid.UUID) error {
	query := "INSERT INTO note_tags (note_id, tag_id, created_at) VALUES ($1, $2, $3)"
	_, err := s.db.ExecContext(ctx, query, noteID, tagID, time.Now())
	if err != nil {
		return fmt.Errorf("failed to associate note with tag: %w", err)
	}
	return nil
}

// deleteAllNoteTags deletes all tag associations for a note
func (s *NoteService) deleteAllNoteTags(ctx context.Context, noteID string) error {
	query := "DELETE FROM note_tags WHERE note_id = $1"
	_, err := s.db.ExecContext(ctx, query, noteID)
	if err != nil {
		return fmt.Errorf("failed to delete note tags: %w", err)
	}
	return nil
}

// getNoteTags retrieves all tags for a note
func (s *NoteService) getNoteTags(ctx context.Context, noteID string) ([]string, error) {
	query := `
		SELECT t.name
		FROM tags t
		JOIN note_tags nt ON t.id = nt.tag_id
		WHERE nt.note_id = $1
		ORDER BY t.name
	`

	rows, err := s.db.QueryContext(ctx, query, noteID)
	if err != nil {
		return nil, fmt.Errorf("failed to get note tags: %w", err)
	}
	defer rows.Close()

	var tags []string
	for rows.Next() {
		var tagName string
		if err := rows.Scan(&tagName); err != nil {
			return nil, fmt.Errorf("failed to scan tag: %w", err)
		}
		tags = append(tags, tagName)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating tags: %w", err)
	}

	return tags, nil
}