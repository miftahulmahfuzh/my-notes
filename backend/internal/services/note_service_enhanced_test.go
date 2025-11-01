package services

import (
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

// EnhancedNoteServiceTestSuite contains all tests for enhanced note service functionality
type EnhancedNoteServiceTestSuite struct {
	suite.Suite
	db          *sql.DB
	noteService *NoteService
	tagService  *TagService
	userID      uuid.UUID
	cleanupDB   func()
}

// SetupSuite runs once before all tests
func (suite *EnhancedNoteServiceTestSuite) SetupSuite() {
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
	suite.userID = uuid.New()

	// Create services
	suite.tagService = NewTagService(db)
	suite.noteService = NewNoteService(db, suite.tagService)

	// Create test user
	err = suite.createTestUser()
	require.NoError(suite.T(), err, "Failed to create test user")
}

// TearDownSuite runs once after all tests
func (suite *EnhancedNoteServiceTestSuite) TearDownSuite() {
	if suite.cleanupDB != nil {
		suite.cleanupDB()
	}
}

// SetupTest runs before each test
func (suite *EnhancedNoteServiceTestSuite) SetupTest() {
	// Clean up any data from previous tests
	suite.cleanupTestData()
}

// createTestUser creates a test user for the tests
func (suite *EnhancedNoteServiceTestSuite) createTestUser() error {
	query := `
		INSERT INTO users (id, google_id, email, name, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6)
	`
	_, err := suite.db.Exec(query, suite.userID, "google_"+suite.userID.String(),
		"test@example.com", "Test User", time.Now(), time.Now())
	return err
}

// cleanupTestData cleans up test data between tests
func (suite *EnhancedNoteServiceTestSuite) cleanupTestData() {
	// Clean up in correct order to respect foreign key constraints
	tables := []string{"note_tags", "notes", "tags"}
	for _, table := range tables {
		_, err := suite.db.Exec(fmt.Sprintf("DELETE FROM %s WHERE id LIKE 'test-%%'", table))
		if err != nil {
			suite.T().Logf("Warning: Failed to clean up table %s: %v", table, err)
		}
	}
}

// TestAutomaticTagExtraction tests automatic tag extraction from note content
func (suite *EnhancedNoteServiceTestSuite) TestAutomaticTagExtraction() {
	tests := []struct {
		name           string
		content        string
		expectedTags   []string
		expectNoteTags int
	}{
		{
			name:           "note with single hashtag",
			content:        "Meeting notes #work",
			expectedTags:   []string{"#work"},
			expectNoteTags: 1,
		},
		{
			name:           "note with multiple hashtags",
			content:        "#work and #personal notes for #urgent tasks",
			expectedTags:   []string{"#work", "#personal", "#urgent"},
			expectNoteTags: 3,
		},
		{
			name:           "note with duplicate hashtags",
			content:        "#work and #work again",
			expectedTags:   []string{"#work"},
			expectNoteTags: 1,
		},
		{
			name:           "note without hashtags",
			content:        "Just regular text without any tags",
			expectedTags:   []string{},
			expectNoteTags: 0,
		},
		{
			name:           "note with special characters in hashtags",
			content:        "Tasks for #test-tag and #test_tag",
			expectedTags:   []string{"#test-tag", "#test_tag"},
			expectNoteTags: 2,
		},
	}

	for _, tt := range tests {
		suite.Run(tt.name, func() {
			// Create note with tag extraction
			request := &models.CreateNoteRequest{
				Content: tt.content,
				Title:   "Test Note",
			}

			note, err := suite.noteService.CreateNote(suite.userID.String(), request)
			require.NoError(suite.T(), err)
			require.NotNil(suite.T(), note)

			// Verify note was created
			assert.NotEmpty(suite.T(), note.ID)
			assert.Equal(suite.T(), tt.content, note.Content)

			// Verify tags were extracted and created
			if len(tt.expectedTags) > 0 {
				for _, expectedTag := range tt.expectedTags {
					tag, err := suite.tagService.GetTagByName(expectedTag)
					assert.NoError(suite.T(), err, "Tag %s should have been created", expectedTag)
					assert.NotNil(suite.T(), tag)
				}
			}

			// Verify note-tag associations were created
			var count int
			err = suite.db.QueryRow("SELECT COUNT(*) FROM note_tags WHERE note_id = $1", note.ID).Scan(&count)
			assert.NoError(suite.T(), err)
			assert.Equal(suite.T(), tt.expectNoteTags, count)
		})
	}
}

// TestAddTagsToNote tests adding tags to existing notes
func (suite *EnhancedNoteServiceTestSuite) TestAddTagsToNote() {
	// Create a note first
	request := &models.CreateNoteRequest{
		Content: "Original note content",
		Title:   "Original Note",
	}
	note, err := suite.noteService.CreateNote(suite.userID.String(), request)
	require.NoError(suite.T(), err)

	tests := []struct {
		name        string
		tagNames    []string
		expectError bool
	}{
		{
			name:        "add new tags to note",
			tagNames:    []string{"#work", "#urgent"},
			expectError: false,
		},
		{
			name:        "add tags with auto-creation",
			tagNames:    []string{"#existing", "#newtag"},
			expectError: false,
		},
		{
			name:        "add empty tag list",
			tagNames:    []string{},
			expectError: false,
		},
		{
			name:        "add invalid tag names",
			tagNames:    []string{"#valid", "invalid"},
			expectError: true,
		},
	}

	for _, tt := range tests {
		suite.Run(tt.name, func() {
			// Pre-create existing tag if needed
			if contains(tt.tagNames, "#existing") {
				_, err := suite.tagService.CreateTag(&models.CreateTagRequest{Name: "#existing"})
				require.NoError(suite.T(), err)
			}

			err := suite.noteService.AddTagsToNote(suite.userID.String(), note.ID.String(), tt.tagNames)

			if tt.expectError {
				assert.Error(suite.T(), err)
			} else {
				assert.NoError(suite.T(), err)

				// Verify tag associations
				if len(tt.tagNames) > 0 {
					var count int
					err := suite.db.QueryRow("SELECT COUNT(*) FROM note_tags WHERE note_id = $1", note.ID).Scan(&count)
					assert.NoError(suite.T(), err)
					assert.Greater(suite.T(), count, 0)
				}
			}
		})
	}
}

// TestRemoveTagsFromNote tests removing tags from notes
func (suite *EnhancedNoteServiceTestSuite) TestRemoveTagsFromNote() {
	// Create a note with tags
	request := &models.CreateNoteRequest{
		Content: "Note with #work and #personal tags",
		Title:   "Test Note",
	}
	note, err := suite.noteService.CreateNote(suite.userID.String(), request)
	require.NoError(suite.T(), err)

	// Add an additional tag
	err = suite.noteService.AddTagsToNote(suite.userID.String(), note.ID.String(), []string{"#extra"})
	require.NoError(suite.T(), err)

	tests := []struct {
		name        string
		tagNames    []string
		expectError bool
	}{
		{
			name:        "remove existing tags",
			tagNames:    []string{"#work", "#personal"},
			expectError: false,
		},
		{
			name:        "remove non-existent tags",
			tagNames:    []string{"#nonexistent"},
			expectError: false, // Should not error, just no effect
		},
		{
			name:        "remove empty tag list",
			tagNames:    []string{},
			expectError: false,
		},
	}

	for _, tt := range tests {
		suite.Run(tt.name, func() {
			// Count associations before removal
			var beforeCount int
			err := suite.db.QueryRow("SELECT COUNT(*) FROM note_tags WHERE note_id = $1", note.ID).Scan(&beforeCount)
			require.NoError(suite.T(), err)

			err = suite.noteService.RemoveTagsFromNote(suite.userID.String(), note.ID.String(), tt.tagNames)

			if tt.expectError {
				assert.Error(suite.T(), err)
			} else {
				assert.NoError(suite.T(), err)

				// Verify tag associations were removed
				var afterCount int
				err := suite.db.QueryRow("SELECT COUNT(*) FROM note_tags WHERE note_id = $1", note.ID).Scan(&afterCount)
				assert.NoError(suite.T(), err)

				// Should have fewer associations (unless removing non-existent tags)
				if contains(tt.tagNames, "#work") || contains(tt.tagNames, "#personal") {
					assert.Less(suite.T(), afterCount, beforeCount)
				}
			}
		})
	}
}

// TestUpdateTagsForNote tests updating all tags for a note
func (suite *EnhancedNoteServiceTestSuite) TestUpdateTagsForNote() {
	// Create a note with initial tags
	request := &models.CreateNoteRequest{
		Content: "Note with #initial tags",
		Title:   "Test Note",
	}
	note, err := suite.noteService.CreateNote(suite.userID.String(), request)
	require.NoError(suite.T(), err)

	// Add another tag to have some initial associations
	err = suite.noteService.AddTagsToNote(suite.userID.String(), note.ID.String(), []string{"#extra"})
	require.NoError(suite.T(), err)

	tests := []struct {
		name        string
		newTags     []string
		expectError bool
	}{
		{
			name:        "replace tags with new set",
			newTags:     []string{"#work", "#urgent", "#project"},
			expectError: false,
		},
		{
			name:        "replace with empty tags",
			newTags:     []string{},
			expectError: false,
		},
		{
			name:        "replace with same tags",
			newTags:     []string{"#initial", "#extra"},
			expectError: false,
		},
	}

	for _, tt := range tests {
		suite.Run(tt.name, func() {
			err := suite.tagService.UpdateTagsForNote(note.ID.String(), tt.newTags)

			if tt.expectError {
				assert.Error(suite.T(), err)
			} else {
				assert.NoError(suite.T(), err)

				// Verify tag associations were updated
				var count int
				err := suite.db.QueryRow("SELECT COUNT(*) FROM note_tags WHERE note_id = $1", note.ID).Scan(&count)
				assert.NoError(suite.T(), err)
				assert.Equal(suite.T(), len(tt.newTags), count)

				// Verify correct tags are associated
				if len(tt.newTags) > 0 {
					for _, tagName := range tt.newTags {
						tag, err := suite.tagService.GetTagByName(tagName)
						assert.NoError(suite.T(), err, "Tag %s should exist", tagName)
						if err == nil {
							var associationCount int
							err := suite.db.QueryRow(
								"SELECT COUNT(*) FROM note_tags WHERE note_id = $1 AND tag_id = $2",
								note.ID, tag.ID,
							).Scan(&associationCount)
							assert.NoError(suite.T(), err)
							assert.Equal(suite.T(), 1, associationCount)
						}
					}
				}
			}
		})
	}
}

// TestGetNotesByTags tests filtering notes by tags
func (suite *EnhancedNoteServiceTestSuite) TestGetNotesByTags() {
	// Create test notes with different tags
	notes := []struct {
		content string
		tags    []string
	}{
		{"Work task #work #urgent", []string{"#work", "#urgent"}},
		{"Personal reminder #personal", []string{"#personal"}},
		{"Project update #work #project", []string{"#work", "#project"}},
		{"Meeting notes #meeting #work", []string{"#meeting", "#work"}},
	}

	var noteIDs []string
	for _, noteData := range notes {
		request := &models.CreateNoteRequest{
			Content: noteData.content,
			Title:   "Test Note",
		}
		note, err := suite.noteService.CreateNote(suite.userID.String(), request)
		require.NoError(suite.T(), err)
		noteIDs = append(noteIDs, note.ID.String())
	}

	tests := []struct {
		name           string
		tagNames       []string
		operator       string
		expectedCount  int
		expectError    bool
	}{
		{
			name:          "single tag filter",
			tagNames:      []string{"#work"},
			operator:      "and",
			expectedCount: 3, // work, urgent, project, meeting
			expectError:   false,
		},
		{
			name:          "multiple tags AND",
			tagNames:      []string{"#work", "#urgent"},
			operator:      "and",
			expectedCount: 1, // Only the first note has both work and urgent
			expectError:   false,
		},
		{
			name:          "multiple tags OR",
			tagNames:      []string{"#urgent", "#project"},
			operator:      "or",
			expectedCount: 2, // First and third notes
			expectError:   false,
		},
		{
			name:          "tag with no matches",
			tagNames:      []string{"#nonexistent"},
			operator:      "and",
			expectedCount: 0,
			expectError:   false,
		},
		{
			name:          "invalid operator",
			tagNames:      []string{"#work"},
			operator:      "invalid",
			expectedCount: 0,
			expectError:   true,
		},
	}

	for _, tt := range tests {
		suite.Run(tt.name, func() {
			result, err := suite.noteService.GetNotesByTags(suite.userID.String(), tt.tagNames, tt.operator, 10, 0)

			if tt.expectError {
				assert.Error(suite.T(), err)
				assert.Nil(suite.T(), result)
			} else {
				assert.NoError(suite.T(), err)
				assert.NotNil(suite.T(), result)
				assert.Equal(suite.T(), tt.expectedCount, len(result.Notes))
			}
		})
	}
}

// TestGetNotesByAnyTag tests filtering notes by any tag (OR logic)
func (suite *EnhancedNoteServiceTestSuite) TestGetNotesByAnyTag() {
	// Create test notes
	notes := []struct {
		content string
		tags    []string
	}{
		{"Work task #work", []string{"#work"}},
		{"Personal reminder #personal", []string{"#personal"}},
		{"Another work task #work", []string{"#work"}},
	}

	for _, noteData := range notes {
		request := &models.CreateNoteRequest{
			Content: noteData.content,
			Title:   "Test Note",
		}
		_, err := suite.noteService.CreateNote(suite.userID.String(), request)
		require.NoError(suite.T(), err)
	}

	result, err := suite.noteService.GetNotesByAnyTag(suite.userID.String(), []string{"#work", "#personal"}, 10, 0)
	assert.NoError(suite.T(), err)
	assert.NotNil(suite.T(), result)
	assert.Equal(suite.T(), 3, len(result.Notes)) // All notes should match
}

// TestGetNotesByAllTags tests filtering notes by all tags (AND logic)
func (suite *EnhancedNoteServiceTestSuite) TestGetNotesByAllTags() {
	// Create test notes
	notes := []struct {
		content string
		tags    []string
	}{
		{"Work and urgent #work #urgent", []string{"#work", "#urgent"}},
		{"Just work #work", []string{"#work"}},
		{"Just urgent #urgent", []string{"#urgent"}},
		{"Work urgent project #work #urgent #project", []string{"#work", "#urgent", "#project"}},
	}

	for _, noteData := range notes {
		request := &models.CreateNoteRequest{
			Content: noteData.content,
			Title:   "Test Note",
		}
		_, err := suite.noteService.CreateNote(suite.userID.String(), request)
		require.NoError(suite.T(), err)
	}

	result, err := suite.noteService.GetNotesByAllTags(suite.userID.String(), []string{"#work", "#urgent"}, 10, 0)
	assert.NoError(suite.T(), err)
	assert.NotNil(suite.T(), result)
	assert.Equal(suite.T(), 2, len(result.Notes)) // Only notes with both work and urgent
}

// TestBatchTagOperations tests batch operations on multiple notes
func (suite *EnhancedNoteServiceTestSuite) TestBatchTagOperations() {
	// Create multiple notes
	var noteIDs []string
	for i := 0; i < 3; i++ {
		request := &models.CreateNoteRequest{
			Content: fmt.Sprintf("Note %d content", i+1),
			Title:   fmt.Sprintf("Note %d", i+1),
		}
		note, err := suite.noteService.CreateNote(suite.userID.String(), request)
		require.NoError(suite.T(), err)
		noteIDs = append(noteIDs, note.ID.String())
	}

	// Test batch add tags
	err := suite.noteService.BatchAddTagsToNotes(suite.userID.String(), noteIDs, []string{"#batch", "#test"})
	assert.NoError(suite.T(), err)

	// Verify tags were added to all notes
	for _, noteID := range noteIDs {
		var count int
		err := suite.db.QueryRow("SELECT COUNT(*) FROM note_tags WHERE note_id = $1", noteID).Scan(&count)
		assert.NoError(suite.T(), err)
		assert.Equal(suite.T(), 2, count) // Should have both #batch and #test
	}

	// Test batch remove tags
	err = suite.noteService.BatchRemoveTagsFromNotes(suite.userID.String(), noteIDs, []string{"#test"})
	assert.NoError(suite.T(), err)

	// Verify tags were removed from all notes
	for _, noteID := range noteIDs {
		var count int
		err := suite.db.QueryRow("SELECT COUNT(*) FROM note_tags WHERE note_id = $1", noteID).Scan(&count)
		assert.NoError(suite.T(), err)
		assert.Equal(suite.T(), 1, count) // Should only have #batch remaining
	}
}

// TestGetTagUsageStats tests tag usage statistics
func (suite *EnhancedNoteServiceTestSuite) TestGetTagUsageStats() {
	// Create notes with different tag frequencies
	notes := []struct {
		content string
		tags    []string
	}{
		{"Work task 1 #work", []string{"#work"}},
		{"Work task 2 #work", []string{"#work"}},
		{"Personal note #personal", []string{"#personal"}},
		{"Another work task #work", []string{"#work"}},
		{"Urgent task #urgent", []string{"#urgent"}},
	}

	for _, noteData := range notes {
		request := &models.CreateNoteRequest{
			Content: noteData.content,
			Title:   "Test Note",
		}
		_, err := suite.noteService.CreateNote(suite.userID.String(), request)
		require.NoError(suite.T(), err)
	}

	stats, err := suite.noteService.GetTagUsageStats(suite.userID.String())
	assert.NoError(suite.T(), err)
	assert.NotNil(suite.T(), stats)

	// Verify statistics
	assert.Equal(suite.T(), 3, stats["#work"])    // Used 3 times
	assert.Equal(suite.T(), 1, stats["#personal"]) // Used 1 time
	assert.Equal(suite.T(), 1, stats["#urgent"])   // Used 1 time
}

// TestTagConsistencyOnNoteDeletion tests that tag associations are cleaned up when notes are deleted
func (suite *EnhancedNoteServiceTestSuite) TestTagConsistencyOnNoteDeletion() {
	// Create a note with tags
	request := &models.CreateNoteRequest{
		Content: "Note to be deleted #work #personal",
		Title:   "Temporary Note",
	}
	note, err := suite.noteService.CreateNote(suite.userID.String(), request)
	require.NoError(suite.T(), err)

	// Verify tag associations exist
	var beforeCount int
	err = suite.db.QueryRow("SELECT COUNT(*) FROM note_tags WHERE note_id = $1", note.ID).Scan(&beforeCount)
	assert.NoError(suite.T(), err)
	assert.Greater(suite.T(), beforeCount, 0)

	// Delete the note
	err = suite.noteService.DeleteNote(suite.userID.String(), note.ID.String())
	assert.NoError(suite.T(), err)

	// Verify tag associations were cleaned up
	var afterCount int
	err = suite.db.QueryRow("SELECT COUNT(*) FROM note_tags WHERE note_id = $1", note.ID).Scan(&afterCount)
	assert.NoError(suite.T(), err)
	assert.Equal(suite.T(), 0, afterCount)
}

// TestComplexTagFiltering tests complex filtering scenarios
func (suite *EnhancedNoteServiceTestSuite) TestComplexTagFiltering() {
	// Create a complex set of notes
	scenarios := []struct {
		content string
	}{
		{"Project A meeting #projectA #meeting #urgent"},
		{"Project A task #projectA #task"},
		{"Project B planning #projectB #planning"},
		{"Urgent bug fix #urgent #bug"},
		{"Team meeting #meeting #team"},
		{"Project A review #projectA #review"},
	}

	for _, scenario := range scenarios {
		request := &models.CreateNoteRequest{
			Content: scenario.content,
			Title:   "Complex Note",
		}
		_, err := suite.noteService.CreateNote(suite.userID.String(), request)
		require.NoError(suite.T(), err)
	}

	// Test complex filtering combinations
	testCases := []struct {
		name          string
		tags          []string
		operator      string
		expectedMin   int
		expectedMax   int
	}{
		{
			name:        "Project A notes",
			tags:        []string{"#projectA"},
			operator:    "and",
			expectedMin: 3,
			expectedMax: 3,
		},
		{
			name:        "Urgent AND meeting",
			tags:        []string{"#urgent", "#meeting"},
			operator:    "and",
			expectedMin: 1,
			expectedMax: 1,
		},
		{
			name:        "Meeting OR urgent",
			tags:        []string{"#meeting", "#urgent"},
			operator:    "or",
			expectedMin: 3,
			expectedMax: 4, // Could overlap
		},
	}

	for _, tc := range testCases {
		suite.Run(tc.name, func() {
			result, err := suite.noteService.GetNotesByTags(suite.userID.String(), tc.tags, tc.operator, 10, 0)
			assert.NoError(suite.T(), err)
			assert.NotNil(suite.T(), result)
			assert.GreaterOrEqual(suite.T(), len(result.Notes), tc.expectedMin)
			assert.LessOrEqual(suite.T(), len(result.Notes), tc.expectedMax)
		})
	}
}

// Helper functions
func strPtr(s string) *string {
	return &s
}

func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}

// TestEnhancedNoteService runs the complete enhanced test suite
func TestEnhancedNoteService(t *testing.T) {
	suite.Run(t, new(EnhancedNoteServiceTestSuite))
}