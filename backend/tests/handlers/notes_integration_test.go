package handlers

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strconv"
	"testing"

	"github.com/gpd/my-notes/internal/config"
	"github.com/gpd/my-notes/internal/database"
	"github.com/gpd/my-notes/internal/handlers"
	"github.com/gpd/my-notes/internal/models"
	"github.com/gpd/my-notes/internal/services"
	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"

	_ "github.com/lib/pq"
)

// NotesIntegrationTestSuite tests the notes API endpoints
type NotesIntegrationTestSuite struct {
	suite.Suite
	db          *sql.DB
	router      *mux.Router
	noteHandler *handlers.NotesHandler
	userID      uuid.UUID
	userEmail   string
	authToken   string
}

func (suite *NotesIntegrationTestSuite) SetupSuite() {
	// Check if PostgreSQL tests are enabled
	if os.Getenv("USE_POSTGRE_DURING_TEST") != "true" {
		suite.T().Skip("PostgreSQL tests are disabled. Set USE_POSTGRE_DURING_TEST=true to enable.")
	}

	// Load configuration
	cfg, err := config.LoadConfig("")
	require.NoError(suite.T(), err, "Failed to load config")

	// Create test database
	db, err := database.CreateTestDatabase(cfg.Database)
	require.NoError(suite.T(), err, "Failed to create test database")
	suite.db = db

	// Run migrations
	migrator := database.NewMigrator(db, "../../migrations")
	err = migrator.Up()
	require.NoError(suite.T(), err, "Failed to run migrations")

	// Create test user
	suite.userEmail = "test@example.com"
	suite.userID = uuid.New()

	// Insert test user into database
	query := `
		INSERT INTO users (id, google_id, email, name, created_at, updated_at)
		VALUES ($1, $2, $3, $4, NOW(), NOW())
	`
	_, err = suite.db.Exec(query, suite.userID, "google_"+suite.userID.String(), suite.userEmail, "Test User")
	require.NoError(suite.T(), err, "Failed to create test user")

	// Create tag service with real database
	tagService := services.NewTagService(suite.db)

	// Create note service with real database
	noteService := services.NewNoteService(suite.db, tagService)
	suite.noteHandler = handlers.NewNotesHandler(noteService)

	// Setup router with routes
	suite.router = mux.NewRouter()
	suite.setupRoutes()

	// Setup test auth token
	suite.authToken = "test-auth-token"
}

// setupRoutes configures the router with all note endpoints
func (suite *NotesIntegrationTestSuite) setupRoutes() {
	// Note CRUD routes
	suite.router.HandleFunc("/api/v1/notes", suite.noteHandler.CreateNote).Methods("POST")
	suite.router.HandleFunc("/api/v1/notes", suite.noteHandler.ListNotes).Methods("GET")
	suite.router.HandleFunc("/api/v1/notes/{id}", suite.noteHandler.GetNote).Methods("GET")
	suite.router.HandleFunc("/api/v1/notes/{id}", suite.noteHandler.UpdateNote).Methods("PUT")
	suite.router.HandleFunc("/api/v1/notes/{id}", suite.noteHandler.DeleteNote).Methods("DELETE")
}

func (suite *NotesIntegrationTestSuite) TearDownSuite() {
	// Clean up test database
	if suite.db != nil {
		database.DropTestDatabase(suite.db)
		suite.db.Close()
	}
}

func (suite *NotesIntegrationTestSuite) SetupTest() {
	// Clean up notes between tests but keep the user
	_, err := suite.db.Exec("DELETE FROM notes WHERE user_id = $1", suite.userID)
	require.NoError(suite.T(), err, "Failed to clean up notes between tests")
}

func (suite *NotesIntegrationTestSuite) makeRequest(method, endpoint string, body interface{}, headers map[string]string) *httptest.ResponseRecorder {
	var reqBody *bytes.Buffer
	if body != nil {
		jsonBody, _ := json.Marshal(body)
		reqBody = bytes.NewBuffer(jsonBody)
	} else {
		reqBody = bytes.NewBuffer(nil)
	}

	req := httptest.NewRequest(method, endpoint, reqBody)
	req.Header.Set("Content-Type", "application/json")

	// Add authentication header
	req.Header.Set("Authorization", "Bearer "+suite.authToken)

	// Add custom headers
	for key, value := range headers {
		req.Header.Set(key, value)
	}

	// Add user context (simulating auth middleware)
	ctx := context.WithValue(req.Context(), "user", &models.User{
		ID:    suite.userID,
		Email: suite.userEmail,
		Name:  "Test User",
	})
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	suite.router.ServeHTTP(rr, req)

	return rr
}

func (suite *NotesIntegrationTestSuite) TestNotesAPI_FullCRUD() {
	// Test Create
	createReq := models.CreateNoteRequest{
		Title:   "Integration Test Note",
		Content: "This is a test note for integration testing",
	}

	rr := suite.makeRequest("POST", "/api/v1/notes", createReq, nil)
	suite.Equal(http.StatusCreated, rr.Code)

	var createResp struct {
		Success bool               `json:"success"`
		Data    *models.NoteResponse `json:"data"`
	}
	err := json.Unmarshal(rr.Body.Bytes(), &createResp)
	require.NoError(suite.T(), err)
	require.True(suite.T(), createResp.Success)
	require.NotNil(suite.T(), createResp.Data)

	noteID := createResp.Data.ID

	// Test Read
	rr = suite.makeRequest("GET", "/api/v1/notes/"+noteID.String(), nil, nil)
	suite.Equal(http.StatusOK, rr.Code)

	var getResp struct {
		Success bool          `json:"success"`
		Data    *models.Note `json:"data"`
	}
	err = json.Unmarshal(rr.Body.Bytes(), &getResp)
	require.NoError(suite.T(), err)
	require.True(suite.T(), getResp.Success)
	assert.Equal(suite.T(), noteID, getResp.Data.ID)
	assert.Equal(suite.T(), createReq.Title, *getResp.Data.Title)
	assert.Equal(suite.T(), createReq.Content, getResp.Data.Content)

	// Test Update
	updatedTitle := "Updated Integration Test Note"
	updatedContent := "This content has been updated"
	version := 1

	updateReq := models.UpdateNoteRequest{
		Title:   &updatedTitle,
		Content: &updatedContent,
		Version: &version,
	}

	rr = suite.makeRequest("PUT", "/api/v1/notes/"+noteID.String(), updateReq, nil)
	suite.Equal(http.StatusOK, rr.Code)

	var updateResp struct {
		Success bool          `json:"success"`
		Data    *models.Note `json:"data"`
	}
	err = json.Unmarshal(rr.Body.Bytes(), &updateResp)
	require.NoError(suite.T(), err)
	require.True(suite.T(), updateResp.Success)
	assert.Equal(suite.T(), updatedTitle, *updateResp.Data.Title)
	assert.Equal(suite.T(), updatedContent, updateResp.Data.Content)
	assert.Equal(suite.T(), 2, updateResp.Data.Version)

	// Test Delete
	rr = suite.makeRequest("DELETE", "/api/v1/notes/"+noteID.String(), nil, nil)
	suite.Equal(http.StatusOK, rr.Code)

	var deleteResp struct {
		Success bool `json:"success"`
	}
	err = json.Unmarshal(rr.Body.Bytes(), &deleteResp)
	require.NoError(suite.T(), err)
	require.True(suite.T(), deleteResp.Success)

	// Verify deletion
	rr = suite.makeRequest("GET", "/api/v1/notes/"+noteID.String(), nil, nil)
	suite.Equal(http.StatusNotFound, rr.Code)
}

func (suite *NotesIntegrationTestSuite) TestNotesAPI_ListAndPagination() {
	// Create multiple notes
	for i := 0; i < 25; i++ {
		createReq := models.CreateNoteRequest{
			Title:   "Test Note " + strconv.Itoa(i),
			Content: "Content for note " + strconv.Itoa(i),
		}
		rr := suite.makeRequest("POST", "/api/v1/notes", createReq, nil)
		suite.Equal(http.StatusCreated, rr.Code)
	}

	// Test first page
	rr := suite.makeRequest("GET", "/api/v1/notes?limit=10&offset=0", nil, nil)
	suite.Equal(http.StatusOK, rr.Code)

	var listResp struct {
		Success bool               `json:"success"`
		Data    *models.NoteList   `json:"data"`
	}
	err := json.Unmarshal(rr.Body.Bytes(), &listResp)
	require.NoError(suite.T(), err)
	require.True(suite.T(), listResp.Success)
	require.NotNil(suite.T(), listResp.Data)
	assert.Len(suite.T(), listResp.Data.Notes, 10)
	assert.Equal(suite.T(), 25, listResp.Data.Total)
	assert.True(suite.T(), listResp.Data.HasMore)

	// Test second page
	rr = suite.makeRequest("GET", "/api/v1/notes?limit=10&offset=10", nil, nil)
	suite.Equal(http.StatusOK, rr.Code)

	err = json.Unmarshal(rr.Body.Bytes(), &listResp)
	require.NoError(suite.T(), err)
	require.True(suite.T(), listResp.Success)
	assert.Len(suite.T(), listResp.Data.Notes, 10)
	assert.Equal(suite.T(), 25, listResp.Data.Total)
	assert.True(suite.T(), listResp.Data.HasMore)

	// Test last page
	rr = suite.makeRequest("GET", "/api/v1/notes?limit=10&offset=20", nil, nil)
	suite.Equal(http.StatusOK, rr.Code)

	err = json.Unmarshal(rr.Body.Bytes(), &listResp)
	require.NoError(suite.T(), err)
	require.True(suite.T(), listResp.Success)
	assert.Len(suite.T(), listResp.Data.Notes, 5)
	assert.Equal(suite.T(), 25, listResp.Data.Total)
	assert.False(suite.T(), listResp.Data.HasMore)
}

func (suite *NotesIntegrationTestSuite) TestNotesAPI_ErrorHandling() {
	// Test invalid JSON
	rr := suite.makeRequest("POST", "/api/v1/notes", "invalid json", nil)
	suite.Equal(http.StatusBadRequest, rr.Code)

	// Test missing required fields
	invalidReq := map[string]interface{}{
		"content": "", // Empty content
	}
	rr = suite.makeRequest("POST", "/api/v1/notes", invalidReq, nil)
	suite.Equal(http.StatusBadRequest, rr.Code)

	// Test non-existent note
	nonExistentID := uuid.New()
	rr = suite.makeRequest("GET", "/api/v1/notes/"+nonExistentID.String(), nil, nil)
	suite.Equal(http.StatusNotFound, rr.Code)

	// Test version conflict
	createReq := models.CreateNoteRequest{
		Title:   "Conflict Test",
		Content: "Content",
	}
	rr = suite.makeRequest("POST", "/api/v1/notes", createReq, nil)
	suite.Equal(http.StatusCreated, rr.Code)

	var createResp struct {
		Success bool               `json:"success"`
		Data    *models.NoteResponse `json:"data"`
	}
	err := json.Unmarshal(rr.Body.Bytes(), &createResp)
	require.NoError(suite.T(), err)

	updateReq := models.UpdateNoteRequest{
		Title:   &[]string{"Updated"}[0],
		Content: &[]string{"Updated"}[0],
		Version: &[]int{999}[0], // Wrong version
	}
	rr = suite.makeRequest("PUT", "/api/v1/notes/"+createResp.Data.ID.String(), updateReq, nil)
	suite.Equal(http.StatusConflict, rr.Code)
}

func (suite *NotesIntegrationTestSuite) TestNotesAPI_AutoTitleGeneration() {
	// Test note creation without title (auto-generated from content)
	createReq := models.CreateNoteRequest{
		Content: "This is the first line of the note\nAnd this is more content",
	}

	rr := suite.makeRequest("POST", "/api/v1/notes", createReq, nil)
	suite.Equal(http.StatusCreated, rr.Code)

	var createResp struct {
		Success bool               `json:"success"`
		Data    *models.NoteResponse `json:"data"`
	}
	err := json.Unmarshal(rr.Body.Bytes(), &createResp)
	require.NoError(suite.T(), err)
	require.True(suite.T(), createResp.Success)
	require.NotNil(suite.T(), createResp.Data)

	// Check that title was auto-generated from first line
	require.NotNil(suite.T(), createResp.Data.Title)
	assert.Equal(suite.T(), "This is the first line of the note", *createResp.Data.Title)
}

func (suite *NotesIntegrationTestSuite) TestNotesAPI_HashtagExtraction() {
	// Test note creation with hashtags
	createReq := models.CreateNoteRequest{
		Title:   "Meeting Notes",
		Content: "Discussed project #work #urgent with the team. Follow up next week #work",
	}

	rr := suite.makeRequest("POST", "/api/v1/notes", createReq, nil)
	suite.Equal(http.StatusCreated, rr.Code)

	var createResp struct {
		Success bool               `json:"success"`
		Data    *models.NoteResponse `json:"data"`
	}
	err := json.Unmarshal(rr.Body.Bytes(), &createResp)
	require.NoError(suite.T(), err)
	require.True(suite.T(), createResp.Success)

	// Check that hashtags are extracted correctly
	note := createResp.Data
	hashtags := note.ExtractHashtags()

	// Should contain #work and #urgent (duplicates should be removed)
	assert.Contains(suite.T(), hashtags, "#work")
	assert.Contains(suite.T(), hashtags, "#urgent")
	assert.Len(suite.T(), hashtags, 2) // #work should only appear once
}

func TestNotesIntegrationTestSuite(t *testing.T) {
	suite.Run(t, new(NotesIntegrationTestSuite))
}