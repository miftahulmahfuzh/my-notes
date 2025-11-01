package handlers

import (
	"time"

	"github.com/gpd/my-notes/internal/auth"
	"github.com/gpd/my-notes/internal/models"
	"github.com/google/uuid"
	"github.com/stretchr/testify/mock"
)

// MockUserService is a mock implementation of UserServiceInterface for testing
type MockUserService struct {
	mock.Mock
}

func (m *MockUserService) CreateOrUpdateFromGoogle(userInfo *auth.GoogleUserInfo) (*models.User, error) {
	args := m.Called(userInfo)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.User), args.Error(1)
}

func (m *MockUserService) GetByID(userID string) (*models.User, error) {
	args := m.Called(userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.User), args.Error(1)
}

func (m *MockUserService) Update(user *models.User) (*models.User, error) {
	args := m.Called(user)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.User), args.Error(1)
}

func (m *MockUserService) Delete(userID string) error {
	args := m.Called(userID)
	return args.Error(0)
}

func (m *MockUserService) CreateSession(userID, ipAddress, userAgent string) (*models.UserSession, error) {
	args := m.Called(userID, ipAddress, userAgent)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.UserSession), args.Error(1)
}

func (m *MockUserService) UpdateSessionActivity(sessionID, ipAddress, userAgent string) error {
	args := m.Called(sessionID, ipAddress, userAgent)
	return args.Error(0)
}

func (m *MockUserService) GetActiveSessions(userID string) ([]models.UserSession, error) {
	args := m.Called(userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]models.UserSession), args.Error(1)
}

func (m *MockUserService) DeleteSession(sessionID, userID string) error {
	args := m.Called(sessionID, userID)
	return args.Error(0)
}

func (m *MockUserService) DeleteAllSessions(userID string) error {
	args := m.Called(userID)
	return args.Error(0)
}

func (m *MockUserService) GetUserStats(userID string) (*models.UserStats, error) {
	args := m.Called(userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.UserStats), args.Error(1)
}

func (m *MockUserService) SearchUsers(query string, page, limit int) ([]models.User, int, error) {
	args := m.Called(query, page, limit)
	if args.Get(0) == nil {
		return nil, args.Int(1), args.Error(2)
	}
	return args.Get(0).([]models.User), args.Int(1), args.Error(2)
}

// Helper function to create a test user
func createTestUser() *models.User {
	avatarURL := "https://example.com/avatar.jpg"
	preferences := models.UserPreferences{
		Theme:              "dark",
		Language:           "en",
		TimeZone:           "America/New_York",
		EmailNotifications: true,
		AutoSave:           true,
		DefaultNoteView:    "list",
	}

	return &models.User{
		ID:          uuid.MustParse("123e4567-e89b-12d3-a456-426614174000"),
		GoogleID:    "google123",
		Email:       "test@example.com",
		Name:        "Test User",
		AvatarURL:   &avatarURL,
		Preferences: preferences,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
}