package services

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/gpd/my-notes/internal/config"
	"github.com/gpd/my-notes/internal/database"
	"github.com/gpd/my-notes/internal/llm"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestPrettifyOnContentWithHashtag verifies that hashtags in content are preserved
// To run:
// cd backend
// USE_LLM_DURING_TEST=true USE_POSTGRE_DURING_TEST=true go clean -testcache && go test ./internal/services/... -run TestPrettifyOnContentWithHashtag -v
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

// TestPrettifyOnContentWithURL verifies that URLs in content are preserved
// To run:
// cd backend
// USE_LLM_DURING_TEST=true USE_POSTGRE_DURING_TEST=true go clean -testcache && go test ./internal/services/... -run TestPrettifyOnContentWithURL -v
func TestPrettifyOnContentWithURL(t *testing.T) {
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

	// Create note with content containing URL
	inputContent := `TODO 12/11/2025
https://wiki.tuntun.co.id/display/AD/%5BTool-S-002%5D%5BV2%5DTuntun+Guidance+Conclusion+Tool

add "value conclusion"
add "trading conclusion"
remove "median fair value"

#todo
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

	// Extract URL from input using regex
	urlRegex := regexp.MustCompile(`https?://[^\s]+`)
	inputURLs := urlRegex.FindAllString(inputContent, -1)
	require.NotEmpty(t, inputURLs, "Input should contain at least one URL")

	// Verify each URL from input is preserved in output
	outputContent := response.NoteResponse.Content

	for _, inputURL := range inputURLs {
		assert.Contains(t, outputContent, inputURL,
			"Output content should preserve URL: %s\nInput: %s\nOutput: %s", inputURL, inputContent, outputContent)
	}

	// Verify #todo hashtag is also preserved
	assert.Contains(t, response.NoteResponse.Tags, "#todo",
		"Response tags should contain #todo")
}

// TestPrettifyOnContentWithJSON verifies that JSON is prettified with proper indentation
// To run:
// cd backend
// USE_LLM_DURING_TEST=true USE_POSTGRE_DURING_TEST=true go clean -testcache && go test ./internal/services/... -run TestPrettifyOnContentWithJSON -v
func TestPrettifyOnContentWithJSON(t *testing.T) {
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

	// Create note with valid JSON content (single line)
	inputContent := `429 {"type":"error","error":{"type":"1308","message":"Usage limit reached for 5 hour. Your limit will reset at 2025-11-10 15:47:02"},"request_id":"20251110131106ad01ca8eb00144df"}`

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

	// Print the prettified output for visual inspection
	outputContent := response.NoteResponse.Content
	t.Logf("\n=== LLM Prettified JSON Output ===\n%s\n=== End Output ===\n", outputContent)

	// Extract JSON from output (may be preceded by "429" or other text)
	jsonStart := strings.Index(outputContent, "{")
	jsonEnd := strings.LastIndex(outputContent, "}")
	require.NotEqual(t, -1, jsonStart, "Output should contain opening brace")
	require.NotEqual(t, -1, jsonEnd, "Output should contain closing brace")

	jsonStr := outputContent[jsonStart : jsonEnd+1]

	// Verify the extracted string is valid JSON
	var parsedJSON map[string]interface{}
	err = json.Unmarshal([]byte(jsonStr), &parsedJSON)
	require.NoError(t, err, "Output should contain valid JSON")

	// Verify key fields are preserved
	assert.Contains(t, parsedJSON, "type", "JSON should contain 'type' field")
	assert.Contains(t, parsedJSON, "error", "JSON should contain 'error' field")
	assert.Contains(t, parsedJSON, "request_id", "JSON should contain 'request_id' field")

	// Verify the JSON is prettified (has newlines and indentation)
	assert.True(t, strings.Contains(jsonStr, "\n"), "Prettified JSON should contain newlines")
	assert.Contains(t, jsonStr, "  ", "Prettified JSON should contain indentation")

	// Verify specific values are preserved
	assert.Equal(t, "error", parsedJSON["type"], "type field should be preserved")
}

// TestPrettifyOnContentWithBrokenJSON verifies that broken JSON is repaired
// To run:
// cd backend
// USE_LLM_DURING_TEST=true USE_POSTGRE_DURING_TEST=true go clean -testcache && go test ./internal/services/... -run TestPrettifyOnContentWithBrokenJSON -v
func TestPrettifyOnContentWithBrokenJSON(t *testing.T) {
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

	// Define broken JSON scenarios
	brokenJSONScenarios := []struct {
		name        string
		input       string
		description string
	}{
		{
			name:        "Missing closing brace",
			input:       `Here is some broken JSON: {"type":"error","message":"Usage limit reached for API requests per hour"`,
			description: "A: Missing closing brace",
		},
		{
			name:        "Missing comma between fields",
			input:       `Here is some broken JSON: {"type":"error" "message":"Usage limit reached for API requests"}`,
			description: "B: Missing comma between fields",
		},
		{
			name:        "Trailing comma",
			input:       `Here is some broken JSON: {"type":"error","message":"Usage limit reached for API requests",}`,
			description: "C: Trailing comma",
		},
		{
			name:        "Unquoted keys",
			input:       `Here is some broken JSON: {type:"error",message:"Usage limit reached for API requests"}`,
			description: "D: Unquoted keys",
		},
		{
			name:        "Missing quotes on string values",
			input:       `Here is some broken JSON: {"type":error,"message":Usage limit reached}`,
			description: "E: Missing quotes on string values",
		},
	}

	for _, scenario := range brokenJSONScenarios {
		t.Run(scenario.name, func(t *testing.T) {
			// Create note with broken JSON
			noteID := uuid.New()
			noteQuery := `
				INSERT INTO notes (id, user_id, title, content, created_at, updated_at, version)
				VALUES ($1, $2, $3, $4, NOW(), NOW(), 1)
			`
			_, err := db.ExecContext(context.Background(), noteQuery, noteID, userID, "Broken JSON Test", scenario.input)
			require.NoError(t, err, "Failed to create test note")

			// Setup services
			llmClient, err := llm.NewResilientLLM(context.Background(), cfg, nil)
			require.NoError(t, err, "Failed to create LLM client")

			tagService := NewTagService(db)
			noteService := NewNoteService(db, tagService)
			prettifyService := NewPrettifyService(llmClient, noteService, tagService, db)

			// Call PrettifyNote
			response, err := prettifyService.PrettifyNote(context.Background(), userID, noteID.String())
			require.NoError(t, err, "PrettifyNote should succeed for %s", scenario.description)
			require.NotNil(t, response)

			// Extract JSON from output
			outputContent := response.NoteResponse.Content
			jsonStart := strings.Index(outputContent, "{")
			jsonEnd := strings.LastIndex(outputContent, "}")
			require.NotEqual(t, -1, jsonStart, "Output should contain opening brace for %s", scenario.description)
			require.NotEqual(t, -1, jsonEnd, "Output should contain closing brace for %s", scenario.description)

			jsonStr := outputContent[jsonStart : jsonEnd+1]

			// Verify the extracted string is valid JSON (i.e., it was repaired)
			var parsedJSON map[string]interface{}
			err = json.Unmarshal([]byte(jsonStr), &parsedJSON)
			require.NoError(t, err, "Output should contain valid JSON for %s", scenario.description)

			t.Logf("Scenario %s: Successfully repaired broken JSON", scenario.description)
		})
	}
}

// TestPrettifyOnContentWithGolangStruct verifies that Go structs are only indented (content preserved)
// To run:
// cd backend
// USE_LLM_DURING_TEST=true USE_POSTGRE_DURING_TEST=true go clean -testcache && go test ./internal/services/... -run TestPrettifyOnContentWithGolangStruct -v
func TestPrettifyOnContentWithGolangStruct(t *testing.T) {
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

	// Create note with Golang struct content (poorly indented)
	inputContent := `
Which Indonesian airlines or aviation companies are recovering the fastest after the pandemic?

// PipelineStep represents a single step in the pipeline
type PipelineStep struct {
ID string ` + "`" + `json:"id"` + "`" + ` // Unique step identifier (e.g., "step_1")
Type string ` + "`" + `json:"type"` + "`" + ` // "tool_call", "llm_decision"
Description string ` + "`" + `json:"description"` + "`" + ` // Human-readable description
ExecutionMode string ` + "`" + `json:"execution_mode,omitempty"` + "`" + ` // "single", "parallel", "map"
Tools []ToolSpec ` + "`" + `json:"tools,omitempty"` + "`" + ` // Tools to execute
IsDirectStream bool ` + "`" + `json:"is_direct_stream,omitempty"` + "`" + ` // If true, streams to user directly
AggregationMode bool ` + "`" + `json:"aggregation_mode,omitempty"` + "`" + ` // If true, this step aggregates outputs for external synthesis
MapSource *MapSourceConfig ` + "`" + `json:"map_source,omitempty"` + "`" + ` // For map execution mode
Context map[string]interface{} ` + "`" + `json:"context,omitempty"` + "`" + ` // Input data from previous steps
OutputBinding string ` + "`" + `json:"output_binding"` + "`" + ` // Variable name for output
RetryLimit int ` + "`" + `json:"retry_limit"` + "`" + ` // Max retry attempts
ParallelLimit int ` + "`" + `json:"parallel_limit,omitempty"` + "`" + ` // For map mode concurrency
EnableParallelMap bool ` + "`" + `json:"enable_parallel_map,omitempty"` + "`" + ` // NEW: Enable multi-tool map execution
}
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

	// Print the prettified output for visual inspection
	outputContent := response.NoteResponse.Content
	t.Logf("\n=== LLM Prettified Struct Output ===\n%s\n=== End Output ===\n", outputContent)

	// Verify key struct elements are preserved (not changed)
	assert.Contains(t, outputContent, "type PipelineStep struct", "Struct declaration should be preserved")
	assert.Contains(t, outputContent, "json:\"id\"", "Field tags should be preserved")
	assert.Contains(t, outputContent, "json:\"type\"", "Field tags should be preserved")
	assert.Contains(t, outputContent, "json:\"output_binding\"", "Field tags should be preserved")
	assert.Contains(t, outputContent, "// Unique step identifier", "Comments should be preserved")
	assert.Contains(t, outputContent, "EnableParallelMap bool", "Field names and types should be preserved")

	// Verify it's been indented (should have tabs or spaces at start of lines)
	lines := strings.Split(outputContent, "\n")
	hasIndentation := false
	for _, line := range lines {
		if strings.HasPrefix(line, "\t") || strings.HasPrefix(line, "  ") {
			hasIndentation = true
			break
		}
	}
	assert.True(t, hasIndentation, "Prettified struct should have proper indentation")
}

// TestPrettifyOnContentWithBrokenGolangStruct verifies that broken Go structs are repaired
// To run:
// cd backend
// USE_LLM_DURING_TEST=true USE_POSTGRE_DURING_TEST=true go clean -testcache && go test ./internal/services/... -run TestPrettifyOnContentWithBrokenGolangStruct -v
func TestPrettifyOnContentWithBrokenGolangStruct(t *testing.T) {
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

	// Define broken Golang struct scenarios
	brokenStructScenarios := []struct {
		name        string
		input       string
		description string
	}{
		{
			name:        "Missing closing brace",
			input:       `Here is a broken struct: type Test struct { ID string Name int`,
			description: "A: Missing closing brace",
		},
		{
			name:        "Missing field types",
			input:       `Here is a broken struct: type Test struct { ID Name string }`,
			description: "B: Missing field types",
		},
		{
			name:        "Malformed struct tags",
			input:       `Here is a broken struct: type Test struct { ID string json:"id" Name int }`,
			description: "C: Malformed struct tags",
		},
		{
			name:        "Missing commas between fields",
			input:       `Here is a broken struct: type Test struct { ID string Name int }`,
			description: "D: Missing commas between fields",
		},
	}

	for _, scenario := range brokenStructScenarios {
		t.Run(scenario.name, func(t *testing.T) {
			// Create note with broken struct
			noteID := uuid.New()
			noteQuery := `
				INSERT INTO notes (id, user_id, title, content, created_at, updated_at, version)
				VALUES ($1, $2, $3, $4, NOW(), NOW(), 1)
			`
			_, err := db.ExecContext(context.Background(), noteQuery, noteID, userID, "Broken Struct Test", scenario.input)
			require.NoError(t, err, "Failed to create test note")

			// Setup services
			llmClient, err := llm.NewResilientLLM(context.Background(), cfg, nil)
			require.NoError(t, err, "Failed to create LLM client")

			tagService := NewTagService(db)
			noteService := NewNoteService(db, tagService)
			prettifyService := NewPrettifyService(llmClient, noteService, tagService, db)

			// Call PrettifyNote
			response, err := prettifyService.PrettifyNote(context.Background(), userID, noteID.String())
			require.NoError(t, err, "PrettifyNote should succeed for %s", scenario.description)
			require.NotNil(t, response)

			// Verify the output contains struct-like content
			outputContent := response.NoteResponse.Content

			// Basic check: output should contain "type" and "struct"
			assert.Contains(t, outputContent, "type", "Output should contain 'type' keyword for %s", scenario.description)
			assert.Contains(t, outputContent, "struct", "Output should contain 'struct' keyword for %s", scenario.description)

			// Check for proper struct syntax (should have opening and closing braces)
			openBrace := strings.Contains(outputContent, "{")
			closeBrace := strings.Contains(outputContent, "}")
			assert.True(t, openBrace, "Output should contain opening brace for %s", scenario.description)
			assert.True(t, closeBrace, "Output should contain closing brace for %s", scenario.description)

			t.Logf("Scenario %s: Struct prettified", scenario.description)
		})
	}
}
