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
	ListTags(limit, offset int, orderBy, orderDir string) (*models.TagList, error)
	GetTagsByUser(userID string, limit, offset int) (*models.TagList, error)
	GetTagsWithUsageStats(limit, offset int) (*models.TagList, error)
	ExtractTagsFromContent(content string) []string
	ProcessTagsForNote(noteID string, tags []string) error
	UpdateTagsForNote(noteID string, tags []string) error
	GetTagSuggestions(partial string, limit int) ([]string, error)
	GetPopularTags(limit int) ([]models.TagResponse, error)
	GetUnusedTags() ([]models.TagResponse, error)
	GetTagAnalytics(tagID string) (*models.TagAnalytics, error)
	DeleteTag(tagID string) error
	UpdateTag(tagID string, request *models.UpdateTagRequest) (*models.Tag, error)
	MergeTags(sourceTagIDs []string, targetTagID string) error
	GetRelatedTags(tagID string, limit int) ([]models.TagResponse, error)
	CleanupUnusedTags() (int, error)
	ValidateTagNames(tagNames []string) error
	SearchTags(query string, limit, offset int) (*models.TagList, error)
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

// ListTags retrieves a paginated list of tags with sorting
func (s *TagService) ListTags(limit, offset int, orderBy, orderDir string) (*models.TagList, error) {
	ctx := context.Background()

	// Validate order by field
	validOrderBy := map[string]bool{
		"name":       true,
		"created_at": true,
		"note_count": true,
	}
	if !validOrderBy[orderBy] {
		orderBy = "name"
	}

	// Validate order direction
	if orderDir != "asc" && orderDir != "desc" {
		orderDir = "asc"
	}

	// Get total count
	var total int
	err := s.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM tags").Scan(&total)
	if err != nil {
		return nil, fmt.Errorf("failed to get total tags count: %w", err)
	}

	// Build query with note count
	query := fmt.Sprintf(`
		SELECT t.id, t.name, t.created_at, COUNT(nt.note_id) as note_count
		FROM tags t
		LEFT JOIN note_tags nt ON t.id = nt.tag_id
		GROUP BY t.id, t.name, t.created_at
		ORDER BY %s %s
		LIMIT $1 OFFSET $2
	`, orderBy, orderDir)

	rows, err := s.db.QueryContext(ctx, query, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to list tags: %w", err)
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

	page := (offset / limit) + 1
	hasMore := (offset + len(tags)) < total

	return &models.TagList{
		Tags:   tags,
		Total:  total,
		Page:   page,
		Limit:  limit,
		HasMore: hasMore,
	}, nil
}

// GetTagsByUser retrieves tags used by a specific user with usage statistics
func (s *TagService) GetTagsByUser(userID string, limit, offset int) (*models.TagList, error) {
	ctx := context.Background()

	// Get total count
	var total int
	err := s.db.QueryRowContext(ctx, `
		SELECT COUNT(DISTINCT t.id)
		FROM tags t
		INNER JOIN note_tags nt ON t.id = nt.tag_id
		INNER JOIN notes n ON nt.note_id = n.id
		WHERE n.user_id = $1
	`, userID).Scan(&total)

	if err != nil {
		return nil, fmt.Errorf("failed to get total user tags count: %w", err)
	}

	// Get tags with usage statistics
	query := `
		SELECT t.id, t.name, t.created_at,
		       COUNT(nt.note_id) as note_count,
		       MAX(n.updated_at) as last_used
		FROM tags t
		INNER JOIN note_tags nt ON t.id = nt.tag_id
		INNER JOIN notes n ON nt.note_id = n.id
		WHERE n.user_id = $1
		GROUP BY t.id, t.name, t.created_at
		ORDER BY note_count DESC, last_used DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := s.db.QueryContext(ctx, query, userID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to get user tags: %w", err)
	}
	defer rows.Close()

	var tags []models.TagResponse
	for rows.Next() {
		var tag models.TagResponse
		var lastUsed sql.NullTime
		err := rows.Scan(&tag.ID, &tag.Name, &tag.CreatedAt, &tag.NoteCount, &lastUsed)
		if err != nil {
			return nil, fmt.Errorf("failed to scan user tag: %w", err)
		}
		tags = append(tags, tag)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating user tags: %w", err)
	}

	page := (offset / limit) + 1
	hasMore := (offset + len(tags)) < total

	return &models.TagList{
		Tags:   tags,
		Total:  total,
		Page:   page,
		Limit:  limit,
		HasMore: hasMore,
	}, nil
}

// GetTagsWithUsageStats retrieves tags with comprehensive usage statistics
func (s *TagService) GetTagsWithUsageStats(limit, offset int) (*models.TagList, error) {
	ctx := context.Background()

	// Get total count
	var total int
	err := s.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM tags").Scan(&total)
	if err != nil {
		return nil, fmt.Errorf("failed to get total tags count: %w", err)
	}

	// Get tags with detailed statistics
	query := `
		SELECT t.id, t.name, t.created_at,
		       COUNT(nt.note_id) as note_count,
		       COUNT(DISTINCT n.user_id) as user_count,
		       MAX(n.updated_at) as last_used,
		       MIN(n.created_at) as first_used
		FROM tags t
		LEFT JOIN note_tags nt ON t.id = nt.tag_id
		LEFT JOIN notes n ON nt.note_id = n.id
		GROUP BY t.id, t.name, t.created_at
		ORDER BY note_count DESC, user_count DESC
		LIMIT $1 OFFSET $2
	`

	rows, err := s.db.QueryContext(ctx, query, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to get tags with stats: %w", err)
	}
	defer rows.Close()

	var tags []models.TagResponse
	for rows.Next() {
		var tag models.TagResponse
		var userCount int
		var lastUsed, firstUsed sql.NullTime

		err := rows.Scan(&tag.ID, &tag.Name, &tag.CreatedAt, &tag.NoteCount,
			&userCount, &lastUsed, &firstUsed)
		if err != nil {
			return nil, fmt.Errorf("failed to scan tag stats: %w", err)
		}

		tags = append(tags, tag)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating tag stats: %w", err)
	}

	page := (offset / limit) + 1
	hasMore := (offset + len(tags)) < total

	return &models.TagList{
		Tags:   tags,
		Total:  total,
		Page:   page,
		Limit:  limit,
		HasMore: hasMore,
	}, nil
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

// GetTagSuggestions returns tag suggestions based on partial input
func (s *TagService) GetTagSuggestions(partial string, limit int) ([]string, error) {
	ctx := context.Background()

	query := `
		SELECT name
		FROM tags
		WHERE LOWER(name) LIKE LOWER($1)
		ORDER BY
			CASE WHEN LOWER(name) = LOWER($1) THEN 1 ELSE 2 END,
			name
		LIMIT $2
	`

	rows, err := s.db.QueryContext(ctx, query, partial+"%", limit)
	if err != nil {
		return nil, fmt.Errorf("failed to get tag suggestions: %w", err)
	}
	defer rows.Close()

	var suggestions []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, fmt.Errorf("failed to scan suggestion: %w", err)
		}
		suggestions = append(suggestions, name)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating suggestions: %w", err)
	}

	return suggestions, nil
}

// GetPopularTags returns most used tags
func (s *TagService) GetPopularTags(limit int) ([]models.TagResponse, error) {
	ctx := context.Background()

	query := `
		SELECT t.id, t.name, t.created_at, COUNT(nt.note_id) as note_count
		FROM tags t
		INNER JOIN note_tags nt ON t.id = nt.tag_id
		GROUP BY t.id, t.name, t.created_at
		HAVING COUNT(nt.note_id) > 0
		ORDER BY note_count DESC, t.name
		LIMIT $1
	`

	rows, err := s.db.QueryContext(ctx, query, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to get popular tags: %w", err)
	}
	defer rows.Close()

	var tags []models.TagResponse
	for rows.Next() {
		var tag models.TagResponse
		err := rows.Scan(&tag.ID, &tag.Name, &tag.CreatedAt, &tag.NoteCount)
		if err != nil {
			return nil, fmt.Errorf("failed to scan popular tag: %w", err)
		}
		tags = append(tags, tag)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating popular tags: %w", err)
	}

	return tags, nil
}

// GetUnusedTags returns tags that are not associated with any notes
func (s *TagService) GetUnusedTags() ([]models.TagResponse, error) {
	ctx := context.Background()

	query := `
		SELECT t.id, t.name, t.created_at, 0 as note_count
		FROM tags t
		LEFT JOIN note_tags nt ON t.id = nt.tag_id
		WHERE nt.note_id IS NULL
		ORDER BY t.created_at DESC
	`

	rows, err := s.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to get unused tags: %w", err)
	}
	defer rows.Close()

	var tags []models.TagResponse
	for rows.Next() {
		var tag models.TagResponse
		err := rows.Scan(&tag.ID, &tag.Name, &tag.CreatedAt, &tag.NoteCount)
		if err != nil {
			return nil, fmt.Errorf("failed to scan unused tag: %w", err)
		}
		tags = append(tags, tag)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating unused tags: %w", err)
	}

	return tags, nil
}

// GetTagAnalytics returns comprehensive analytics for a specific tag
func (s *TagService) GetTagAnalytics(tagID string) (*models.TagAnalytics, error) {
	ctx := context.Background()

	tagUUID, err := uuid.Parse(tagID)
	if err != nil {
		return nil, fmt.Errorf("invalid tag ID: %w", err)
	}

	var analytics models.TagAnalytics

	// Get basic tag info
	err = s.db.QueryRowContext(ctx,
		"SELECT id, name, created_at FROM tags WHERE id = $1",
		tagUUID).Scan(&analytics.ID, &analytics.Name, &analytics.CreatedAt)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("tag not found")
		}
		return nil, fmt.Errorf("failed to get tag info: %w", err)
	}

	// Get usage statistics
	err = s.db.QueryRowContext(ctx, `
		SELECT
			COUNT(DISTINCT nt.note_id) as total_notes,
			COUNT(DISTINCT n.user_id) as unique_users,
			MIN(n.created_at) as first_used,
			MAX(n.updated_at) as last_used,
			COUNT(*) as total_associations
		FROM note_tags nt
		INNER JOIN notes n ON nt.note_id = n.id
		WHERE nt.tag_id = $1
	`, tagUUID).Scan(&analytics.TotalNotes, &analytics.UniqueUsers, &analytics.FirstUsed,
		&analytics.LastUsed, &analytics.TotalAssociations)

	if err != nil {
		return nil, fmt.Errorf("failed to get tag analytics: %w", err)
	}

	// Calculate usage frequency (notes per day since first use)
	if analytics.FirstUsed.Valid {
		daysSinceFirst := time.Since(analytics.FirstUsed.Time).Hours() / 24
		if daysSinceFirst > 0 {
			analytics.UsageFrequency = float64(analytics.TotalNotes) / daysSinceFirst
		}
	}

	// Determine if trending (used in last 7 days more than average)
	var recentCount int
	s.db.QueryRowContext(ctx, `
		SELECT COUNT(DISTINCT nt.note_id)
		FROM note_tags nt
		INNER JOIN notes n ON nt.note_id = n.id
		WHERE nt.tag_id = $1 AND n.updated_at >= NOW() - INTERVAL '7 days'
	`, tagUUID).Scan(&recentCount)

	analytics.RecentNotes = recentCount
	analytics.IsTrending = recentCount > int(analytics.UsageFrequency*7)

	// Get related tags (tags that appear together with this tag)
	relatedTags, err := s.GetRelatedTags(tagID, 10)
	if err == nil {
		analytics.RelatedTags = relatedTags
	}

	return &analytics, nil
}

// DeleteTag deletes a tag (only if not associated with any notes)
func (s *TagService) DeleteTag(tagID string) error {
	ctx := context.Background()

	tagUUID, err := uuid.Parse(tagID)
	if err != nil {
		return fmt.Errorf("invalid tag ID: %w", err)
	}

	// Check if tag is associated with any notes
	var count int
	err = s.db.QueryRowContext(ctx,
		"SELECT COUNT(*) FROM note_tags WHERE tag_id = $1",
		tagUUID).Scan(&count)

	if err != nil {
		return fmt.Errorf("failed to check tag associations: %w", err)
	}

	if count > 0 {
		return fmt.Errorf("cannot delete tag: it is associated with %d notes", count)
	}

	// Delete the tag
	query := "DELETE FROM tags WHERE id = $1"
	_, err = s.db.ExecContext(ctx, query, tagUUID)
	if err != nil {
		return fmt.Errorf("failed to delete tag: %w", err)
	}

	return nil
}

// UpdateTag updates a tag name
func (s *TagService) UpdateTag(tagID string, request *models.UpdateTagRequest) (*models.Tag, error) {
	ctx := context.Background()

	tagUUID, err := uuid.Parse(tagID)
	if err != nil {
		return nil, fmt.Errorf("invalid tag ID: %w", err)
	}

	// Validate new name
	if err := models.ValidateTags([]string{request.Name}); err != nil {
		return nil, fmt.Errorf("invalid tag name: %w", err)
	}

	// Check if new name already exists
	var existingID uuid.UUID
	err = s.db.QueryRowContext(ctx,
		"SELECT id FROM tags WHERE LOWER(name) = LOWER($1) AND id != $2",
		request.Name, tagUUID).Scan(&existingID)

	if err == nil {
		return nil, fmt.Errorf("tag with this name already exists")
	}

	if err != sql.ErrNoRows {
		return nil, fmt.Errorf("failed to check existing tag: %w", err)
	}

	// Update tag
	query := `
		UPDATE tags
		SET name = $1
		WHERE id = $2
		RETURNING id, name, created_at
	`

	var tag models.Tag
	err = s.db.QueryRowContext(ctx, query, request.Name, tagUUID).Scan(
		&tag.ID, &tag.Name, &tag.CreatedAt)

	if err != nil {
		return nil, fmt.Errorf("failed to update tag: %w", err)
	}

	return &tag, nil
}

// MergeTags merges multiple source tags into a target tag
func (s *TagService) MergeTags(sourceTagIDs []string, targetTagID string) error {
	ctx := context.Background()

	targetUUID, err := uuid.Parse(targetTagID)
	if err != nil {
		return fmt.Errorf("invalid target tag ID: %w", err)
	}

	// Start transaction
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Merge each source tag
	for _, sourceTagID := range sourceTagIDs {
		sourceUUID, err := uuid.Parse(sourceTagID)
		if err != nil {
			return fmt.Errorf("invalid source tag ID %s: %w", sourceTagID, err)
		}

		// Update all note tag associations to point to target tag
		_, err = tx.ExecContext(ctx, `
			UPDATE note_tags
			SET tag_id = $1
			WHERE tag_id = $2
		`, targetUUID, sourceUUID)

		if err != nil {
			return fmt.Errorf("failed to merge tag associations for %s: %w", sourceTagID, err)
		}

		// Delete the source tag
		_, err = tx.ExecContext(ctx, "DELETE FROM tags WHERE id = $1", sourceUUID)
		if err != nil {
			return fmt.Errorf("failed to delete source tag %s: %w", sourceTagID, err)
		}
	}

	// Commit transaction
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit merge transaction: %w", err)
	}

	return nil
}

// GetRelatedTags returns tags that frequently appear together with the given tag
func (s *TagService) GetRelatedTags(tagID string, limit int) ([]models.TagResponse, error) {
	ctx := context.Background()

	tagUUID, err := uuid.Parse(tagID)
	if err != nil {
		return nil, fmt.Errorf("invalid tag ID: %w", err)
	}

	query := `
		SELECT t.id, t.name, t.created_at, COUNT(*) as co_occurrence
		FROM tags t
		INNER JOIN note_tags nt ON t.id = nt.tag_id
		INNER JOIN note_tags nt2 ON nt.note_id = nt2.note_id
		WHERE nt2.tag_id = $1 AND t.id != $1
		GROUP BY t.id, t.name, t.created_at
		ORDER BY co_occurrence DESC, t.name
		LIMIT $2
	`

	rows, err := s.db.QueryContext(ctx, query, tagUUID, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to get related tags: %w", err)
	}
	defer rows.Close()

	var tags []models.TagResponse
	for rows.Next() {
		var tag models.TagResponse
		var coOccurrence int
		err := rows.Scan(&tag.ID, &tag.Name, &tag.CreatedAt, &coOccurrence)
		if err != nil {
			return nil, fmt.Errorf("failed to scan related tag: %w", err)
		}
		tags = append(tags, tag)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating related tags: %w", err)
	}

	return tags, nil
}

// CleanupUnusedTags removes tags that are not associated with any notes
func (s *TagService) CleanupUnusedTags() (int, error) {
	ctx := context.Background()

	result, err := s.db.ExecContext(ctx, `
		DELETE FROM tags
		WHERE id NOT IN (SELECT DISTINCT tag_id FROM note_tags)
	`)
	if err != nil {
		return 0, fmt.Errorf("failed to cleanup unused tags: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return 0, fmt.Errorf("failed to get cleanup count: %w", err)
	}

	return int(rowsAffected), nil
}

// ValidateTagNames validates a list of tag names
func (s *TagService) ValidateTagNames(tagNames []string) error {
	return models.ValidateTags(tagNames)
}

// SearchTags searches tags by name with pagination
func (s *TagService) SearchTags(query string, limit, offset int) (*models.TagList, error) {
	ctx := context.Background()

	// Get total count
	var total int
	err := s.db.QueryRowContext(ctx, `
		SELECT COUNT(*)
		FROM tags
		WHERE LOWER(name) LIKE LOWER($1)
	`, "%"+query+"%").Scan(&total)

	if err != nil {
		return nil, fmt.Errorf("failed to get search results count: %w", err)
	}

	// Search tags
	searchQuery := `
		SELECT t.id, t.name, t.created_at, COUNT(nt.note_id) as note_count
		FROM tags t
		LEFT JOIN note_tags nt ON t.id = nt.tag_id
		WHERE LOWER(t.name) LIKE LOWER($1)
		GROUP BY t.id, t.name, t.created_at
		ORDER BY
			CASE WHEN LOWER(t.name) = LOWER($1) THEN 1 ELSE 2 END,
			t.name
		LIMIT $2 OFFSET $3
	`

	rows, err := s.db.QueryContext(ctx, searchQuery, "%"+query+"%", limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to search tags: %w", err)
	}
	defer rows.Close()

	var tags []models.TagResponse
	for rows.Next() {
		var tag models.TagResponse
		err := rows.Scan(&tag.ID, &tag.Name, &tag.CreatedAt, &tag.NoteCount)
		if err != nil {
			return nil, fmt.Errorf("failed to scan search result: %w", err)
		}
		tags = append(tags, tag)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating search results: %w", err)
	}

	page := (offset / limit) + 1
	hasMore := (offset + len(tags)) < total

	return &models.TagList{
		Tags:   tags,
		Total:  total,
		Page:   page,
		Limit:  limit,
		HasMore: hasMore,
	}, nil
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