package services

import (
	"context"
	"fmt"
	"strings"
	"testing"

	"github.com/gpd/my-notes/internal/config"
	"github.com/gpd/my-notes/internal/database"
	"github.com/gpd/my-notes/internal/llm"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestPrettifyOnContentWithHashtag verifies that hashtags in content are preserved
func TestPrettifyOnContentWithHashtag(t *testing.T) {
	if !config.UseLLMDuringTest() {
		t.Skip("LLM tests are disabled. Set USE_LLM_DURING_TEST=true to enable.")
	}

	// Load configuration
	cfg, err := config.LoadConfig("")
	require.NoError(t, err, "Failed to load config")

	// Use test database config for creating test database
	testDBConfig := config.GetTestDatabaseConfig()

	// Create test database
	db, err := database.CreateTestDatabase(testDBConfig)
	require.NoError(t, err, "Failed to create test database")
	defer database.DropTestDatabase(db)

	// Run migrations
	migrator := database.NewMigrator(db, "../../migrations")
	err = migrator.Up()
	require.NoError(t, err, "Failed to run migrations")

	// Create test user
	userID := uuid.New().String()
	googleID := fmt.Sprintf("google_%s", userID)
	userQuery := `
		INSERT INTO users (id, google_id, email, created_at, updated_at)
		VALUES ($1, $2, $3, NOW(), NOW())
	`
	_, err = db.ExecContext(context.Background(), userQuery, userID, googleID, "prettify@example.com")
	require.NoError(t, err, "Failed to create test user")

	// Create note with content containing #todos hashtag
	inputContent := `- update run_migration.sh and its dependencies to migrate all these:
chat_logs
portfolio_access_permission
research_report
sessions
#todos
`

	noteID := uuid.New()
	noteQuery := `
		INSERT INTO notes (id, user_id, title, content, created_at, updated_at, version)
		VALUES ($1, $2, $3, $4, NOW(), NOW(), 1)
	`
	_, err = db.ExecContext(context.Background(), noteQuery, noteID, userID, "Test Note", inputContent)
	require.NoError(t, err, "Failed to create test note")

	// Setup services
	llmClient, err := llm.NewResilientLLM(context.Background(), cfg, nil)
	require.NoError(t, err, "Failed to create LLM client")

	tagService := NewTagService(db)
	noteService := NewNoteService(db, tagService)
	prettifyService := NewPrettifyService(llmClient, noteService, tagService, db)

	// Call PrettifyNote
	response, err := prettifyService.PrettifyNote(context.Background(), userID, noteID.String())
	require.NoError(t, err)
	require.NotNil(t, response)

	// Verify #todos hashtag is preserved in the content
	outputContent := response.NoteResponse.Content
	assert.True(t, strings.Contains(outputContent, "#todos"),
		"Output content should contain #todos hashtag.\nInput: %s\nOutput: %s", inputContent, outputContent)

	// Also verify tags are in the database
	assert.Contains(t, response.NoteResponse.Tags, "#todos",
		"Response tags should contain #todos")
}
