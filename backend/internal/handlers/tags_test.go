package handlers

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/gpd/my-notes/internal/config"
	"github.com/gpd/my-notes/internal/database"
	"github.com/gpd/my-notes/internal/models"
	"github.com/gpd/my-notes/internal/services"
	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"

	_ "github.com/lib/pq"
)

// MockTagService is a mock implementation of TagServiceInterface
type MockTagService struct {
	mock.Mock
}

// MockTagService methods
func (m *MockTagService) CreateTag(request *models.CreateTagRequest) (*models.Tag, error) {
	args := m.Called(request)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Tag), args.Error(1)
}

func (m *MockTagService) GetTagByID(tagID string) (*models.Tag, error) {
	args := m.Called(tagID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Tag), args.Error(1)
}

func (m *MockTagService) GetTagByName(tagName string) (*models.Tag, error) {
	args := m.Called(tagName)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Tag), args.Error(1)
}

func (m *MockTagService) ListTags(limit, offset int, orderBy, orderDir string) (*models.TagList, error) {
	args := m.Called(limit, offset, orderBy, orderDir)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.TagList), args.Error(1)
}

func (m *MockTagService) GetTagsByUser(userID string, limit, offset int) (*models.TagList, error) {
	args := m.Called(userID, limit, offset)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.TagList), args.Error(1)
}

func (m *MockTagService) GetTagsWithUsageStats(limit, offset int) (*models.TagList, error) {
	args := m.Called(limit, offset)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.TagList), args.Error(1)
}

func (m *MockTagService) ExtractTagsFromContent(content string) []string {
	args := m.Called(content)
	return args.Get(0).([]string)
}

func (m *MockTagService) ProcessTagsForNote(noteID string, tags []string) error {
	args := m.Called(noteID, tags)
	return args.Error(0)
}

func (m *MockTagService) UpdateTagsForNote(noteID string, tags []string) error {
	args := m.Called(noteID, tags)
	return args.Error(0)
}

func (m *MockTagService) GetTagSuggestions(partial string, limit int) ([]string, error) {
	args := m.Called(partial, limit)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]string), args.Error(1)
}

func (m *MockTagService) GetPopularTags(limit int) ([]models.TagResponse, error) {
	args := m.Called(limit)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]models.TagResponse), args.Error(1)
}

func (m *MockTagService) GetUnusedTags() ([]models.TagResponse, error) {
	args := m.Called()
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]models.TagResponse), args.Error(1)
}

func (m *MockTagService) GetTagAnalytics(tagID string) (*models.TagAnalytics, error) {
	args := m.Called(tagID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.TagAnalytics), args.Error(1)
}

func (m *MockTagService) DeleteTag(tagID string) error {
	args := m.Called(tagID)
	return args.Error(0)
}

func (m *MockTagService) UpdateTag(tagID string, request *models.UpdateTagRequest) (*models.Tag, error) {
	args := m.Called(tagID, request)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Tag), args.Error(1)
}

func (m *MockTagService) MergeTags(sourceTagIDs []string, targetTagID string) error {
	args := m.Called(sourceTagIDs, targetTagID)
	return args.Error(0)
}

func (m *MockTagService) GetRelatedTags(tagID string, limit int) ([]models.TagResponse, error) {
	args := m.Called(tagID, limit)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]models.TagResponse), args.Error(1)
}

func (m *MockTagService) CleanupUnusedTags() (int, error) {
	args := m.Called()
	return args.Int(0), args.Error(1)
}

func (m *MockTagService) ValidateTagNames(tagNames []string) error {
	args := m.Called(tagNames)
	return args.Error(0)
}

func (m *MockTagService) SearchTags(query string, limit, offset int) (*models.TagList, error) {
	args := m.Called(query, limit, offset)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.TagList), args.Error(1)
}

// TagsHandlerTestSuite contains all tests for the TagsHandler
type TagsHandlerTestSuite struct {
	suite.Suite
	handler     *TagsHandler
	mockService *MockTagService
	router      *mux.Router
	testUser    *models.User
}

// SetupTest runs before each test
func (suite *TagsHandlerTestSuite) SetupTest() {
	suite.mockService = new(MockTagService)
	suite.handler = NewTagsHandler(suite.mockService)
	suite.router = mux.NewRouter()
	suite.testUser = &models.User{
		ID:    uuid.New(),
		Email: "test@example.com",
		Name:  "Test User",
	}
}

// createAuthenticatedRequest creates an HTTP request with user context
func (suite *TagsHandlerTestSuite) createAuthenticatedRequest(method, path string, body interface{}) *http.Request {
	var reqBody *bytes.Buffer
	if body != nil {
		jsonBody, _ := json.Marshal(body)
		reqBody = bytes.NewBuffer(jsonBody)
	} else {
		reqBody = bytes.NewBuffer(nil)
	}

	req := httptest.NewRequest(method, path, reqBody)
	req.Header.Set("Content-Type", "application/json")

	// Add user context
	ctx := context.WithValue(req.Context(), "user", suite.testUser)
	return req.WithContext(ctx)
}

// TestCreateTag tests the CreateTag handler
func (suite *TagsHandlerTestSuite) TestCreateTag() {
	tests := []struct {
		name           string
		requestBody    interface{}
		mockSetup      func()
		expectedStatus int
		expectedBody   string
	}{
		{
			name: "successful tag creation",
			requestBody: models.CreateTagRequest{
				Name: "#work",
			},
			mockSetup: func() {
				tag := &models.Tag{
					ID:        uuid.New(),
					Name:      "#work",
					CreatedAt: time.Now(),
				}
				suite.mockService.On("CreateTag", mock.AnythingOfType("*models.CreateTagRequest")).Return(tag, nil)
			},
			expectedStatus: http.StatusCreated,
		},
		{
			name:           "invalid JSON",
			requestBody:    "invalid json",
			mockSetup:      func() {},
			expectedStatus: http.StatusBadRequest,
			expectedBody:   "Invalid request payload",
		},
		{
			name: "tag already exists",
			requestBody: models.CreateTagRequest{
				Name: "#duplicate",
			},
			mockSetup: func() {
				suite.mockService.On("CreateTag", mock.AnythingOfType("*models.CreateTagRequest")).Return(nil, assert.AnError)
			},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:        "unauthenticated request",
			requestBody: models.CreateTagRequest{Name: "#test"},
			mockSetup:   func() {},
			// This test will create a request without user context
		},
	}

	for _, tt := range tests {
		suite.Run(tt.name, func() {
			tt.mockSetup()

			var req *http.Request
			if tt.name == "unauthenticated request" {
				// Create request without user context
				jsonBody, _ := json.Marshal(tt.requestBody)
				req = httptest.NewRequest("POST", "/api/tags", bytes.NewBuffer(jsonBody))
				req.Header.Set("Content-Type", "application/json")
			} else {
				req = suite.createAuthenticatedRequest("POST", "/api/tags", tt.requestBody)
			}

			rr := httptest.NewRecorder()
			suite.handler.CreateTag(rr, req)

			assert.Equal(suite.T(), tt.expectedStatus, rr.Code)

			if tt.expectedBody != "" {
				var response map[string]interface{}
				err := json.Unmarshal(rr.Body.Bytes(), &response)
				assert.NoError(suite.T(), err)
				assert.Equal(suite.T(), tt.expectedBody, response["error"])
			}

			suite.mockService.AssertExpectations(suite.T())
		})
	}
}

// TestGetTag tests the GetTag handler
func (suite *TagsHandlerTestSuite) TestGetTag() {
	tagID := uuid.New()

	tests := []struct {
		name           string
		tagID          string
		mockSetup      func()
		expectedStatus int
		expectedError  string
	}{
		{
			name:  "successful tag retrieval",
			tagID: tagID.String(),
			mockSetup: func() {
				tag := &models.Tag{
					ID:        tagID,
					Name:      "#test",
					CreatedAt: time.Now(),
				}
				suite.mockService.On("GetTagByID", tagID.String()).Return(tag, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:  "tag not found",
			tagID: uuid.New().String(),
			mockSetup: func() {
				suite.mockService.On("GetTagByID", mock.AnythingOfType("string")).Return(nil, assert.AnError)
			},
			expectedStatus: http.StatusNotFound,
		},
	}

	for _, tt := range tests {
		suite.Run(tt.name, func() {
			tt.mockSetup()

			req := suite.createAuthenticatedRequest("GET", "/api/tags/"+tt.tagID, nil)
			rr := httptest.NewRecorder()

			// Use mux router to handle URL parameters
			suite.router.HandleFunc("/api/tags/{id}", suite.handler.GetTag).Methods("GET")
			suite.router.ServeHTTP(rr, req)

			assert.Equal(suite.T(), tt.expectedStatus, rr.Code)

			if tt.expectedStatus == http.StatusOK {
				var response models.TagResponse
				err := json.Unmarshal(rr.Body.Bytes(), &response)
				assert.NoError(suite.T(), err)
				assert.Equal(suite.T(), tt.tagID, response.ID.String())
			}

			suite.mockService.AssertExpectations(suite.T())
		})
	}
}

// TestListTags tests the ListTags handler
func (suite *TagsHandlerTestSuite) TestListTags() {
	tests := []struct {
		name           string
		queryParams    string
		mockSetup      func()
		expectedStatus int
	}{
		{
			name:        "successful tag listing",
			queryParams: "?limit=10&offset=0&orderBy=name&orderDir=asc",
			mockSetup: func() {
				tagList := &models.TagList{
					Tags: []models.TagResponse{
						{ID: uuid.New(), Name: "#test1", CreatedAt: time.Now()},
						{ID: uuid.New(), Name: "#test2", CreatedAt: time.Now()},
					},
					Total:  2,
					Page:   1,
					Limit:  10,
					HasMore: false,
				}
				suite.mockService.On("ListTags", 10, 0, "name", "asc").Return(tagList, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:        "service error",
			queryParams: "?limit=20&offset=0",
			mockSetup: func() {
				suite.mockService.On("ListTags", 20, 0, "name", "asc").Return(nil, assert.AnError)
			},
			expectedStatus: http.StatusInternalServerError,
		},
		{
			name:        "invalid limit parameter",
			queryParams: "?limit=invalid",
			mockSetup:   func() {},
			expectedStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		suite.Run(tt.name, func() {
			tt.mockSetup()

			req := suite.createAuthenticatedRequest("GET", "/api/tags"+tt.queryParams, nil)
			rr := httptest.NewRecorder()

			suite.handler.ListTags(rr, req)

			assert.Equal(suite.T(), tt.expectedStatus, rr.Code)

			if tt.expectedStatus == http.StatusOK {
				var response models.TagList
				err := json.Unmarshal(rr.Body.Bytes(), &response)
				assert.NoError(suite.T(), err)
				assert.Greater(suite.T(), len(response.Tags), 0)
			}

			suite.mockService.AssertExpectations(suite.T())
		})
	}
}

// TestUpdateTag tests the UpdateTag handler
func (suite *TagsHandlerTestSuite) TestUpdateTag() {
	tagID := uuid.New()

	tests := []struct {
		name           string
		tagID          string
		requestBody    interface{}
		mockSetup      func()
		expectedStatus int
	}{
		{
			name:  "successful tag update",
			tagID: tagID.String(),
			requestBody: models.UpdateTagRequest{
				Name: "#updated",
			},
			mockSetup: func() {
				tag := &models.Tag{
					ID:        tagID,
					Name:      "#updated",
					CreatedAt: time.Now(),
				}
				suite.mockService.On("UpdateTag", tagID.String(), mock.AnythingOfType("*models.UpdateTagRequest")).Return(tag, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:  "tag not found",
			tagID: uuid.New().String(),
			requestBody: models.UpdateTagRequest{
				Name: "#updated",
			},
			mockSetup: func() {
				suite.mockService.On("UpdateTag", mock.AnythingOfType("string"), mock.AnythingOfType("*models.UpdateTagRequest")).Return(nil, assert.AnError)
			},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "invalid JSON",
			tagID:          tagID.String(),
			requestBody:    "invalid json",
			mockSetup:      func() {},
			expectedStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		suite.Run(tt.name, func() {
			tt.mockSetup()

			req := suite.createAuthenticatedRequest("PUT", "/api/tags/"+tt.tagID, tt.requestBody)
			rr := httptest.NewRecorder()

			// Use mux router to handle URL parameters
			suite.router.HandleFunc("/api/tags/{id}", suite.handler.UpdateTag).Methods("PUT")
			suite.router.ServeHTTP(rr, req)

			assert.Equal(suite.T(), tt.expectedStatus, rr.Code)

			suite.mockService.AssertExpectations(suite.T())
		})
	}
}

// TestDeleteTag tests the DeleteTag handler
func (suite *TagsHandlerTestSuite) TestDeleteTag() {
	tagID := uuid.New()

	tests := []struct {
		name           string
		tagID          string
		mockSetup      func()
		expectedStatus int
	}{
		{
			name:  "successful tag deletion",
			tagID: tagID.String(),
			mockSetup: func() {
				suite.mockService.On("DeleteTag", tagID.String()).Return(nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:  "tag not found",
			tagID: uuid.New().String(),
			mockSetup: func() {
				suite.mockService.On("DeleteTag", mock.AnythingOfType("string")).Return(assert.AnError)
			},
			expectedStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		suite.Run(tt.name, func() {
			tt.mockSetup()

			req := suite.createAuthenticatedRequest("DELETE", "/api/tags/"+tt.tagID, nil)
			rr := httptest.NewRecorder()

			// Use mux router to handle URL parameters
			suite.router.HandleFunc("/api/tags/{id}", suite.handler.DeleteTag).Methods("DELETE")
			suite.router.ServeHTTP(rr, req)

			assert.Equal(suite.T(), tt.expectedStatus, rr.Code)

			suite.mockService.AssertExpectations(suite.T())
		})
	}
}

// TestGetTagSuggestions tests the GetTagSuggestions handler
func (suite *TagsHandlerTestSuite) TestGetTagSuggestions() {
	tests := []struct {
		name           string
		queryParams    string
		mockSetup      func()
		expectedStatus int
	}{
		{
			name:        "successful suggestions",
			queryParams: "?q=test&limit=5",
			mockSetup: func() {
				suggestions := []string{"#test1", "#test2", "#testing"}
				suite.mockService.On("GetTagSuggestions", "test", 5).Return(suggestions, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:        "service error",
			queryParams: "?q=test",
			mockSetup: func() {
				suite.mockService.On("GetTagSuggestions", "test", 10).Return(nil, assert.AnError)
			},
			expectedStatus: http.StatusInternalServerError,
		},
		{
			name:        "missing query parameter",
			queryParams: "",
			mockSetup:   func() {},
			expectedStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		suite.Run(tt.name, func() {
			tt.mockSetup()

			req := suite.createAuthenticatedRequest("GET", "/api/tags/suggestions"+tt.queryParams, nil)
			rr := httptest.NewRecorder()

			suite.handler.GetTagSuggestions(rr, req)

			assert.Equal(suite.T(), tt.expectedStatus, rr.Code)

			if tt.expectedStatus == http.StatusOK {
				var response []string
				err := json.Unmarshal(rr.Body.Bytes(), &response)
				assert.NoError(suite.T(), err)
				assert.Greater(suite.T(), len(response), 0)
			}

			suite.mockService.AssertExpectations(suite.T())
		})
	}
}

// TestGetPopularTags tests the GetPopularTags handler
func (suite *TagsHandlerTestSuite) TestGetPopularTags() {
	tests := []struct {
		name           string
		queryParams    string
		mockSetup      func()
		expectedStatus int
	}{
		{
			name:        "successful popular tags",
			queryParams: "?limit=10",
			mockSetup: func() {
				popularTags := []models.TagResponse{
					{ID: uuid.New(), Name: "#work", CreatedAt: time.Now()},
					{ID: uuid.New(), Name: "#personal", CreatedAt: time.Now()},
				}
				suite.mockService.On("GetPopularTags", 10).Return(popularTags, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:        "service error",
			queryParams: "",
			mockSetup: func() {
				suite.mockService.On("GetPopularTags", 20).Return(nil, assert.AnError)
			},
			expectedStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		suite.Run(tt.name, func() {
			tt.mockSetup()

			req := suite.createAuthenticatedRequest("GET", "/api/tags/popular"+tt.queryParams, nil)
			rr := httptest.NewRecorder()

			suite.handler.GetPopularTags(rr, req)

			assert.Equal(suite.T(), tt.expectedStatus, rr.Code)

			if tt.expectedStatus == http.StatusOK {
				var response []models.TagResponse
				err := json.Unmarshal(rr.Body.Bytes(), &response)
				assert.NoError(suite.T(), err)
				assert.Greater(suite.T(), len(response), 0)
			}

			suite.mockService.AssertExpectations(suite.T())
		})
	}
}

// TestGetUnusedTags tests the GetUnusedTags handler
func (suite *TagsHandlerTestSuite) TestGetUnusedTags() {
	tests := []struct {
		name           string
		mockSetup      func()
		expectedStatus int
	}{
		{
			name: "successful unused tags",
			mockSetup: func() {
				unusedTags := []models.TagResponse{
					{ID: uuid.New(), Name: "#old", CreatedAt: time.Now()},
					{ID: uuid.New(), Name: "#unused", CreatedAt: time.Now()},
				}
				suite.mockService.On("GetUnusedTags").Return(unusedTags, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name: "service error",
			mockSetup: func() {
				suite.mockService.On("GetUnusedTags").Return(nil, assert.AnError)
			},
			expectedStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		suite.Run(tt.name, func() {
			tt.mockSetup()

			req := suite.createAuthenticatedRequest("GET", "/api/tags/unused", nil)
			rr := httptest.NewRecorder()

			suite.handler.GetUnusedTags(rr, req)

			assert.Equal(suite.T(), tt.expectedStatus, rr.Code)

			if tt.expectedStatus == http.StatusOK {
				var response []models.TagResponse
				err := json.Unmarshal(rr.Body.Bytes(), &response)
				assert.NoError(suite.T(), err)
			}

			suite.mockService.AssertExpectations(suite.T())
		})
	}
}

// TestTagsHandlerIntegration tests integration with real database
type TagsHandlerIntegrationTestSuite struct {
	suite.Suite
	db          *sql.DB
	router      *mux.Router
	tagHandler  *TagsHandler
	userID      uuid.UUID
	userEmail   string
	authToken   string
}

func (suite *TagsHandlerIntegrationTestSuite) SetupSuite() {
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

	// Create services and handlers
	tagService := services.NewTagService(db)
	suite.tagHandler = NewTagsHandler(tagService)

	// Setup router
	suite.router = mux.NewRouter()
	setupTagRoutes(suite.router, suite.tagHandler)

	// Create test user and get auth token
	suite.userID = uuid.New()
	suite.userEmail = "test@example.com"
	suite.authToken = "test-token"
}

func (suite *TagsHandlerIntegrationTestSuite) TearDownSuite() {
	if suite.db != nil {
		suite.db.Close()
	}
}

func (suite *TagsHandlerIntegrationTestSuite) SetupTest() {
	// Clean up test data
	tables := []string{"note_tags", "tags", "notes", "users"}
	for _, table := range tables {
		_, err := suite.db.Exec(fmt.Sprintf("DELETE FROM %s WHERE id LIKE 'test-%%'", table))
		if err != nil {
			suite.T().Logf("Warning: Failed to clean up table %s: %v", table, err)
		}
	}

	// Create test user
	query := `
		INSERT INTO users (id, google_id, email, name, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6)
	`
	_, err := suite.db.Exec(query, suite.userID, "google_"+suite.userID.String(),
		suite.userEmail, "Test User", time.Now(), time.Now())
	require.NoError(suite.T(), err)
}

func setupTagRoutes(router *mux.Router, handler *TagsHandler) {
	// Tag CRUD operations
	router.HandleFunc("/api/tags", handler.CreateTag).Methods("POST")
	router.HandleFunc("/api/tags", handler.ListTags).Methods("GET")
	router.HandleFunc("/api/tags/{id}", handler.GetTag).Methods("GET")
	router.HandleFunc("/api/tags/{id}", handler.UpdateTag).Methods("PUT")
	router.HandleFunc("/api/tags/{id}", handler.DeleteTag).Methods("DELETE")

	// Tag utilities
	router.HandleFunc("/api/tags/suggestions", handler.GetTagSuggestions).Methods("GET")
	router.HandleFunc("/api/tags/popular", handler.GetPopularTags).Methods("GET")
	router.HandleFunc("/api/tags/unused", handler.GetUnusedTags).Methods("GET")
}

func (suite *TagsHandlerIntegrationTestSuite) createAuthenticatedRequest(method, path string, body interface{}) *http.Request {
	var reqBody *bytes.Buffer
	if body != nil {
		jsonBody, _ := json.Marshal(body)
		reqBody = bytes.NewBuffer(jsonBody)
	} else {
		reqBody = bytes.NewBuffer(nil)
	}

	req := httptest.NewRequest(method, path, reqBody)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+suite.authToken)

	// Add user context (in real implementation, this would be done by auth middleware)
	user := &models.User{
		ID:    suite.userID,
		Email: suite.userEmail,
		Name:  "Test User",
	}
	ctx := context.WithValue(req.Context(), "user", user)
	return req.WithContext(ctx)
}

// TestTagsHandlerIntegration runs integration tests
func TestTagsHandlerIntegration(t *testing.T) {
	suite.Run(t, new(TagsHandlerIntegrationTestSuite))
}

// TestTagsHandler runs the mock-based tests
func TestTagsHandler(t *testing.T) {
	suite.Run(t, new(TagsHandlerTestSuite))
}