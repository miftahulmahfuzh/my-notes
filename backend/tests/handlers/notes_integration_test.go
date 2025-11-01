package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gpd/my-notes/internal/handlers"
	"github.com/gpd/my-notes/internal/models"
	"github.com/gpd/my-notes/internal/services"
	"github.com/gorilla/mux"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
)

// NotesIntegrationTestSuite tests the notes API endpoints
type NotesIntegrationTestSuite struct {
	suite.Suite
	router       *mux.Router
	noteHandler  *handlers.NotesHandler
	userID       string
	authToken    string
}

func (suite *NotesIntegrationTestSuite) SetupSuite() {
	// Create mock repository and service
	repo := services.NewMockNoteRepository()
	noteService := services.NewNoteService(repo)
	suite.noteHandler = handlers.NewNotesHandler(noteService)

	// Setup router
	suite.router = mux.NewRouter()
	suite.noteHandler.RegisterRoutes(suite.router)

	// Setup test user
	suite.userID = "test-user-123"
	suite.authToken = "test-auth-token"
}

func (suite *NotesIntegrationTestSuite) SetupTest() {
	// Clean up any existing test data
	// In a real implementation, you would clean up the test database
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
		Email: "test@example.com",
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
		Success bool `json:"success"`
		Data    *models.Note `json:"data"`
	}
	err := json.Unmarshal(rr.Body.Bytes(), &createResp)
	require.NoError(suite.T(), err)
	require.True(suite.T(), createResp.Success)
	require.NotNil(suite.T(), createResp.Data)

	noteID := createResp.Data.ID

	// Test Read
	rr = suite.makeRequest("GET", "/api/v1/notes/"+noteID, nil, nil)
	suite.Equal(http.StatusOK, rr.Code)

	var getResp struct {
		Success bool `json:"success"`
		Data    *models.Note `json:"data"`
	}
	err = json.Unmarshal(rr.Body.Bytes(), &getResp)
	require.NoError(suite.T(), err)
	require.True(suite.T(), getResp.Success)
	assert.Equal(suite.T(), noteID, getResp.Data.ID)
	assert.Equal(suite.T(), createReq.Title, getResp.Data.Title)
	assert.Equal(suite.T(), createReq.Content, getResp.Data.Content)

	// Test Update
	updateReq := models.UpdateNoteRequest{
		Title:   "Updated Integration Test Note",
		Content: "This content has been updated",
		Version: 1,
	}

	rr = suite.makeRequest("PUT", "/api/v1/notes/"+noteID, updateReq, nil)
	suite.Equal(http.StatusOK, rr.Code)

	var updateResp struct {
		Success bool `json:"success"`
		Data    *models.Note `json:"data"`
	}
	err = json.Unmarshal(rr.Body.Bytes(), &updateResp)
	require.NoError(suite.T(), err)
	require.True(suite.T(), updateResp.Success)
	assert.Equal(suite.T(), updateReq.Title, updateResp.Data.Title)
	assert.Equal(suite.T(), updateReq.Content, updateResp.Data.Content)
	assert.Equal(suite.T(), 2, updateResp.Data.Version)

	// Test Delete
	rr = suite.makeRequest("DELETE", "/api/v1/notes/"+noteID, nil, nil)
	suite.Equal(http.StatusOK, rr.Code)

	var deleteResp struct {
		Success bool `json:"success"`
	}
	err = json.Unmarshal(rr.Body.Bytes(), &deleteResp)
	require.NoError(suite.T(), err)
	require.True(suite.T(), deleteResp.Success)

	// Verify deletion
	rr = suite.makeRequest("GET", "/api/v1/notes/"+noteID, nil, nil)
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
	rr = suite.makeRequest("GET", "/api/v1/notes?limit=10&offset=0", nil, nil)
	suite.Equal(http.StatusOK, rr.Code)

	var listResp struct {
		Success bool `json:"success"`
		Data    struct {
			Notes   []models.Note `json:"notes"`
			Total   int          `json:"total"`
			Limit   int          `json:"limit"`
			Offset  int          `json:"offset"`
			HasMore bool         `json:"hasMore"`
		} `json:"data"`
	}
	err := json.Unmarshal(rr.Body.Bytes(), &listResp)
	require.NoError(suite.T(), err)
	require.True(suite.T(), listResp.Success)
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

func (suite *NotesIntegrationTestSuite) TestNotesAPI_Search() {
	// Create test notes with searchable content
	testNotes := []models.CreateNoteRequest{
		{Title: "Shopping List", Content: "Buy milk, eggs, bread, and vegetables"},
		{Title: "Work Meeting", Content: "Discuss quarterly results and project timeline"},
		{Title: "Personal Reminder", Content: "Call dentist for appointment"},
		{Title: "Recipe", Content: "Ingredients for pasta: pasta, sauce, cheese"},
		{Title: "Ideas", Content: "New project ideas and brainstorming notes"},
	}

	for _, note := range testNotes {
		rr := suite.makeRequest("POST", "/api/v1/notes", note, nil)
		suite.Equal(http.StatusCreated, rr.Code)
	}

	// Test search by title
	rr = suite.makeRequest("GET", "/api/v1/notes/search?query=shopping", nil, nil)
	suite.Equal(http.StatusOK, rr.Code)

	var searchResp struct {
		Success bool `json:"success"`
		Data    struct {
			Notes   []models.Note `json:"notes"`
			Total   int          `json:"total"`
		} `json:"data"`
	}
	err := json.Unmarshal(rr.Body.Bytes(), &searchResp)
	require.NoError(suite.T(), err)
	require.True(suite.T(), searchResp.Success)
	assert.Equal(suite.T(), 1, searchResp.Data.Total)
	assert.Equal(suite.T(), "Shopping List", searchResp.Data.Notes[0].Title)

	// Test search by content
	rr = suite.makeRequest("GET", "/api/v1/notes/search?query=pasta", nil, nil)
	suite.Equal(http.StatusOK, rr.Code)

	err = json.Unmarshal(rr.Body.Bytes(), &searchResp)
	require.NoError(suite.T(), err)
	require.True(suite.T(), searchResp.Success)
	assert.Equal(suite.T(), 1, searchResp.Data.Total)
	assert.Equal(suite.T(), "Recipe", searchResp.Data.Notes[0].Title)

	// Test search with no results
	rr = suite.makeRequest("GET", "/api/v1/notes/search?query=nonexistent", nil, nil)
	suite.Equal(http.StatusOK, rr.Code)

	err = json.Unmarshal(rr.Body.Bytes(), &searchResp)
	require.NoError(suite.T(), err)
	require.True(suite.T(), searchResp.Success)
	assert.Equal(suite.T(), 0, searchResp.Data.Total)
	assert.Len(suite.T(), searchResp.Data.Notes, 0)
}

func (suite *NotesIntegrationTestSuite) TestNotesAPI_TagOperations() {
	// Create notes with hashtags
	notesWithTags := []models.CreateNoteRequest{
		{Title: "Work Tasks", Content: "Complete project #work #urgent"},
		{Title: "Shopping", Content: "Buy groceries #shopping #personal"},
		{Title: "Meeting Notes", Content: "Discussed #work topics with team"},
		{Title: "Home Projects", Content: "Plan garden redesign #home #personal"},
	}

	for _, note := range notesWithTags {
		rr := suite.makeRequest("POST", "/api/v1/notes", note, nil)
		suite.Equal(http.StatusCreated, rr.Code)
	}

	// Test get notes by tag
	rr = suite.makeRequest("GET", "/api/v1/notes/tags/work", nil, nil)
	suite.Equal(http.StatusOK, rr.Code)

	var tagResp struct {
		Success bool `json:"success"`
		Data    struct {
			Notes   []models.Note `json:"notes"`
			Total   int          `json:"total"`
		} `json:"data"`
	}
	err := json.Unmarshal(rr.Body.Bytes(), &tagResp)
	require.NoError(suite.T(), err)
	require.True(suite.T(), tagResp.Success)
	assert.Equal(suite.T(), 2, tagResp.Data.Total) // Two notes with #work tag

	// Test multiple tags
	rr = suite.makeRequest("GET", "/api/v1/notes?tags=work,personal", nil, nil)
	suite.Equal(http.StatusOK, rr.Code)

	var multiTagResp struct {
		Success bool `json:"success"`
		Data    struct {
			Notes   []models.Note `json:"notes"`
			Total   int          `json:"total"`
		} `json:"data"`
	}
	err = json.Unmarshal(rr.Body.Bytes(), &multiTagResp)
	require.NoError(suite.T(), err)
	require.True(suite.T(), multiTagResp.Success)
	assert.Equal(suite.T(), 3, multiTagResp.Data.Total) // Notes with either #work or #personal
}

func (suite *NotesIntegrationTestSuite) TestNotesAPI_SyncEndpoint() {
	// Create some notes
	baseTime := time.Now()
	for i := 0; i < 5; i++ {
		createReq := models.CreateNoteRequest{
			Title:   "Sync Test Note " + strconv.Itoa(i),
			Content: "Content " + strconv.Itoa(i),
		}
		rr := suite.makeRequest("POST", "/api/v1/notes", createReq, nil)
		suite.Equal(http.StatusCreated, rr.Code)
	}

	// Test sync endpoint
	syncTime := baseTime.Add(-1 * time.Hour).Format(time.RFC3339)
	rr = suite.makeRequest("GET", "/api/v1/notes/sync?since="+syncTime, nil, nil)
	suite.Equal(http.StatusOK, rr.Code)

	var syncResp struct {
		Success bool `json:"success"`
		Data    struct {
			Notes      []models.Note `json:"notes"`
			Total      int          `json:"total"`
			SyncToken  string       `json:"sync_token"`
			ServerTime string       `json:"server_time"`
			Conflicts  []interface{} `json:"conflicts"`
			Metadata   struct {
				LastSyncAt   string `json:"last_sync_at"`
				TotalNotes   int    `json:"total_notes"`
				UpdatedNotes int    `json:"updated_notes"`
				HasConflicts bool   `json:"has_conflicts"`
			} `json:"metadata"`
		} `json:"data"`
	}
	err := json.Unmarshal(rr.Body.Bytes(), &syncResp)
	require.NoError(suite.T(), err)
	require.True(suite.T(), syncResp.Success)
	assert.Equal(suite.T(), 5, syncResp.Data.Total)
	assert.NotEmpty(suite.T(), syncResp.Data.SyncToken)
	assert.NotEmpty(suite.T(), syncResp.Data.ServerTime)
	assert.Equal(suite.T(), 5, syncResp.Data.Metadata.TotalNotes)
	assert.Equal(suite.T(), 5, syncResp.Data.Metadata.UpdatedNotes)
}

func (suite *NotesIntegrationTestSuite) TestNotesAPI_BatchOperations() {
	// Test batch create
	batchCreateReq := struct {
		Notes []models.CreateNoteRequest `json:"notes"`
	}{
		Notes: []models.CreateNoteRequest{
			{Title: "Batch Note 1", Content: "Content 1"},
			{Title: "Batch Note 2", Content: "Content 2"},
			{Title: "Batch Note 3", Content: "Content 3"},
		},
	}

	rr := suite.makeRequest("POST", "/api/v1/notes/batch", batchCreateReq, nil)
	suite.Equal(http.StatusCreated, rr.Code)

	var batchCreateResp struct {
		Success bool `json:"success"`
		Data    struct {
			Notes []models.Note `json:"notes"`
			Count int          `json:"count"`
		} `json:"data"`
	}
	err := json.Unmarshal(rr.Body.Bytes(), &batchCreateResp)
	require.NoError(suite.T(), err)
	require.True(suite.T(), batchCreateResp.Success)
	assert.Len(suite.T(), batchCreateResp.Data.Notes, 3)
	assert.Equal(suite.T(), 3, batchCreateResp.Data.Count)

	// Test batch update
	var updates []models.NoteUpdate
	for i, note := range batchCreateResp.Data.Notes {
		updates = append(updates, models.NoteUpdate{
			NoteID: note.ID,
			Request: &models.UpdateNoteRequest{
				Title:   "Updated " + note.Title,
				Content: "Updated " + note.Content,
				Version: 1,
			},
		})
	}

	batchUpdateReq := struct {
		Updates []models.NoteUpdate `json:"updates"`
	}{
		Updates: updates,
	}

	rr = suite.makeRequest("PUT", "/api/v1/notes/batch", batchUpdateReq, nil)
	suite.Equal(http.StatusOK, rr.Code)

	var batchUpdateResp struct {
		Success bool `json:"success"`
		Data    struct {
			Notes []models.Note `json:"notes"`
			Count int          `json:"count"`
		} `json:"data"`
	}
	err = json.Unmarshal(rr.Body.Bytes(), &batchUpdateResp)
	require.NoError(suite.T(), err)
	require.True(suite.T(), batchUpdateResp.Success)
	assert.Len(suite.T(), batchUpdateResp.Data.Notes, 3)
	assert.Equal(suite.T(), 3, batchUpdateResp.Data.Count)

	// Verify updates
	for i, note := range batchUpdateResp.Data.Notes {
		assert.True(suite.T(), strings.HasPrefix(note.Title, "Updated "))
		assert.True(suite.T(), strings.HasPrefix(note.Content, "Updated "))
		assert.Equal(suite.T(), 2, note.Version)
	}
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
	rr = suite.makeRequest("GET", "/api/v1/notes/non-existent-id", nil, nil)
	suite.Equal(http.StatusNotFound, rr.Code)

	// Test version conflict
	createReq := models.CreateNoteRequest{
		Title:   "Conflict Test",
		Content: "Content",
	}
	rr = suite.makeRequest("POST", "/api/v1/notes", createReq, nil)
	suite.Equal(http.StatusCreated, rr.Code)

	var createResp struct {
		Success bool `json:"success"`
		Data    *models.Note `json:"data"`
	}
	err := json.Unmarshal(rr.Body.Bytes(), &createResp)
	require.NoError(suite.T(), err)

	updateReq := models.UpdateNoteRequest{
		Title:   "Updated",
		Content: "Updated",
		Version: 999, // Wrong version
	}
	rr = suite.makeRequest("PUT", "/api/v1/notes/"+createResp.Data.ID, updateReq, nil)
	suite.Equal(http.StatusConflict, rr.Code)
}

func (suite *NotesIntegrationTestSuite) TestNotesAPI_Performance() {
	if testing.Short() {
		suite.T().Skip("Skipping performance tests in short mode")
	}

	// Create 100 notes and measure performance
	start := time.Now()
	for i := 0; i < 100; i++ {
		createReq := models.CreateNoteRequest{
			Title:   "Perf Note " + strconv.Itoa(i),
			Content: "Content " + strconv.Itoa(i),
		}
		rr := suite.makeRequest("POST", "/api/v1/notes", createReq, nil)
		suite.Equal(http.StatusCreated, rr.Code)
	}
	createDuration := time.Since(start)
	suite.T().Logf("Created 100 notes in %v (%.2f notes/sec)", createDuration, float64(100)/createDuration.Seconds())

	// List all notes
	start = time.Now()
	rr = suite.makeRequest("GET", "/api/v1/notes?limit=100", nil, nil)
	listDuration := time.Since(start)
	suite.Equal(http.StatusOK, rr.Code)
	suite.T().Logf("Listed 100 notes in %v", listDuration)

	// Search performance
	start = time.Now()
	rr = suite.makeRequest("GET", "/api/v1/notes/search?query=Perf", nil, nil)
	searchDuration := time.Since(start)
	suite.Equal(http.StatusOK, rr.Code)
	suite.T().Logf("Searched 100 notes in %v", searchDuration)

	// Performance assertions
	assert.Less(suite.T(), createDuration, 10*time.Second, "Creating 100 notes should take less than 10 seconds")
	assert.Less(suite.T(), listDuration, 1*time.Second, "Listing notes should take less than 1 second")
	assert.Less(suite.T(), searchDuration, 500*time.Millisecond, "Searching notes should take less than 500ms")
}

func TestNotesIntegrationTestSuite(t *testing.T) {
	suite.Run(t, new(NotesIntegrationTestSuite))
}

// Additional helper functions for testing

func (suite *NotesIntegrationTestSuite) createTestNote(title, content string) string {
	createReq := models.CreateNoteRequest{
		Title:   title,
		Content: content,
	}

	rr := suite.makeRequest("POST", "/api/v1/notes", createReq, nil)
	suite.Equal(http.StatusCreated, rr.Code)

	var resp struct {
		Success bool `json:"success"`
		Data    *models.Note `json:"data"`
	}
	err := json.Unmarshal(rr.Body.Bytes(), &resp)
	require.NoError(suite.T(), err)
	require.True(suite.T(), resp.Success)

	return resp.Data.ID
}

func (suite *NotesIntegrationTestSuite) getTestNote(noteID string) *models.Note {
	rr := suite.makeRequest("GET", "/api/v1/notes/"+noteID, nil, nil)
	suite.Equal(http.StatusOK, rr.Code)

	var resp struct {
		Success bool `json:"success"`
		Data    *models.Note `json:"data"`
	}
	err := json.Unmarshal(rr.Body.Bytes(), &resp)
	require.NoError(suite.T(), err)
	require.True(suite.T(), resp.Success)

	return resp.Data
}