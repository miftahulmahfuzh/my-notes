package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gpd/my-notes/internal/handlers"
	"github.com/gpd/my-notes/internal/models"
	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// Helper function to create test session
func createTestSession(t *testing.T) *models.UserSession {
	return &models.UserSession{
		ID:        uuid.New().String(),
		UserID:    uuid.New().String(),
		IPAddress: "127.0.0.1",
		UserAgent: "Mozilla/5.0",
		CreatedAt: time.Now(),
		LastSeen:  time.Now(),
		IsActive:  true,
	}
}

// Helper function to set up user context in request
func setupUserContext(req *http.Request, user *models.User) *http.Request {
	ctx := context.WithValue(req.Context(), "user", user)
	return req.WithContext(ctx)
}

func TestGetUserProfile(t *testing.T) {
	mockUserService := &MockUserService{}
	userHandler := handlers.NewUserHandler(mockUserService)

	tests := []struct {
		name           string
		setupContext   func(*http.Request) *http.Request
		setupMocks     func(*MockUserService)
		expectedStatus int
		expectedError  string
	}{
		{
			name: "successful profile retrieval",
			setupContext: func(req *http.Request) *http.Request {
				user := createTestUser()
				return setupUserContext(req, user)
			},
			setupMocks: func(m *MockUserService) {
				// No mocks needed for this test since we get user from context
			},
			expectedStatus: http.StatusOK,
		},
		{
			name: "unauthenticated user",
			setupContext: func(req *http.Request) *http.Request {
				return req // No user context
			},
			setupMocks: func(m *MockUserService) {
				// No mocks needed
			},
			expectedStatus: http.StatusUnauthorized,
			expectedError:  "User not authenticated",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/api/v1/users/profile", nil)
			req = tt.setupContext(req)

			tt.setupMocks(mockUserService)

			w := httptest.NewRecorder()
			userHandler.GetUserProfile(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)

			if tt.expectedError != "" {
				var response map[string]string
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedError, response["error"])
			} else {
				var response models.UserResponse
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Equal(t, "test@example.com", response.Email)
			}

			mockUserService.AssertExpectations(t)
		})
	}
}

func TestUpdateUserProfile(t *testing.T) {

	tests := []struct {
		name           string
		requestBody    string
		setupContext   func(*http.Request) *http.Request
		setupMocks     func(*MockUserService)
		expectedStatus int
		expectedError  string
	}{
		{
			name:        "successful profile update",
			requestBody: `{"name": "Updated Name", "avatar_url": "https://example.com/new-avatar.jpg"}`,
			setupContext: func(req *http.Request) *http.Request {
				user := createTestUser()
				return setupUserContext(req, user)
			},
			setupMocks: func(m *MockUserService) {
				user := createTestUser()
				user.Name = "Updated Name"
				newAvatarURL := "https://example.com/new-avatar.jpg"
				user.AvatarURL = &newAvatarURL
				m.On("Update", mock.AnythingOfType("*models.User")).Return(user, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:        "partial profile update",
			requestBody: `{"name": "New Name Only"}`,
			setupContext: func(req *http.Request) *http.Request {
				user := createTestUser()
				return setupUserContext(req, user)
			},
			setupMocks: func(m *MockUserService) {
				user := createTestUser()
				user.Name = "New Name Only"
				m.On("Update", mock.AnythingOfType("*models.User")).Return(user, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:         "unauthenticated user",
			requestBody:  `{"name": "Updated Name"}`,
			setupContext: func(req *http.Request) *http.Request {
				return req // No user context
			},
			setupMocks: func(m *MockUserService) {
				// No mocks needed
			},
			expectedStatus: http.StatusUnauthorized,
			expectedError:  "User not authenticated",
		},
		{
			name:         "invalid JSON",
			requestBody:  `invalid json`,
			setupContext: func(req *http.Request) *http.Request {
				user := createTestUser()
				return setupUserContext(req, user)
			},
			setupMocks: func(m *MockUserService) {
				// No mocks needed
			},
			expectedStatus: http.StatusBadRequest,
			expectedError:  "Invalid request body",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create fresh mock for each test to avoid expectation conflicts
			mockUserService := &MockUserService{}
			userHandler := handlers.NewUserHandler(mockUserService)

			req := httptest.NewRequest("PUT", "/api/v1/users/profile", bytes.NewBufferString(tt.requestBody))
			req.Header.Set("Content-Type", "application/json")
			req = tt.setupContext(req)

			tt.setupMocks(mockUserService)

			w := httptest.NewRecorder()
			userHandler.UpdateUserProfile(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)

			if tt.expectedError != "" {
				var response map[string]string
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedError, response["error"])
			} else {
				var response models.UserResponse
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				// Verify the update was applied
				if tt.requestBody != `invalid json` {
					// Extract the name from the request body to check against response
					var reqBody struct {
						Name *string `json:"name,omitempty"`
					}
					json.Unmarshal([]byte(tt.requestBody), &reqBody)
					if reqBody.Name != nil {
						assert.Equal(t, *reqBody.Name, response.Name)
					}
				}
			}

			mockUserService.AssertExpectations(t)
		})
	}
}

func TestGetUserPreferences(t *testing.T) {

	tests := []struct {
		name           string
		setupContext   func(*http.Request) *http.Request
		setupMocks     func(*MockUserService)
		expectedStatus int
		expectedError  string
	}{
		{
			name: "successful preferences retrieval",
			setupContext: func(req *http.Request) *http.Request {
				user := createTestUser()
				return setupUserContext(req, user)
			},
			setupMocks: func(m *MockUserService) {
				// No mocks needed since we get preferences from user in context
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:         "unauthenticated user",
			setupContext: func(req *http.Request) *http.Request {
				return req // No user context
			},
			setupMocks: func(m *MockUserService) {
				// No mocks needed
			},
			expectedStatus: http.StatusUnauthorized,
			expectedError:  "User not authenticated",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create fresh mock for each test to avoid expectation conflicts
			mockUserService := &MockUserService{}
			userHandler := handlers.NewUserHandler(mockUserService)

			req := httptest.NewRequest("GET", "/api/v1/users/preferences", nil)
			req = tt.setupContext(req)

			tt.setupMocks(mockUserService)

			w := httptest.NewRecorder()
			userHandler.GetUserPreferences(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)

			if tt.expectedError != "" {
				var response map[string]string
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedError, response["error"])
			} else {
				var response models.UserPreferences
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Equal(t, "dark", response.Theme) // Mock user has dark theme by default
				assert.Equal(t, "en", response.Language)
			}

			mockUserService.AssertExpectations(t)
		})
	}
}

func TestUpdateUserPreferences(t *testing.T) {

	tests := []struct {
		name           string
		requestBody    string
		setupContext   func(*http.Request) *http.Request
		setupMocks     func(*MockUserService)
		expectedStatus int
		expectedError  string
	}{
		{
			name:        "successful preferences update",
			requestBody: `{"theme": "dark", "language": "fr", "auto_save": false, "timezone": "America/New_York", "default_note_view": "grid"}`,
			setupContext: func(req *http.Request) *http.Request {
				user := createTestUser()
				return setupUserContext(req, user)
			},
			setupMocks: func(m *MockUserService) {
				user := createTestUser()
				user.Preferences.Theme = "dark"
				user.Preferences.Language = "fr"
				user.Preferences.AutoSave = false
				user.Preferences.TimeZone = "America/New_York"
				user.Preferences.DefaultNoteView = "grid"
				m.On("Update", mock.AnythingOfType("*models.User")).Return(user, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:         "unauthenticated user",
			requestBody:  `{"theme": "dark"}`,
			setupContext: func(req *http.Request) *http.Request {
				return req // No user context
			},
			setupMocks: func(m *MockUserService) {
				// No mocks needed
			},
			expectedStatus: http.StatusUnauthorized,
			expectedError:  "User not authenticated",
		},
		{
			name:         "invalid theme",
			requestBody:  `{"theme": "invalid"}`,
			setupContext: func(req *http.Request) *http.Request {
				user := createTestUser()
				return setupUserContext(req, user)
			},
			setupMocks: func(m *MockUserService) {
				// No mocks needed - validation happens before service call
				// Don't expect Update to be called since validation fails
			},
			expectedStatus: http.StatusBadRequest,
			expectedError:  "Invalid theme value",
		},
		{
			name:         "invalid default note view",
			requestBody:  `{"theme": "light", "default_note_view": "invalid"}`,
			setupContext: func(req *http.Request) *http.Request {
				user := createTestUser()
				return setupUserContext(req, user)
			},
			setupMocks: func(m *MockUserService) {
				// No mocks needed - validation happens before service call
				// Don't expect Update to be called since validation fails
			},
			expectedStatus: http.StatusBadRequest,
			expectedError:  "Invalid default note view value",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create fresh mock for each test to avoid expectation conflicts
			mockUserService := &MockUserService{}
			userHandler := handlers.NewUserHandler(mockUserService)

			req := httptest.NewRequest("PUT", "/api/v1/users/preferences", bytes.NewBufferString(tt.requestBody))
			req.Header.Set("Content-Type", "application/json")
			req = tt.setupContext(req)

			tt.setupMocks(mockUserService)

			w := httptest.NewRecorder()
			userHandler.UpdateUserPreferences(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)

			if w.Code != tt.expectedStatus {
				// Debug: print the actual response for debugging
				t.Logf("Test '%s' failed. Actual response body: %s", tt.name, string(w.Body.Bytes()))
			}

			if tt.expectedError != "" {
				var response map[string]string
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedError, response["error"])
			} else {
				var response models.UserPreferences
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				// Verify the update was applied
				if tt.requestBody != `{"theme": "invalid"}` && tt.requestBody != `{"theme": "light", "default_note_view": "invalid"}` {
					assert.Equal(t, "dark", response.Theme) // Should match the request
					assert.Equal(t, "grid", response.DefaultNoteView) // Should match the request
				}
			}

			mockUserService.AssertExpectations(t)
		})
	}
}

func TestGetUserSessions(t *testing.T) {
	mockUserService := &MockUserService{}
	userHandler := handlers.NewUserHandler(mockUserService)

	tests := []struct {
		name           string
		setupContext   func(*http.Request) *http.Request
		setupMocks     func(*MockUserService)
		expectedStatus int
		expectedError  string
	}{
		{
			name: "successful sessions retrieval",
			setupContext: func(req *http.Request) *http.Request {
				user := createTestUser()
				return setupUserContext(req, user)
			},
			setupMocks: func(m *MockUserService) {
				sessions := []models.UserSession{*createTestSession(t)}
				m.On("GetActiveSessions", mock.AnythingOfType("string")).Return(sessions, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:         "unauthenticated user",
			setupContext: func(req *http.Request) *http.Request {
				return req // No user context
			},
			setupMocks: func(m *MockUserService) {
				// No mocks needed
			},
			expectedStatus: http.StatusUnauthorized,
			expectedError:  "User not authenticated",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/api/v1/users/sessions", nil)
			req = tt.setupContext(req)

			tt.setupMocks(mockUserService)

			w := httptest.NewRecorder()
			userHandler.GetUserSessions(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)

			if tt.expectedError != "" {
				var response map[string]string
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedError, response["error"])
			} else {
				var response map[string]interface{}
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Contains(t, response, "sessions")
				assert.Contains(t, response, "total")
			}

			mockUserService.AssertExpectations(t)
		})
	}
}

func TestDeleteUserSession(t *testing.T) {
	mockUserService := &MockUserService{}
	userHandler := handlers.NewUserHandler(mockUserService)

	tests := []struct {
		name           string
		sessionID      string
		setupContext   func(*http.Request) *http.Request
		setupMocks     func(*MockUserService)
		expectedStatus int
		expectedError  string
	}{
		{
			name:      "successful session deletion",
			sessionID: "session-123",
			setupContext: func(req *http.Request) *http.Request {
				user := createTestUser()
				req = mux.SetURLVars(req, map[string]string{"sessionId": "session-123"})
				return setupUserContext(req, user)
			},
			setupMocks: func(m *MockUserService) {
				m.On("DeleteSession", "session-123", mock.AnythingOfType("string")).Return(nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:      "missing session ID",
			sessionID: "",
			setupContext: func(req *http.Request) *http.Request {
				user := createTestUser()
				req = mux.SetURLVars(req, map[string]string{})
				return setupUserContext(req, user)
			},
			setupMocks: func(m *MockUserService) {
				// No mocks needed
			},
			expectedStatus: http.StatusBadRequest,
			expectedError:  "Session ID is required",
		},
		{
			name:      "unauthenticated user",
			sessionID: "session-123",
			setupContext: func(req *http.Request) *http.Request {
				req = mux.SetURLVars(req, map[string]string{"sessionId": "session-123"})
				return req // No user context
			},
			setupMocks: func(m *MockUserService) {
				// No mocks needed
			},
			expectedStatus: http.StatusUnauthorized,
			expectedError:  "User not authenticated",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("DELETE", "/api/v1/users/sessions/"+tt.sessionID, nil)
			req = tt.setupContext(req)

			tt.setupMocks(mockUserService)

			w := httptest.NewRecorder()
			userHandler.DeleteUserSession(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)

			if tt.expectedError != "" {
				var response map[string]string
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedError, response["error"])
			} else {
				var response map[string]string
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Equal(t, "Session deleted successfully", response["message"])
			}

			mockUserService.AssertExpectations(t)
		})
	}
}

func TestGetUserStats(t *testing.T) {
	mockUserService := &MockUserService{}
	userHandler := handlers.NewUserHandler(mockUserService)

	tests := []struct {
		name           string
		setupContext   func(*http.Request) *http.Request
		setupMocks     func(*MockUserService)
		expectedStatus int
		expectedError  string
	}{
		{
			name: "successful stats retrieval",
			setupContext: func(req *http.Request) *http.Request {
				user := createTestUser()
				return setupUserContext(req, user)
			},
			setupMocks: func(m *MockUserService) {
				stats := &models.UserStats{
					TotalNotes:     42,
					TotalTags:      15,
					ActiveSessions: 3,
					AccountAgeDays: 30,
					LastLoginAt:    time.Now().Format(time.RFC3339),
				}
				m.On("GetUserStats", mock.AnythingOfType("string")).Return(stats, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:         "unauthenticated user",
			setupContext: func(req *http.Request) *http.Request {
				return req // No user context
			},
			setupMocks: func(m *MockUserService) {
				// No mocks needed
			},
			expectedStatus: http.StatusUnauthorized,
			expectedError:  "User not authenticated",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/api/v1/users/stats", nil)
			req = tt.setupContext(req)

			tt.setupMocks(mockUserService)

			w := httptest.NewRecorder()
			userHandler.GetUserStats(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)

			if tt.expectedError != "" {
				var response map[string]string
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedError, response["error"])
			} else {
				var response models.UserStats
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Equal(t, 42, response.TotalNotes)
			}

			mockUserService.AssertExpectations(t)
		})
	}
}