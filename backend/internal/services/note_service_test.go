package services

import (
	"context"
	"database/sql"
	"fmt"
	"testing"
	"time"

	_ "github.com/lib/pq"
	"github.com/gpd/my-notes/internal/config"
	"github.com/gpd/my-notes/internal/database"
	"github.com/gpd/my-notes/internal/models"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
)

// NoteServiceTestSuite contains all tests for the note service
type NoteServiceTestSuite struct {
	suite.Suite
	db         *sql.DB
	service    *NoteService
	tagService *TagService
	userID     string
	cleanupDB  func()
}

// SetupSuite runs once before all tests
func (suite *NoteServiceTestSuite) SetupSuite() {
	// Check if PostgreSQL tests are enabled
	if testing.Short() {
		suite.T().Skip("Skipping integration tests in short mode")
	}

	// Load configuration
	cfg, err := config.LoadConfig("")
	require.NoError(suite.T(), err, "Failed to load config")

	// Create test database
	db, err := database.CreateTestDatabase(cfg.Database)
	require.NoError(suite.T(), err, "Failed to create test database")
	suite.db = db
	suite.tagService = NewTagService(db)
	suite.service = NewNoteService(db, suite.tagService)
	suite.cleanupDB = func() { db.Close() }
	suite.userID = uuid.New().String()

	// Create test user
	err = suite.createTestUser()
	require.NoError(suite.T(), err, "Failed to create test user")
}

// TearDownSuite runs once after all tests
func (suite *NoteServiceTestSuite) TearDownSuite() {
	if suite.cleanupDB != nil {
		suite.cleanupDB()
	}
}

// SetupTest runs before each test
func (suite *NoteServiceTestSuite) SetupTest() {
	// Clean up test data before each test
	suite.cleanupTestData()
}

// TearDownTest runs after each test
func (suite *NoteServiceTestSuite) TearDownTest() {
	suite.cleanupTestData()
}

// cleanupTestData cleans up test data
func (suite *NoteServiceTestSuite) cleanupTestData() {
	if suite.db == nil {
		return
	}

	_, err := suite.db.ExecContext(context.Background(),
		"DELETE FROM note_tags WHERE note_id IN (SELECT id FROM notes WHERE user_id = $1)",
		suite.userID)
	if err != nil {
		suite.T().Logf("Warning: failed to cleanup note tags: %v", err)
	}

	_, err = suite.db.ExecContext(context.Background(),
		"DELETE FROM tags WHERE id IN (SELECT tag_id FROM note_tags WHERE note_id IN (SELECT id FROM notes WHERE user_id = $1))",
		suite.userID)
	if err != nil {
		suite.T().Logf("Warning: failed to cleanup tags: %v", err)
	}

	_, err = suite.db.ExecContext(context.Background(),
		"DELETE FROM notes WHERE user_id = $1", suite.userID)
	if err != nil {
		suite.T().Logf("Warning: failed to cleanup notes: %v", err)
	}
}

// createTestUser creates a test user for the tests
func (suite *NoteServiceTestSuite) createTestUser() error {
	if suite.db == nil {
		return fmt.Errorf("database not initialized")
	}

	query := `
		INSERT INTO users (id, google_id, email, name, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6)
	`
	userUUID := uuid.MustParse(suite.userID)
	_, err := suite.db.ExecContext(context.Background(), query,
		userUUID, "google_"+suite.userID, "test@example.com", "Test User",
		time.Now(), time.Now())
	return err
}

// TestCreateNote tests the CreateNote method
func (suite *NoteServiceTestSuite) TestCreateNote() {
	tests := []struct {
		name    string
		request *models.CreateNoteRequest
		wantErr bool
		errMsg  string
	}{
		{
			name: "valid note with title",
			request: &models.CreateNoteRequest{
				Title:   "Test Note",
				Content: "This is a test note with some content.",
			},
			wantErr: false,
		},
		{
			name: "valid note without title",
			request: &models.CreateNoteRequest{
				Content: "This is a test note without a title. It has a long first line that should be used as title.",
			},
			wantErr: false,
		},
		{
			name: "note with hashtags",
			request: &models.CreateNoteRequest{
				Title:   "Note with tags",
				Content: "This note has #important and #work related content.",
			},
			wantErr: false,
		},
		{
			name: "empty content should fail",
			request: &models.CreateNoteRequest{
				Title:   "Empty note",
				Content: "",
			},
			wantErr: true,
			errMsg:  "content is required",
		},
		{
			name: "content too long should fail",
			request: &models.CreateNoteRequest{
				Title:   "Long note",
				Content: string(make([]byte, 10001)), // 10001 characters
			},
			wantErr: true,
			errMsg:  "content too long",
		},
		{
			name: "title too long should fail",
			request: &models.CreateNoteRequest{
				Title:   string(make([]byte, 501)), // 501 characters
				Content: "Valid content",
			},
			wantErr: true,
			errMsg:  "title too long",
		},
	}

	for _, tt := range tests {
		suite.Run(tt.name, func() {
			note, err := suite.service.CreateNote(suite.userID, tt.request)

			if tt.wantErr {
				assert.Error(suite.T(), err)
				assert.Nil(suite.T(), note)
				if tt.errMsg != "" {
					assert.Contains(suite.T(), err.Error(), tt.errMsg)
				}
			} else {
				assert.NoError(suite.T(), err)
				assert.NotNil(suite.T(), note)
				assert.Equal(suite.T(), suite.userID, note.UserID.String())
				assert.Equal(suite.T(), 1, note.Version)
				assert.NotZero(suite.T(), note.ID)
				assert.NotZero(suite.T(), note.CreatedAt)
				assert.NotZero(suite.T(), note.UpdatedAt)

				// Check if title was auto-generated if not provided
				if tt.request.Title == "" {
					assert.NotNil(suite.T(), note.Title)
					assert.NotEmpty(suite.T(), *note.Title)
				} else {
					assert.Equal(suite.T(), tt.request.Title, *note.Title)
				}
			}
		})
	}
}

// TestGetNoteByID tests the GetNoteByID method
func (suite *NoteServiceTestSuite) TestGetNoteByID() {
	// Create a test note first
	request := &models.CreateNoteRequest{
		Title:   "Test Note for Get",
		Content: "This is a test note for retrieval testing.",
	}
	createdNote, err := suite.service.CreateNote(suite.userID, request)
	require.NoError(suite.T(), err)
	require.NotNil(suite.T(), createdNote)

	tests := []struct {
		name    string
		userID  string
		noteID  string
		wantErr bool
		errMsg  string
	}{
		{
			name:    "valid note retrieval",
			userID:  suite.userID,
			noteID:  createdNote.ID.String(),
			wantErr: false,
		},
		{
			name:    "invalid note ID",
			userID:  suite.userID,
			noteID:  uuid.New().String(),
			wantErr: true,
			errMsg:  "note not found",
		},
		{
			name:    "different user should not access note",
			userID:  uuid.New().String(),
			noteID:  createdNote.ID.String(),
			wantErr: true,
			errMsg:  "note not found",
		},
	}

	for _, tt := range tests {
		suite.Run(tt.name, func() {
			note, err := suite.service.GetNoteByID(tt.userID, tt.noteID)

			if tt.wantErr {
				assert.Error(suite.T(), err)
				assert.Nil(suite.T(), note)
				if tt.errMsg != "" {
					assert.Contains(suite.T(), err.Error(), tt.errMsg)
				}
			} else {
				assert.NoError(suite.T(), err)
				assert.NotNil(suite.T(), note)
				assert.Equal(suite.T(), createdNote.ID, note.ID)
				assert.Equal(suite.T(), createdNote.Title, note.Title)
				assert.Equal(suite.T(), createdNote.Content, note.Content)
			}
		})
	}
}

// TestUpdateNote tests the UpdateNote method
func (suite *NoteServiceTestSuite) TestUpdateNote() {
	// Create a test note first
	request := &models.CreateNoteRequest{
		Title:   "Original Title",
		Content: "Original content for testing updates.",
	}
	createdNote, err := suite.service.CreateNote(suite.userID, request)
	require.NoError(suite.T(), err)
	require.NotNil(suite.T(), createdNote)

	tests := []struct {
		name    string
		userID  string
		noteID  string
		request *models.UpdateNoteRequest
		wantErr bool
		errMsg  string
	}{
		{
			name:   "valid update - title only",
			userID: suite.userID,
			noteID: createdNote.ID.String(),
			request: &models.UpdateNoteRequest{
				Title:   func(s string) *string { return &s }("Updated Title"),
				Version: func(i int) *int { return &i }(createdNote.Version),
			},
			wantErr: false,
		},
		{
			name:   "valid update - content only",
			userID: suite.userID,
			noteID: createdNote.ID.String(),
			request: &models.UpdateNoteRequest{
				Content: func(s string) *string { return &s }("Updated content with new information."),
				Version: func(i int) *int { return &i }(createdNote.Version + 1), // Version was incremented in previous test
			},
			wantErr: false,
		},
		{
			name:   "valid update - both title and content",
			userID: suite.userID,
			noteID: createdNote.ID.String(),
			request: &models.UpdateNoteRequest{
				Title:   func(s string) *string { return &s }("Both Updated Title"),
				Content: func(s string) *string { return &s }("Both updated content."),
				Version: func(i int) *int { return &i }(createdNote.Version + 2),
			},
			wantErr: false,
		},
		{
			name:   "version mismatch should fail",
			userID: suite.userID,
			noteID: createdNote.ID.String(),
			request: &models.UpdateNoteRequest{
				Title:   func(s string) *string { return &s }("Should fail"),
				Version: func(i int) *int { return &i }(1), // Wrong version
			},
			wantErr: true,
			errMsg:  "version mismatch",
		},
		{
			name:   "no updates should fail",
			userID: suite.userID,
			noteID: createdNote.ID.String(),
			request: &models.UpdateNoteRequest{
				Version: func(i int) *int { return &i }(createdNote.Version + 3),
			},
			wantErr: true,
			errMsg:  "no updates provided",
		},
		{
			name:   "different user should not update note",
			userID: uuid.New().String(),
			noteID: createdNote.ID.String(),
			request: &models.UpdateNoteRequest{
				Title:   func(s string) *string { return &s }("Should fail"),
				Version: func(i int) *int { return &i }(createdNote.Version + 3),
			},
			wantErr: true,
			errMsg:  "note not found",
		},
	}

	for _, tt := range tests {
		suite.Run(tt.name, func() {
			updatedNote, err := suite.service.UpdateNote(tt.userID, tt.noteID, tt.request)

			if tt.wantErr {
				assert.Error(suite.T(), err)
				assert.Nil(suite.T(), updatedNote)
				if tt.errMsg != "" {
					assert.Contains(suite.T(), err.Error(), tt.errMsg)
				}
			} else {
				assert.NoError(suite.T(), err)
				assert.NotNil(suite.T(), updatedNote)
				assert.Greater(suite.T(), updatedNote.UpdatedAt, createdNote.UpdatedAt)
				assert.Greater(suite.T(), updatedNote.Version, createdNote.Version)

				// Verify the updates were applied
				if tt.request.Title != nil {
					assert.Equal(suite.T(), *tt.request.Title, *updatedNote.Title)
				}
				if tt.request.Content != nil {
					assert.Equal(suite.T(), *tt.request.Content, updatedNote.Content)
				}
			}
		})
	}
}

// TestDeleteNote tests the DeleteNote method
func (suite *NoteServiceTestSuite) TestDeleteNote() {
	// Create a test note first
	request := &models.CreateNoteRequest{
		Title:   "Note to Delete",
		Content: "This note will be deleted for testing.",
	}
	createdNote, err := suite.service.CreateNote(suite.userID, request)
	require.NoError(suite.T(), err)
	require.NotNil(suite.T(), createdNote)

	tests := []struct {
		name    string
		userID  string
		noteID  string
		wantErr bool
		errMsg  string
	}{
		{
			name:    "valid deletion",
			userID:  suite.userID,
			noteID:  createdNote.ID.String(),
			wantErr: false,
		},
		{
			name:    "delete non-existent note",
			userID:  suite.userID,
			noteID:  uuid.New().String(),
			wantErr: true,
			errMsg:  "note not found",
		},
		{
			name:    "different user should not delete note",
			userID:  uuid.New().String(),
			noteID:  createdNote.ID.String(),
			wantErr: true,
			errMsg:  "note not found",
		},
	}

	for _, tt := range tests {
		suite.Run(tt.name, func() {
			err := suite.service.DeleteNote(tt.userID, tt.noteID)

			if tt.wantErr {
				assert.Error(suite.T(), err)
				if tt.errMsg != "" {
					assert.Contains(suite.T(), err.Error(), tt.errMsg)
				}
			} else {
				assert.NoError(suite.T(), err)

				// Verify note is actually deleted
				_, err := suite.service.GetNoteByID(tt.userID, tt.noteID)
				assert.Error(suite.T(), err)
				assert.Contains(suite.T(), err.Error(), "note not found")
			}
		})
	}
}

// TestListNotes tests the ListNotes method
func (suite *NoteServiceTestSuite) TestListNotes() {
	// Create multiple test notes
	notes := make([]*models.Note, 5)
	for i := 0; i < 5; i++ {
		request := &models.CreateNoteRequest{
			Title:   fmt.Sprintf("Test Note %d", i+1),
			Content: fmt.Sprintf("This is test note number %d.", i+1),
		}
		note, err := suite.service.CreateNote(suite.userID, request)
		require.NoError(suite.T(), err)
		notes[i] = note
	}

	tests := []struct {
		name      string
		limit     int
		offset    int
		orderBy   string
		orderDir  string
		wantErr   bool
		wantCount int
	}{
		{
			name:      "list all notes",
			limit:     20,
			offset:    0,
			orderBy:   "created_at",
			orderDir:  "desc",
			wantErr:   false,
			wantCount: 5,
		},
		{
			name:      "list with limit",
			limit:     3,
			offset:    0,
			orderBy:   "created_at",
			orderDir:  "desc",
			wantErr:   false,
			wantCount: 3,
		},
		{
			name:      "list with offset",
			limit:     20,
			offset:    2,
			orderBy:   "created_at",
			orderDir:  "desc",
			wantErr:   false,
			wantCount: 3,
		},
		{
			name:      "list ordered by title",
			limit:     20,
			offset:    0,
			orderBy:   "title",
			orderDir:  "asc",
			wantErr:   false,
			wantCount: 5,
		},
		{
			name:      "invalid order by should use default",
			limit:     20,
			offset:    0,
			orderBy:   "invalid",
			orderDir:  "desc",
			wantErr:   false,
			wantCount: 5,
		},
		{
			name:      "invalid order dir should use default",
			limit:     20,
			offset:    0,
			orderBy:   "created_at",
			orderDir:  "invalid",
			wantErr:   false,
			wantCount: 5,
		},
	}

	for _, tt := range tests {
		suite.Run(tt.name, func() {
			noteList, err := suite.service.ListNotes(suite.userID, tt.limit, tt.offset, tt.orderBy, tt.orderDir)

			if tt.wantErr {
				assert.Error(suite.T(), err)
				assert.Nil(suite.T(), noteList)
			} else {
				assert.NoError(suite.T(), err)
				assert.NotNil(suite.T(), noteList)
				assert.Equal(suite.T(), tt.wantCount, len(noteList.Notes))
				assert.Equal(suite.T(), 5, noteList.Total) // Total should always be 5
				assert.Greater(suite.T(), noteList.Page, 0)
				assert.Greater(suite.T(), noteList.Limit, 0)

				// Verify pagination logic
				expectedHasMore := (tt.offset + tt.limit) < 5
				assert.Equal(suite.T(), expectedHasMore, noteList.HasMore)

				// Verify all notes belong to the user
				for _, note := range noteList.Notes {
					assert.Equal(suite.T(), suite.userID, note.UserID.String())
				}
			}
		})
	}
}

// TestSearchNotes tests the SearchNotes method
func (suite *NoteServiceTestSuite) TestSearchNotes() {
	// Create notes with different content for searching
	notes := []struct {
		title   string
		content string
	}{
		{"Work Document", "This is an important #work document about project management."},
		{"Personal Note", "#personal reminder about shopping and daily tasks."},
		{"Meeting Notes", "Discussion about #work goals and #team collaboration."},
		{"Idea", "New #idea for innovative product development."},
		{"Technical", "Code snippet for #work API integration."},
	}

	for _, n := range notes {
		request := &models.CreateNoteRequest{
			Title:   n.title,
			Content: n.content,
		}
		_, err := suite.service.CreateNote(suite.userID, request)
		require.NoError(suite.T(), err)
	}

	tests := []struct {
		name      string
		request   *models.SearchNotesRequest
		wantErr   bool
		wantCount int
	}{
		{
			name: "search by content text",
			request: &models.SearchNotesRequest{
				Query:    "document",
				Limit:    20,
				Offset:   0,
				OrderBy:  "created_at",
				OrderDir: "desc",
			},
			wantErr:   false,
			wantCount: 1,
		},
		{
			name: "search by title text",
			request: &models.SearchNotesRequest{
				Query:    "Meeting",
				Limit:    20,
				Offset:   0,
				OrderBy:  "created_at",
				OrderDir: "desc",
			},
			wantErr:   false,
			wantCount: 1,
		},
		{
			name: "search by single tag",
			request: &models.SearchNotesRequest{
				Tags:     []string{"#work"},
				Limit:    20,
				Offset:   0,
				OrderBy:  "created_at",
				OrderDir: "desc",
			},
			wantErr:   false,
			wantCount: 3,
		},
		{
			name: "search by multiple tags",
			request: &models.SearchNotesRequest{
				Tags:     []string{"#work", "#team"},
				Limit:    20,
				Offset:   0,
				OrderBy:  "created_at",
				OrderDir: "desc",
			},
			wantErr:   false,
			wantCount: 1, // Only "Meeting Notes" has both tags
		},
		{
			name: "search by text and tag",
			request: &models.SearchNotesRequest{
				Query:    "project",
				Tags:     []string{"#work"},
				Limit:    20,
				Offset:   0,
				OrderBy:  "created_at",
				OrderDir: "desc",
			},
			wantErr:   false,
			wantCount: 1,
		},
		{
			name: "search with no results",
			request: &models.SearchNotesRequest{
				Query:    "nonexistent",
				Limit:    20,
				Offset:   0,
				OrderBy:  "created_at",
				OrderDir: "desc",
			},
			wantErr:   false,
			wantCount: 0,
		},
	}

	for _, tt := range tests {
		suite.Run(tt.name, func() {
			noteList, err := suite.service.SearchNotes(suite.userID, tt.request)

			if tt.wantErr {
				assert.Error(suite.T(), err)
				assert.Nil(suite.T(), noteList)
			} else {
				assert.NoError(suite.T(), err)
				assert.NotNil(suite.T(), noteList)
				assert.Equal(suite.T(), tt.wantCount, len(noteList.Notes))

				// Verify search results have tags populated
				for _, note := range noteList.Notes {
					assert.NotNil(suite.T(), note.Tags)
				}
			}
		})
	}
}

// TestGetNotesByTag tests the GetNotesByTag method
func (suite *NoteServiceTestSuite) TestGetNotesByTag() {
	// Create notes with specific tags
	notes := []struct {
		title   string
		content string
	}{
		{"Work Task 1", "Complete the #work project documentation."},
		{"Work Task 2", "Review #work code submissions."},
		{"Personal Item", "Buy groceries for #personal shopping."},
	}

	for _, n := range notes {
		request := &models.CreateNoteRequest{
			Title:   n.title,
			Content: n.content,
		}
		_, err := suite.service.CreateNote(suite.userID, request)
		require.NoError(suite.T(), err)
	}

	tests := []struct {
		name      string
		tag       string
		limit     int
		offset    int
		wantErr   bool
		wantCount int
	}{
		{
			name:      "get work notes",
			tag:       "#work",
			limit:     20,
			offset:    0,
			wantErr:   false,
			wantCount: 2,
		},
		{
			name:      "get personal notes",
			tag:       "#personal",
			limit:     20,
			offset:    0,
			wantErr:   false,
			wantCount: 1,
		},
		{
			name:      "non-existent tag",
			tag:       "#nonexistent",
			limit:     20,
			offset:    0,
			wantErr:   false,
			wantCount: 0,
		},
		{
			name:      "with limit",
			tag:       "#work",
			limit:     1,
			offset:    0,
			wantErr:   false,
			wantCount: 1,
		},
	}

	for _, tt := range tests {
		suite.Run(tt.name, func() {
			noteList, err := suite.service.GetNotesByTag(suite.userID, tt.tag, tt.limit, tt.offset)

			if tt.wantErr {
				assert.Error(suite.T(), err)
				assert.Nil(suite.T(), noteList)
			} else {
				assert.NoError(suite.T(), err)
				assert.NotNil(suite.T(), noteList)
				assert.Equal(suite.T(), tt.wantCount, len(noteList.Notes))

				// Verify all returned notes contain the searched tag
				for _, note := range noteList.Notes {
					assert.Contains(suite.T(), note.Tags, tt.tag)
				}
			}
		})
	}
}

// TestGetNotesWithTimestamp tests the GetNotesWithTimestamp method
func (suite *NoteServiceTestSuite) TestGetNotesWithTimestamp() {
	// Create initial note
	request1 := &models.CreateNoteRequest{
		Title:   "Initial Note",
		Content: "Created before timestamp test.",
	}
	_, err := suite.service.CreateNote(suite.userID, request1)
	require.NoError(suite.T(), err)

	// Wait a bit to ensure different timestamp
	time.Sleep(10 * time.Millisecond)

	// Set timestamp
	timestamp := time.Now()

	// Wait a bit more
	time.Sleep(10 * time.Millisecond)

	// Create another note
	request2 := &models.CreateNoteRequest{
		Title:   "Later Note",
		Content: "Created after timestamp test.",
	}
	_, err = suite.service.CreateNote(suite.userID, request2)
	require.NoError(suite.T(), err)

	tests := []struct {
		name      string
		timestamp time.Time
		wantErr   bool
		wantCount int
	}{
		{
			name:      "get notes after timestamp",
			timestamp: timestamp,
			wantErr:   false,
			wantCount: 1, // Only note2 should be returned
		},
		{
			name:      "get notes after very early timestamp",
			timestamp: time.Time{}, // Zero time
			wantErr:   false,
			wantCount: 2, // Both notes should be returned
		},
		{
			name:      "get notes after future timestamp",
			timestamp: time.Now().Add(time.Hour),
			wantErr:   false,
			wantCount: 0, // No notes should be returned
		},
	}

	for _, tt := range tests {
		suite.Run(tt.name, func() {
			notes, err := suite.service.GetNotesWithTimestamp(suite.userID, tt.timestamp)

			if tt.wantErr {
				assert.Error(suite.T(), err)
				assert.Nil(suite.T(), notes)
			} else {
				assert.NoError(suite.T(), err)
				assert.Equal(suite.T(), tt.wantCount, len(notes))

				// Verify all notes are from the correct user
				for _, note := range notes {
					assert.Equal(suite.T(), suite.userID, note.UserID.String())
				}

				// Verify timestamp logic
				for _, note := range notes {
					assert.True(suite.T(), note.UpdatedAt.After(tt.timestamp))
				}
			}
		})
	}
}

// TestBatchCreateNotes tests the BatchCreateNotes method
func (suite *NoteServiceTestSuite) TestBatchCreateNotes() {
	requests := []*models.CreateNoteRequest{
		{
			Title:   "Batch Note 1",
			Content: "First note in batch.",
		},
		{
			Title:   "Batch Note 2",
			Content: "Second note in batch.",
		},
		{
			Content: "Third note in batch without title.",
		},
	}

	// Test successful batch creation
	notes, err := suite.service.BatchCreateNotes(suite.userID, requests)
	assert.NoError(suite.T(), err)
	assert.Equal(suite.T(), 3, len(notes))

	for i, note := range notes {
		assert.Equal(suite.T(), suite.userID, note.UserID.String())
		assert.Equal(suite.T(), 1, note.Version)
		assert.NotZero(suite.T(), note.ID)

		// Verify content
		assert.Equal(suite.T(), requests[i].Content, note.Content)

		// Verify title (auto-generated if not provided)
		if requests[i].Title != "" {
			assert.Equal(suite.T(), requests[i].Title, *note.Title)
		} else {
			assert.NotNil(suite.T(), note.Title)
			assert.NotEmpty(suite.T(), *note.Title)
		}
	}

	// Test batch with invalid request
	invalidRequests := []*models.CreateNoteRequest{
		{
			Title:   "Valid Note",
			Content: "Valid content.",
		},
		{
			Title:   "Invalid Note",
			Content: "", // Empty content should fail
		},
	}

	notes, err = suite.service.BatchCreateNotes(suite.userID, invalidRequests)
	assert.Error(suite.T(), err)
	assert.Nil(suite.T(), notes)
	assert.Contains(suite.T(), err.Error(), "invalid request in batch")
}

// TestBatchUpdateNotes tests the BatchUpdateNotes method
func (suite *NoteServiceTestSuite) TestBatchUpdateNotes() {
	// Create initial notes
	notes := make([]*models.Note, 3)
	for i := 0; i < 3; i++ {
		request := &models.CreateNoteRequest{
			Title:   fmt.Sprintf("Original Note %d", i+1),
			Content: fmt.Sprintf("Original content %d.", i+1),
		}
		note, err := suite.service.CreateNote(suite.userID, request)
		require.NoError(suite.T(), err)
		notes[i] = note
	}

	// Prepare batch update requests
	updateRequests := []struct {
		NoteID  string
		Request *models.UpdateNoteRequest
	}{
		{
			NoteID: notes[0].ID.String(),
			Request: &models.UpdateNoteRequest{
				Title:   func(s string) *string { return &s }("Updated Note 1"),
				Version: func(i int) *int { return &i }(notes[0].Version),
			},
		},
		{
			NoteID: notes[1].ID.String(),
			Request: &models.UpdateNoteRequest{
				Content: func(s string) *string { return &s }("Updated content 2."),
				Version: func(i int) *int { return &i }(notes[1].Version),
			},
		},
		{
			NoteID: notes[2].ID.String(),
			Request: &models.UpdateNoteRequest{
				Title:   func(s string) *string { return &s }("Updated Note 3"),
				Content: func(s string) *string { return &s }("Updated content 3."),
				Version: func(i int) *int { return &i }(notes[2].Version),
			},
		},
	}

	// Test successful batch update
	updatedNotes, err := suite.service.BatchUpdateNotes(suite.userID, updateRequests)
	assert.NoError(suite.T(), err)
	assert.Equal(suite.T(), 3, len(updatedNotes))

	for i, note := range updatedNotes {
		assert.Equal(suite.T(), notes[i].ID, note.ID)
		assert.Greater(suite.T(), note.Version, notes[i].Version)
		assert.Greater(suite.T(), note.UpdatedAt, notes[i].UpdatedAt)

		// Verify specific updates
		if updateRequests[i].Request.Title != nil {
			assert.Equal(suite.T(), *updateRequests[i].Request.Title, *note.Title)
		}
		if updateRequests[i].Request.Content != nil {
			assert.Equal(suite.T(), *updateRequests[i].Request.Content, note.Content)
		}
	}

	// Test batch with version conflict
	conflictRequests := []struct {
		NoteID  string
		Request *models.UpdateNoteRequest
	}{
		{
			NoteID: notes[0].ID.String(),
			Request: &models.UpdateNoteRequest{
				Title:   func(s string) *string { return &s }("Should fail"),
				Version: func(i int) *int { return &i }(1), // Wrong version
			},
		},
	}

	updatedNotes, err = suite.service.BatchUpdateNotes(suite.userID, conflictRequests)
	assert.Error(suite.T(), err)
	assert.Nil(suite.T(), updatedNotes)
	assert.Contains(suite.T(), err.Error(), "version mismatch")
}

// TestIncrementVersion tests the IncrementVersion method
func (suite *NoteServiceTestSuite) TestIncrementVersion() {
	// Create a test note
	request := &models.CreateNoteRequest{
		Title:   "Test Note",
		Content: "Test content for version increment.",
	}
	note, err := suite.service.CreateNote(suite.userID, request)
	require.NoError(suite.T(), err)
	originalVersion := note.Version

	// Increment version
	err = suite.service.IncrementVersion(note.ID.String())
	assert.NoError(suite.T(), err)

	// Verify version was incremented
	updatedNote, err := suite.service.GetNoteByID(suite.userID, note.ID.String())
	assert.NoError(suite.T(), err)
	assert.Equal(suite.T(), originalVersion+1, updatedNote.Version)
}

// TestNoteServiceInterface ensures the service implements the interface
func (suite *NoteServiceTestSuite) TestNoteServiceInterface() {
	var _ NoteServiceInterface = suite.service
}

// setupTestDatabase creates a test database and returns cleanup function
func setupTestDatabase(t *testing.T) (*sql.DB, func()) {
	// For now, create a simple mock that returns nil
	// This will be implemented properly when we have a test database setup
	return nil, func() {}
}

// TestNoteServiceSuite runs the entire test suite
func TestNoteServiceSuite(t *testing.T) {
	suite.Run(t, new(NoteServiceTestSuite))
}

// BenchmarkCreateNote benchmarks the CreateNote method
func BenchmarkCreateNote(b *testing.B) {
	// Skip benchmark for now - will be implemented with proper test DB
	b.Skip("Benchmark skipped - needs test database setup")
}