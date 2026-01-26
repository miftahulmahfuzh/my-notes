package services

import (
	"database/sql"
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

// TagServiceTestSuite contains tests for the tag service methods used by NoteService
// The frontend extracts tags client-side, so we only test backend methods used by NoteService
type TagServiceTestSuite struct {
	suite.Suite
	db        *sql.DB
	service   *TagService
	userID    uuid.UUID
	cleanupDB func()
}

// SetupSuite runs once before all tests
func (suite *TagServiceTestSuite) SetupSuite() {
	if testing.Short() {
		suite.T().Skip("Skipping integration tests in short mode")
	}

	cfg, err := config.LoadConfig("")
	require.NoError(suite.T(), err, "Failed to load config")

	db, err := database.CreateTestDatabase(cfg.Database)
	require.NoError(suite.T(), err, "Failed to create test database")
	suite.db = db

	migrator := database.NewMigrator(db, "../../migrations")
	err = migrator.Up()
	require.NoError(suite.T(), err, "Failed to run migrations")

	suite.service = NewTagService(db)
	suite.userID = uuid.New()
	suite.cleanupDB = func() { db.Close() }

	err = suite.createTestUser()
	require.NoError(suite.T(), err, "Failed to create test user")
}

// TearDownSuite runs once after all tests
func (suite *TagServiceTestSuite) TearDownSuite() {
	if suite.cleanupDB != nil {
		suite.cleanupDB()
	}
}

// SetupTest runs before each test
func (suite *TagServiceTestSuite) SetupTest() {
	suite.cleanupTestData()
}

// createTestUser creates a test user for the tests
func (suite *TagServiceTestSuite) createTestUser() error {
	query := `
		INSERT INTO users (id, google_id, email, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5)
	`
	_, err := suite.db.Exec(query, suite.userID, "google_"+suite.userID.String(),
		"test@example.com", time.Now(), time.Now())
	return err
}

// cleanupTestData cleans up test data between tests
func (suite *TagServiceTestSuite) cleanupTestData() {
	_, err := suite.db.Exec("DELETE FROM notes WHERE user_id = $1", suite.userID)
	if err != nil {
		suite.T().Logf("Warning: Failed to clean up notes: %v", err)
	}
	_, err = suite.db.Exec("DELETE FROM tags WHERE id NOT IN (SELECT DISTINCT tag_id FROM note_tags)")
	if err != nil {
		suite.T().Logf("Warning: Failed to clean up orphaned tags: %v", err)
	}
}

// TestExtractTagsFromContent tests hashtag extraction from text content
// This is used by NoteService when creating/updating notes to extract hashtags
func (suite *TagServiceTestSuite) TestExtractTagsFromContent() {
	tests := []struct {
		name         string
		content      string
		expectedTags []string
	}{
		{
			name:         "no hashtags",
			content:      "This is just regular text without any tags",
			expectedTags: []string{},
		},
		{
			name:         "single hashtag",
			content:      "This note has #work tag",
			expectedTags: []string{"#work"},
		},
		{
			name:         "multiple hashtags",
			content:      "#work and #personal notes for #urgent tasks",
			expectedTags: []string{"#work", "#personal", "#urgent"},
		},
		{
			name:         "duplicate hashtags",
			content:      "#work and #work again",
			expectedTags: []string{"#work"},
		},
		{
			name:         "hashtags with spaces before word",
			content:      "# work and # personal tags",
			expectedTags: []string{"#work", "#personal"},
		},
		{
			name:         "mixed case hashtags",
			content:      "#Work and #PERSONAL tags",
			expectedTags: []string{"#work", "#personal"},
		},
		{
			name:         "special characters in hashtags",
			content:      "#test-tag and #test_tag are valid",
			expectedTags: []string{"#test", "#test_tag"}, // Hyphens not supported by \w regex
		},
	}

	for _, tt := range tests {
		suite.Run(tt.name, func() {
			tags := suite.service.ExtractTagsFromContent(tt.content)
			assert.Equal(suite.T(), tt.expectedTags, tags)
		})
	}
}

// TestProcessTagsForNote tests tag processing and association with notes
// This is used by NoteService when creating notes to associate extracted hashtags
func (suite *TagServiceTestSuite) TestProcessTagsForNote() {
	// Create test tags
	_, err := suite.service.CreateTag(&models.CreateTagRequest{Name: "#tag1"})
	require.NoError(suite.T(), err)
	_, err = suite.service.CreateTag(&models.CreateTagRequest{Name: "#tag2"})
	require.NoError(suite.T(), err)

	tests := []struct {
		name        string
		tags        []string
		expectError bool
	}{
		{
			name:        "process tags with auto-creation",
			tags:        []string{"#tag1", "#newtag"},
			expectError: false,
		},
		{
			name:        "empty tags list",
			tags:        []string{},
			expectError: false,
		},
	}

	for _, tt := range tests {
		suite.Run(tt.name, func() {
			// Create a real note in the database first (required by foreign key constraint)
			noteID := uuid.New()
			_, err := suite.db.Exec(
				"INSERT INTO notes (id, user_id, title, content, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW())",
				noteID, suite.userID, "Test Note", "Test content")
			require.NoError(suite.T(), err)

			err = suite.service.ProcessTagsForNote(noteID.String(), tt.tags)

			if tt.expectError {
				assert.Error(suite.T(), err)
			} else {
				assert.NoError(suite.T(), err)

				// Verify tag associations were created
				if len(tt.tags) > 0 {
					var count int
					err := suite.db.QueryRow("SELECT COUNT(*) FROM note_tags WHERE note_id = $1", noteID.String()).Scan(&count)
					assert.NoError(suite.T(), err)
					assert.Greater(suite.T(), count, 0)
				}
			}
		})
	}
}

// TestUpdateTagsForNote tests updating tags for a note
// This is used by NoteService when updating notes
func (suite *TagServiceTestSuite) TestUpdateTagsForNote() {
	// Create a real note in the database first (required by foreign key constraint)
	noteID := uuid.New()
	_, err := suite.db.Exec(
		"INSERT INTO notes (id, user_id, title, content, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW())",
		noteID, suite.userID, "Test Note", "Test content with #tag1 and #tag2")
	require.NoError(suite.T(), err)

	// Extract and associate initial tags from content
	initialTags := []string{"#tag1", "#tag2"}
	err = suite.service.ProcessTagsForNote(noteID.String(), initialTags)
	require.NoError(suite.T(), err)

	// Update tags
	updatedTags := []string{"#tag1", "#newtag"}
	err = suite.service.UpdateTagsForNote(noteID.String(), updatedTags)
	assert.NoError(suite.T(), err)

	// Verify the tag associations were updated
	var count int
	err = suite.db.QueryRow("SELECT COUNT(*) FROM note_tags WHERE note_id = $1", noteID.String()).Scan(&count)
	assert.NoError(suite.T(), err)
	assert.Equal(suite.T(), 2, count) // #tag1 and #newtag
}

// TestGetTagByName tests retrieving a tag by name
// This is used by NoteService internally for tag operations
func (suite *TagServiceTestSuite) TestGetTagByName() {
	// Create a test tag
	createReq := &models.CreateTagRequest{Name: "#byname"}
	createdTag, err := suite.service.CreateTag(createReq)
	require.NoError(suite.T(), err)

	tests := []struct {
		name        string
		tagName     string
		expectError bool
	}{
		{
			name:        "existing tag",
			tagName:     "#byname",
			expectError: false,
		},
		{
			name:        "non-existent tag",
			tagName:     "#nonexistent",
			expectError: true,
		},
		{
			name:        "case insensitive",
			tagName:     "#BYNAME",
			expectError: false,
		},
	}

	for _, tt := range tests {
		suite.Run(tt.name, func() {
			tag, err := suite.service.GetTagByName(tt.tagName)

			if tt.expectError {
				assert.Error(suite.T(), err)
			} else {
				assert.NoError(suite.T(), err)
				assert.NotNil(suite.T(), tag)
				assert.Equal(suite.T(), createdTag.ID, tag.ID)
			}
		})
	}
}

// TestValidateTagNames tests tag name validation
// This is used by NoteService when adding tags to notes
func (suite *TagServiceTestSuite) TestValidateTagNames() {
	tests := []struct {
		name        string
		tagNames    []string
		expectError bool
	}{
		{
			name:        "valid tags",
			tagNames:    []string{"#work", "#personal", "#urgent"},
			expectError: false,
		},
		{
			name:        "empty tag list",
			tagNames:    []string{},
			expectError: false,
		},
		{
			name:        "invalid tag format",
			tagNames:    []string{"#work", "invalid", "#personal"},
			expectError: true,
		},
		{
			name:        "tag too long",
			tagNames:    []string{"#" + string(make([]byte, 101))},
			expectError: true,
		},
	}

	for _, tt := range tests {
		suite.Run(tt.name, func() {
			err := suite.service.ValidateTagNames(tt.tagNames)

			if tt.expectError {
				assert.Error(suite.T(), err)
			} else {
				assert.NoError(suite.T(), err)
			}
		})
	}
}

// TestTagService runs the complete test suite
func TestTagService(t *testing.T) {
	suite.Run(t, new(TagServiceTestSuite))
}
