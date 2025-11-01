package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gpd/my-notes/internal/models"
	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

// MockNoteService is a mock implementation of NoteServiceInterface
type MockNoteService struct {
	mock.Mock
}

func (m *MockNoteService) CreateNote(userID string, request *models.CreateNoteRequest) (*models.Note, error) {
	args := m.Called(userID, request)
	return args.Get(0).(*models.Note), args.Error(1)
}

func (m *MockNoteService) GetNoteByID(userID, noteID string) (*models.Note, error) {
	args := m.Called(userID, noteID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Note), args.Error(1)
}

func (m *MockNoteService) UpdateNote(userID, noteID string, request *models.UpdateNoteRequest) (*models.Note, error) {
	args := m.Called(userID, noteID, request)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Note), args.Error(1)
}

func (m *MockNoteService) DeleteNote(userID, noteID string) error {
	args := m.Called(userID, noteID)
	return args.Error(0)
}

func (m *MockNoteService) ListNotes(userID string, limit, offset int, orderBy, orderDir string) (*models.NoteList, error) {
	args := m.Called(userID, limit, offset, orderBy, orderDir)
	return args.Get(0).(*models.NoteList), args.Error(1)
}

func (m *MockNoteService) SearchNotes(userID string, request *models.SearchNotesRequest) (*models.NoteList, error) {
	args := m.Called(userID, request)
	return args.Get(0).(*models.NoteList), args.Error(1)
}

func (m *MockNoteService) GetNotesByTag(userID, tag string, limit, offset int) (*models.NoteList, error) {
	args := m.Called(userID, tag, limit, offset)
	return args.Get(0).(*models.NoteList), args.Error(1)
}

func (m *MockNoteService) GetNotesWithTimestamp(userID string, since time.Time) ([]models.Note, error) {
	args := m.Called(userID, since)
	return args.Get(0).([]models.Note), args.Error(1)
}

func (m *MockNoteService) BatchCreateNotes(userID string, requests []*models.CreateNoteRequest) ([]models.Note, error) {
	args := m.Called(userID, requests)
	return args.Get(0).([]models.Note), args.Error(1)
}

func (m *MockNoteService) BatchUpdateNotes(userID string, requests []struct {
	NoteID  string
	Request *models.UpdateNoteRequest
}) ([]models.Note, error) {
	args := m.Called(userID, requests)
	return args.Get(0).([]models.Note), args.Error(1)
}

func (m *MockNoteService) IncrementVersion(noteID string) error {
	args := m.Called(noteID)
	return args.Error(0)
}

// setupTestNoteHandler creates a test handler with mock service
func setupTestNoteHandler() (*NotesHandler, *MockNoteService) {
	mockService := new(MockNoteService)
	handler := NewNotesHandler(mockService)
	return handler, mockService
}

// createTestUser creates a test user for authentication context
func createTestUser() *models.User {
	return &models.User{
		ID:    uuid.New(),
		Email: "test@example.com",
		Name:  "Test User",
	}
}

// createTestNote creates a test note
func createTestNote() *models.Note {
	now := time.Now()
	return &models.Note{
		ID:        uuid.New(),
		UserID:    uuid.New(),
		Title:     func(s string) *string { return &s }("Test Note"),
		Content:   "This is a test note with #hashtag content.",
		CreatedAt: now,
		UpdatedAt: now,
		Version:   1,
	}
}

// TestCreateNote tests the CreateNote handler
func TestCreateNote(t *testing.T) {
	handler, mockService := setupTestNoteHandler()
	user := createTestUser()

	tests := []struct {
		name           string
		requestBody    interface{}
		mockSetup      func()
		expectedStatus int
		expectedError  string
	}{
		{
			name: "successful note creation",
			requestBody: models.CreateNoteRequest{
				Title:   "New Note",
				Content: "This is a new note with #work content.",
			},
			mockSetup: func() {
				note := createTestNote()
				mockService.On("CreateNote", user.ID.String(), mock.AnythingOfType("*models.CreateNoteRequest")).Return(note, nil)
			},
			expectedStatus: http.StatusCreated,
		},
		{
			name:           "invalid request body",
			requestBody:    "invalid json",
			mockSetup:      func() {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  "Invalid request payload",
		},
		{
			name: "service error",
			requestBody: models.CreateNoteRequest{
				Title:   "New Note",
				Content: "This is a new note.",
			},
			mockSetup: func() {
				mockService.On("CreateNote", user.ID.String(), mock.AnythingOfType("*models.CreateNoteRequest")).Return(nil, assert.AnError)
			},
			expectedStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.mockSetup()

			// Create request body
			var body []byte
			if str, ok := tt.requestBody.(string); ok {
				body = []byte(str)
			} else {
				body, _ = json.Marshal(tt.requestBody)
			}

			// Create request
			req := httptest.NewRequest("POST", "/api/notes", bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")

			// Add user to context
			ctx := contextWithUser(req.Context(), user)
			req = req.WithContext(ctx)

			// Create response recorder
			rr := httptest.NewRecorder()

			// Call handler
			handler.CreateNote(rr, req)

			// Check status
			assert.Equal(t, tt.expectedStatus, rr.Code)

			if tt.expectedError != "" {
				var response map[string]string
				err := json.Unmarshal(rr.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedError, response["error"])
			}

			mockService.AssertExpectations(t)
		})
	}
}

// TestListNotes tests the ListNotes handler
func TestListNotes(t *testing.T) {
	handler, mockService := setupTestNoteHandler()
	user := createTestUser()

	tests := []struct {
		name           string
		queryParams    string
		mockSetup      func()
		expectedStatus int
	}{
		{
			name:        "successful list notes",
			queryParams: "?limit=10&offset=0&orderBy=created_at&orderDir=desc",
			mockSetup: func() {
				noteList := &models.NoteList{
					Notes: []models.NoteResponse{
						createTestNote().ToResponse(),
					},
					Total:  1,
					Page:   1,
					Limit:  10,
					HasMore: false,
				}
				mockService.On("ListNotes", user.ID.String(), 10, 0, "created_at", "desc").Return(noteList, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:        "default parameters",
			queryParams: "",
			mockSetup: func() {
				noteList := &models.NoteList{
					Notes:  []models.NoteResponse{},
					Total:  0,
					Page:   1,
					Limit:  20,
					HasMore: false,
				}
				mockService.On("ListNotes", user.ID.String(), 20, 0, "created_at", "desc").Return(noteList, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:        "service error",
			queryParams: "",
			mockSetup: func() {
				mockService.On("ListNotes", user.ID.String(), 20, 0, "created_at", "desc").Return(nil, assert.AnError)
			},
			expectedStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.mockSetup()

			// Create request
			req := httptest.NewRequest("GET", "/api/notes"+tt.queryParams, nil)

			// Add user to context
			ctx := contextWithUser(req.Context(), user)
			req = req.WithContext(ctx)

			// Create response recorder
			rr := httptest.NewRecorder()

			// Call handler
			handler.ListNotes(rr, req)

			// Check status
			assert.Equal(t, tt.expectedStatus, rr.Code)

			mockService.AssertExpectations(t)
		})
	}
}

// TestGetNote tests the GetNote handler
func TestGetNote(t *testing.T) {
	handler, mockService := setupTestNoteHandler()
	user := createTestUser()

	tests := []struct {
		name           string
		noteID         string
		mockSetup      func()
		expectedStatus int
		expectedError  string
	}{
		{
			name:   "successful get note",
			noteID: uuid.New().String(),
			mockSetup: func() {
				note := createTestNote()
				mockService.On("GetNoteByID", user.ID.String(), mock.AnythingOfType("string")).Return(note, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:   "note not found",
			noteID: uuid.New().String(),
			mockSetup: func() {
				mockService.On("GetNoteByID", user.ID.String(), mock.AnythingOfType("string")).Return(nil, assert.AnError)
			},
			expectedStatus: http.StatusNotFound,
			expectedError:  "Note not found",
		},
		{
			name:           "missing note ID",
			noteID:         "",
			mockSetup:      func() {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  "Note ID is required",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.mockSetup()

			// Create request
			url := "/api/notes"
			if tt.noteID != "" {
				url += "/" + tt.noteID
			}
			req := httptest.NewRequest("GET", url, nil)

			// Add user to context
			ctx := contextWithUser(req.Context(), user)
			req = req.WithContext(ctx)

			// Use gorilla/mux to handle URL variables
			router := mux.NewRouter()
			router.HandleFunc("/api/notes/{id}", handler.GetNote).Methods("GET")

			// Create response recorder
			rr := httptest.NewRecorder()

			// Serve the request
			router.ServeHTTP(rr, req)

			// Check status
			assert.Equal(t, tt.expectedStatus, rr.Code)

			if tt.expectedError != "" {
				var response map[string]string
				err := json.Unmarshal(rr.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedError, response["error"])
			}

			if tt.noteID != "" {
				mockService.AssertExpectations(t)
			}
		})
	}
}

// TestUpdateNote tests the UpdateNote handler
func TestUpdateNote(t *testing.T) {
	handler, mockService := setupTestNoteHandler()
	user := createTestUser()

	tests := []struct {
		name           string
		noteID         string
		requestBody    interface{}
		mockSetup      func()
		expectedStatus int
		expectedError  string
	}{
		{
			name:   "successful update",
			noteID: uuid.New().String(),
			requestBody: models.UpdateNoteRequest{
				Title: func(s string) *string { return &s }("Updated Title"),
				Version: func(i int) *int { return &i }(1),
			},
			mockSetup: func() {
				note := createTestNote()
				mockService.On("UpdateNote", user.ID.String(), mock.AnythingOfType("string"), mock.AnythingOfType("*models.UpdateNoteRequest")).Return(note, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "invalid request body",
			noteID:         uuid.New().String(),
			requestBody:    "invalid json",
			mockSetup:      func() {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  "Invalid request payload",
		},
		{
			name:   "version conflict",
			noteID: uuid.New().String(),
			requestBody: models.UpdateNoteRequest{
				Title: func(s string) *string { return &s }("Updated Title"),
				Version: func(i int) *int { return &i }(1),
			},
			mockSetup: func() {
				mockService.On("UpdateNote", user.ID.String(), mock.AnythingOfType("string"), mock.AnythingOfType("*models.UpdateNoteRequest")).Return(nil, assert.AnError)
			},
			expectedStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.mockSetup()

			// Create request body
			var body []byte
			if str, ok := tt.requestBody.(string); ok {
				body = []byte(str)
			} else {
				body, _ = json.Marshal(tt.requestBody)
			}

			// Create request
			url := "/api/notes"
			if tt.noteID != "" {
				url += "/" + tt.noteID
			}
			req := httptest.NewRequest("PUT", url, bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")

			// Add user to context
			ctx := contextWithUser(req.Context(), user)
			req = req.WithContext(ctx)

			// Use gorilla/mux to handle URL variables
			router := mux.NewRouter()
			router.HandleFunc("/api/notes/{id}", handler.UpdateNote).Methods("PUT")

			// Create response recorder
			rr := httptest.NewRecorder()

			// Serve the request
			router.ServeHTTP(rr, req)

			// Check status
			assert.Equal(t, tt.expectedStatus, rr.Code)

			if tt.expectedError != "" {
				var response map[string]string
				err := json.Unmarshal(rr.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedError, response["error"])
			}

			if tt.noteID != "" && tt.requestBody != "invalid json" {
				mockService.AssertExpectations(t)
			}
		})
	}
}

// TestDeleteNote tests the DeleteNote handler
func TestDeleteNote(t *testing.T) {
	handler, mockService := setupTestNoteHandler()
	user := createTestUser()

	tests := []struct {
		name           string
		noteID         string
		mockSetup      func()
		expectedStatus int
		expectedError  string
	}{
		{
			name:   "successful deletion",
			noteID: uuid.New().String(),
			mockSetup: func() {
				mockService.On("DeleteNote", user.ID.String(), mock.AnythingOfType("string")).Return(nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:   "note not found",
			noteID: uuid.New().String(),
			mockSetup: func() {
				mockService.On("DeleteNote", user.ID.String(), mock.AnythingOfType("string")).Return(assert.AnError)
			},
			expectedStatus: http.StatusNotFound,
			expectedError:  "Note not found",
		},
		{
			name:           "missing note ID",
			noteID:         "",
			mockSetup:      func() {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  "Note ID is required",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.mockSetup()

			// Create request
			url := "/api/notes"
			if tt.noteID != "" {
				url += "/" + tt.noteID
			}
			req := httptest.NewRequest("DELETE", url, nil)

			// Add user to context
			ctx := contextWithUser(req.Context(), user)
			req = req.WithContext(ctx)

			// Use gorilla/mux to handle URL variables
			router := mux.NewRouter()
			router.HandleFunc("/api/notes/{id}", handler.DeleteNote).Methods("DELETE")

			// Create response recorder
			rr := httptest.NewRecorder()

			// Serve the request
			router.ServeHTTP(rr, req)

			// Check status
			assert.Equal(t, tt.expectedStatus, rr.Code)

			if tt.expectedError != "" {
				var response map[string]string
				err := json.Unmarshal(rr.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedError, response["error"])
			}

			if tt.noteID != "" {
				mockService.AssertExpectations(t)
			}
		})
	}
}

// TestSearchNotes tests the SearchNotes handler
func TestSearchNotes(t *testing.T) {
	handler, mockService := setupTestNoteHandler()
	user := createTestUser()

	tests := []struct {
		name           string
		queryParams    string
		mockSetup      func()
		expectedStatus int
	}{
		{
			name:        "successful search with query",
			queryParams: "?query=test&tags=work,personal&limit=10&offset=0",
			mockSetup: func() {
				noteList := &models.NoteList{
					Notes: []models.NoteResponse{
						createTestNote().ToResponse(),
					},
					Total:  1,
					Page:   1,
					Limit:  10,
					HasMore: false,
				}
				mockService.On("SearchNotes", user.ID.String(), mock.AnythingOfType("*models.SearchNotesRequest")).Return(noteList, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:        "search with tags only",
			queryParams: "?tags=work",
			mockSetup: func() {
				noteList := &models.NoteList{
					Notes:  []models.NoteResponse{},
					Total:  0,
					Page:   1,
					Limit:  20,
					HasMore: false,
				}
				mockService.On("SearchNotes", user.ID.String(), mock.AnythingOfType("*models.SearchNotesRequest")).Return(noteList, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:        "service error",
			queryParams: "?query=test",
			mockSetup: func() {
				mockService.On("SearchNotes", user.ID.String(), mock.AnythingOfType("*models.SearchNotesRequest")).Return(nil, assert.AnError)
			},
			expectedStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.mockSetup()

			// Create request
			req := httptest.NewRequest("GET", "/api/search/notes"+tt.queryParams, nil)

			// Add user to context
			ctx := contextWithUser(req.Context(), user)
			req = req.WithContext(ctx)

			// Create response recorder
			rr := httptest.NewRecorder()

			// Call handler
			handler.SearchNotes(rr, req)

			// Check status
			assert.Equal(t, tt.expectedStatus, rr.Code)

			mockService.AssertExpectations(t)
		})
	}
}

// TestGetNotesByTag tests the GetNotesByTag handler
func TestGetNotesByTag(t *testing.T) {
	handler, mockService := setupTestNoteHandler()
	user := createTestUser()

	tests := []struct {
		name           string
		tag            string
		queryParams    string
		mockSetup      func()
		expectedStatus int
		expectedError  string
	}{
		{
			name:        "successful get notes by tag",
			tag:         "work",
			queryParams: "?limit=10&offset=0",
			mockSetup: func() {
				noteList := &models.NoteList{
					Notes: []models.NoteResponse{
						createTestNote().ToResponse(),
					},
					Total:  1,
					Page:   1,
					Limit:  10,
					HasMore: false,
				}
				mockService.On("GetNotesByTag", user.ID.String(), "#work", 10, 0).Return(noteList, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:        "tag with # prefix",
			tag:         "#work",
			queryParams: "",
			mockSetup: func() {
				noteList := &models.NoteList{
					Notes:  []models.NoteResponse{},
					Total:  0,
					Page:   1,
					Limit:  20,
					HasMore: false,
				}
				mockService.On("GetNotesByTag", user.ID.String(), "#work", 20, 0).Return(noteList, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "missing tag",
			tag:            "",
			queryParams:    "",
			mockSetup:      func() {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  "Tag is required",
		},
		{
			name:        "service error",
			tag:         "work",
			queryParams: "",
			mockSetup: func() {
				mockService.On("GetNotesByTag", user.ID.String(), "#work", 20, 0).Return(nil, assert.AnError)
			},
			expectedStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.mockSetup()

			// Create request
			url := "/api/notes/tags"
			if tt.tag != "" {
				url += "/" + tt.tag
			}
			req := httptest.NewRequest("GET", url+tt.queryParams, nil)

			// Add user to context
			ctx := contextWithUser(req.Context(), user)
			req = req.WithContext(ctx)

			// Use gorilla/mux to handle URL variables
			router := mux.NewRouter()
			router.HandleFunc("/api/notes/tags/{tag}", handler.GetNotesByTag).Methods("GET")

			// Create response recorder
			rr := httptest.NewRecorder()

			// Serve the request
			router.ServeHTTP(rr, req)

			// Check status
			assert.Equal(t, tt.expectedStatus, rr.Code)

			if tt.expectedError != "" {
				var response map[string]string
				err := json.Unmarshal(rr.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedError, response["error"])
			}

			if tt.tag != "" {
				mockService.AssertExpectations(t)
			}
		})
	}
}

// TestSyncNotes tests the SyncNotes handler
func TestSyncNotes(t *testing.T) {
	handler, mockService := setupTestNoteHandler()
	user := createTestUser()

	tests := []struct {
		name           string
		queryParams    string
		mockSetup      func()
		expectedStatus int
		expectedError  string
	}{
		{
			name:        "successful sync",
			queryParams: "?since=2023-01-01T00:00:00Z",
			mockSetup: func() {
				notes := []models.Note{*createTestNote()}
				mockService.On("GetNotesWithTimestamp", user.ID.String(), mock.AnythingOfType("time.Time")).Return(notes, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "missing timestamp",
			queryParams:    "",
			mockSetup:      func() {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  "Since timestamp is required",
		},
		{
			name:        "invalid timestamp format",
			queryParams: "?since=invalid",
			mockSetup:   func() {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  "Invalid timestamp format",
		},
		{
			name:        "service error",
			queryParams: "?since=2023-01-01T00:00:00Z",
			mockSetup: func() {
				mockService.On("GetNotesWithTimestamp", user.ID.String(), mock.AnythingOfType("time.Time")).Return(nil, assert.AnError)
			},
			expectedStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.mockSetup()

			// Create request
			req := httptest.NewRequest("GET", "/api/notes/sync"+tt.queryParams, nil)

			// Add user to context
			ctx := contextWithUser(req.Context(), user)
			req = req.WithContext(ctx)

			// Create response recorder
			rr := httptest.NewRecorder()

			// Call handler
			handler.SyncNotes(rr, req)

			// Check status
			assert.Equal(t, tt.expectedStatus, rr.Code)

			if tt.expectedError != "" {
				var response map[string]string
				err := json.Unmarshal(rr.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedError, response["error"])
			}

			if tt.queryParams == "?since=2023-01-01T00:00:00Z" {
				mockService.AssertExpectations(t)
			}
		})
	}
}

// TestBatchCreateNotes tests the BatchCreateNotes handler
func TestBatchCreateNotes(t *testing.T) {
	handler, mockService := setupTestNoteHandler()
	user := createTestUser()

	tests := []struct {
		name           string
		requestBody    interface{}
		mockSetup      func()
		expectedStatus int
		expectedError  string
	}{
		{
			name: "successful batch create",
			requestBody: []models.CreateNoteRequest{
				{
					Title:   "Note 1",
					Content: "Content 1",
				},
				{
					Title:   "Note 2",
					Content: "Content 2",
				},
			},
			mockSetup: func() {
				notes := []models.Note{*createTestNote(), *createTestNote()}
				mockService.On("BatchCreateNotes", user.ID.String(), mock.AnythingOfType("[]*models.CreateNoteRequest")).Return(notes, nil)
			},
			expectedStatus: http.StatusCreated,
		},
		{
			name:           "empty batch",
			requestBody:    []models.CreateNoteRequest{},
			mockSetup:      func() {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  "At least one note is required",
		},
		{
			name:           "batch too large",
			requestBody:    make([]models.CreateNoteRequest, 51),
			mockSetup:      func() {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  "Maximum 50 notes allowed per batch",
		},
		{
			name:           "invalid request body",
			requestBody:    "invalid json",
			mockSetup:      func() {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  "Invalid request payload",
		},
		{
			name: "service error",
			requestBody: []models.CreateNoteRequest{
				{
					Title:   "Note 1",
					Content: "Content 1",
				},
			},
			mockSetup: func() {
				mockService.On("BatchCreateNotes", user.ID.String(), mock.AnythingOfType("[]*models.CreateNoteRequest")).Return(nil, assert.AnError)
			},
			expectedStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.mockSetup()

			// Create request body
			var body []byte
			if str, ok := tt.requestBody.(string); ok {
				body = []byte(str)
			} else {
				body, _ = json.Marshal(tt.requestBody)
			}

			// Create request
			req := httptest.NewRequest("POST", "/api/notes/batch", bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")

			// Add user to context
			ctx := contextWithUser(req.Context(), user)
			req = req.WithContext(ctx)

			// Create response recorder
			rr := httptest.NewRecorder()

			// Call handler
			handler.BatchCreateNotes(rr, req)

			// Check status
			assert.Equal(t, tt.expectedStatus, rr.Code)

			if tt.expectedError != "" {
				var response map[string]string
				err := json.Unmarshal(rr.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedError, response["error"])
			}

			// Only assert expectations for valid requests
			if len(body) > 2 && string(body) != "invalid json" && len(tt.requestBody.([]models.CreateNoteRequest)) > 0 && len(tt.requestBody.([]models.CreateNoteRequest)) <= 50 {
				mockService.AssertExpectations(t)
			}
		})
	}
}

// TestBatchUpdateNotes tests the BatchUpdateNotes handler
func TestBatchUpdateNotes(t *testing.T) {
	handler, mockService := setupTestNoteHandler()
	user := createTestUser()

	tests := []struct {
		name           string
		requestBody    interface{}
		mockSetup      func()
		expectedStatus int
		expectedError  string
	}{
		{
			name: "successful batch update",
			requestBody: map[string]interface{}{
				"updates": []map[string]interface{}{
					{
						"note_id": uuid.New().String(),
						"updates": models.UpdateNoteRequest{
							Title: func(s string) *string { return &s }("Updated Title 1"),
						},
					},
					{
						"note_id": uuid.New().String(),
						"updates": models.UpdateNoteRequest{
							Content: func(s string) *string { return &s }("Updated content 2"),
						},
					},
				},
			},
			mockSetup: func() {
				notes := []models.Note{*createTestNote(), *createTestNote()}
				mockService.On("BatchUpdateNotes", user.ID.String(), mock.AnythingOfType("[]struct { NoteID string; Request *models.UpdateNoteRequest }")).Return(notes, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name: "empty updates",
			requestBody: map[string]interface{}{
				"updates": []map[string]interface{}{},
			},
			mockSetup:      func() {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  "At least one update is required",
		},
		{
			name: "batch too large",
			requestBody: map[string]interface{}{
				"updates": make([]map[string]interface{}, 51),
			},
			mockSetup:      func() {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  "Maximum 50 updates allowed per batch",
		},
		{
			name:           "invalid request body",
			requestBody:    "invalid json",
			mockSetup:      func() {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  "Invalid request payload",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.mockSetup()

			// Create request body
			var body []byte
			if str, ok := tt.requestBody.(string); ok {
				body = []byte(str)
			} else {
				body, _ = json.Marshal(tt.requestBody)
			}

			// Create request
			req := httptest.NewRequest("PUT", "/api/notes/batch", bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")

			// Add user to context
			ctx := contextWithUser(req.Context(), user)
			req = req.WithContext(ctx)

			// Create response recorder
			rr := httptest.NewRecorder()

			// Call handler
			handler.BatchUpdateNotes(rr, req)

			// Check status
			assert.Equal(t, tt.expectedStatus, rr.Code)

			if tt.expectedError != "" {
				var response map[string]string
				err := json.Unmarshal(rr.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedError, response["error"])
			}

			// Only assert expectations for valid requests
			if string(body) != "invalid json" {
				if updates, ok := tt.requestBody.(map[string]interface{})["updates"].([]map[string]interface{}); ok {
					if len(updates) > 0 && len(updates) <= 50 {
						mockService.AssertExpectations(t)
					}
				}
			}
		})
	}
}

// TestGetNoteStats tests the GetNoteStats handler
func TestGetNoteStats(t *testing.T) {
	handler, mockService := setupTestNoteHandler()
	user := createTestUser()

	tests := []struct {
		name           string
		mockSetup      func()
		expectedStatus int
	}{
		{
			name: "successful get stats",
			mockSetup: func() {
				noteList := &models.NoteList{
					Notes:  []models.NoteResponse{},
					Total:  10,
					Page:   1,
					Limit:  1,
					HasMore: true,
				}
				mockService.On("ListNotes", user.ID.String(), 1, 0, "created_at", "desc").Return(noteList, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name: "service error",
			mockSetup: func() {
				mockService.On("ListNotes", user.ID.String(), 1, 0, "created_at", "desc").Return(nil, assert.AnError)
			},
			expectedStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.mockSetup()

			// Create request
			req := httptest.NewRequest("GET", "/api/notes/stats", nil)

			// Add user to context
			ctx := contextWithUser(req.Context(), user)
			req = req.WithContext(ctx)

			// Create response recorder
			rr := httptest.NewRecorder()

			// Call handler
			handler.GetNoteStats(rr, req)

			// Check status
			assert.Equal(t, tt.expectedStatus, rr.Code)

			mockService.AssertExpectations(t)
		})
	}
}

// TestUnauthenticated tests that handlers properly reject unauthenticated requests
func TestUnauthenticated(t *testing.T) {
	handler, _ := setupTestNoteHandler()

	tests := []struct {
		name       string
		handlerFn  func(http.ResponseWriter, *http.Request)
		method     string
		url        string
		body       []byte
	}{
		{
			name:      "CreateNote",
			handlerFn: handler.CreateNote,
			method:    "POST",
			url:       "/api/notes",
			body:      []byte(`{"title": "Test", "content": "Test"}`),
		},
		{
			name:      "ListNotes",
			handlerFn: handler.ListNotes,
			method:    "GET",
			url:       "/api/notes",
			body:      nil,
		},
		{
			name:      "GetNote",
			handlerFn: handler.GetNote,
			method:    "GET",
			url:       "/api/notes/123",
			body:      nil,
		},
		{
			name:      "UpdateNote",
			handlerFn: handler.UpdateNote,
			method:    "PUT",
			url:       "/api/notes/123",
			body:      []byte(`{"title": "Updated"}`),
		},
		{
			name:      "DeleteNote",
			handlerFn: handler.DeleteNote,
			method:    "DELETE",
			url:       "/api/notes/123",
			body:      nil,
		},
		{
			name:      "SearchNotes",
			handlerFn: handler.SearchNotes,
			method:    "GET",
			url:       "/api/search/notes?query=test",
			body:      nil,
		},
		{
			name:      "GetNotesByTag",
			handlerFn: handler.GetNotesByTag,
			method:    "GET",
			url:       "/api/notes/tags/work",
			body:      nil,
		},
		{
			name:      "SyncNotes",
			handlerFn: handler.SyncNotes,
			method:    "GET",
			url:       "/api/notes/sync?since=2023-01-01T00:00:00Z",
			body:      nil,
		},
		{
			name:      "BatchCreateNotes",
			handlerFn: handler.BatchCreateNotes,
			method:    "POST",
			url:       "/api/notes/batch",
			body:      []byte(`[{"title": "Test", "content": "Test"}]`),
		},
		{
			name:      "BatchUpdateNotes",
			handlerFn: handler.BatchUpdateNotes,
			method:    "PUT",
			url:       "/api/notes/batch",
			body:      []byte(`{"updates": []}`),
		},
		{
			name:      "GetNoteStats",
			handlerFn: handler.GetNoteStats,
			method:    "GET",
			url:       "/api/notes/stats",
			body:      nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var req *http.Request
			if tt.body != nil {
				req = httptest.NewRequest(tt.method, tt.url, bytes.NewReader(tt.body))
				req.Header.Set("Content-Type", "application/json")
			} else {
				req = httptest.NewRequest(tt.method, tt.url, nil)
			}

			// Do NOT add user to context - this tests unauthenticated access

			rr := httptest.NewRecorder()
			tt.handlerFn(rr, req)

			assert.Equal(t, http.StatusUnauthorized, rr.Code)

			var response map[string]string
			err := json.Unmarshal(rr.Body.Bytes(), &response)
			require.NoError(t, err)
			assert.Equal(t, "User not authenticated", response["error"])
		})
	}
}

// Helper function to add user to request context
func contextWithUser(ctx context.Context, user *models.User) context.Context {
	return context.WithValue(ctx, "user", user)
}