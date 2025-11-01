package tests

import (
	"testing"
	"time"

	"github.com/gpd/my-notes/internal/models"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestUserValidation(t *testing.T) {
	tests := []struct {
		name        string
		user        *models.User
		expectError bool
		errorMsg    string
	}{
		{
			name: "Valid user",
			user: &models.User{
				GoogleID: "google_123",
				Email:    "test@example.com",
				Name:     "Test User",
			},
			expectError: false,
		},
		{
			name: "Missing Google ID",
			user: &models.User{
				Email: "test@example.com",
				Name:  "Test User",
			},
			expectError: true,
			errorMsg:    "google_id is required",
		},
		{
			name: "Missing email",
			user: &models.User{
				GoogleID: "google_123",
				Name:     "Test User",
			},
			expectError: true,
			errorMsg:    "email is required",
		},
		{
			name: "Missing name",
			user: &models.User{
				GoogleID: "google_123",
				Email:    "test@example.com",
			},
			expectError: true,
			errorMsg:    "name is required",
		},
		{
			name: "Email too long",
			user: &models.User{
				GoogleID: "google_123",
				Email:    "verylongemailaddressthatdefinitelyexceedsthesecondhundredandfiftyfivecharacterlimitforvalidationpurposesandsomeextratexttomakesureitlongenoughandthiswilldefinitelybeover255characterslongenoughforvalidationtotriggeranerrorandmoretexttoensureitexceedsthelimit@example.com",
				Name:     "Test User",
			},
			expectError: true,
			errorMsg:    "email too long",
		},
		{
			name: "Name too long",
			user: &models.User{
				GoogleID: "google_123",
				Email:    "test@example.com",
				Name:     string(make([]byte, 300)), // 300 characters
			},
			expectError: true,
			errorMsg:    "name too long",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.user.Validate()

			if tt.expectError {
				assert.Error(t, err)
				if tt.errorMsg != "" {
					assert.Contains(t, err.Error(), tt.errorMsg)
				}
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestUserResponse(t *testing.T) {
	user := &models.User{
		ID:        uuid.New(),
		GoogleID:  "google_123",
		Email:    "test@example.com",
		Name:     "Test User",
		AvatarURL: stringPtr("http://example.com/avatar.jpg"),
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	response := user.ToResponse()

	assert.Equal(t, user.ID, response.ID)
	assert.Equal(t, user.Email, response.Email)
	assert.Equal(t, user.Name, response.Name)
	assert.Equal(t, user.AvatarURL, response.AvatarURL)
	assert.Equal(t, user.CreatedAt, response.CreatedAt)
	// Note: GoogleID should not be in the response for security
}

func TestCreateUserRequest(t *testing.T) {
	req := &models.CreateUserRequest{
		GoogleID:  "google_123",
		Email:     "test@example.com",
		Name:      "Test User",
		AvatarURL: stringPtr("http://example.com/avatar.jpg"),
	}

	user := req.ToUser()

	assert.Equal(t, req.GoogleID, user.GoogleID)
	assert.Equal(t, req.Email, user.Email)
	assert.Equal(t, req.Name, user.Name)
	assert.Equal(t, req.AvatarURL, user.AvatarURL)
	assert.WithinDuration(t, time.Now(), user.CreatedAt, time.Second)
	assert.WithinDuration(t, time.Now(), user.UpdatedAt, time.Second)
}

func TestNoteValidation(t *testing.T) {
	userID := uuid.New()

	tests := []struct {
		name        string
		note        *models.Note
		expectError bool
		errorMsg    string
	}{
		{
			name: "Valid note",
			note: &models.Note{
				UserID:  userID,
				Title:   stringPtr("Test Note"),
				Content: "This is test content",
				Version: 1,
			},
			expectError: false,
		},
		{
			name: "Nil user ID",
			note: &models.Note{
				UserID:  uuid.Nil,
				Title:   stringPtr("Test Note"),
				Content: "This is test content",
				Version: 1,
			},
			expectError: true,
			errorMsg:    "user_id is required",
		},
		{
			name: "Empty content",
			note: &models.Note{
				UserID:  userID,
				Title:   stringPtr("Test Note"),
				Content: "",
				Version: 1,
			},
			expectError: true,
			errorMsg:    "content is required",
		},
		{
			name: "Content too long",
			note: &models.Note{
				UserID:  userID,
				Title:   stringPtr("Test Note"),
				Content: string(make([]byte, 10001)), // 10001 characters
				Version: 1,
			},
			expectError: true,
			errorMsg:    "content too long",
		},
		{
			name: "Title too long",
			note: &models.Note{
				UserID:  userID,
				Title:   stringPtr(string(make([]byte, 600))), // 600 characters
				Content: "This is test content",
				Version: 1,
			},
			expectError: true,
			errorMsg:    "title too long",
		},
		{
			name: "Version less than 1",
			note: &models.Note{
				UserID:  userID,
				Title:   stringPtr("Test Note"),
				Content: "This is test content",
				Version: 0,
			},
			expectError: true,
			errorMsg:    "version must be at least 1",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.note.Validate()

			if tt.expectError {
				assert.Error(t, err)
				if tt.errorMsg != "" {
					assert.Contains(t, err.Error(), tt.errorMsg)
				}
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestNoteExtractHashtags(t *testing.T) {
	tests := []struct {
		name     string
		content  string
		expected []string
	}{
		{
			name:     "No hashtags",
			content:  "This is a note without hashtags",
			expected: []string{},
		},
		{
			name:     "Single hashtag",
			content:  "This note has #one hashtag",
			expected: []string{"#one"},
		},
		{
			name:     "Multiple hashtags",
			content:  "This note has #multiple #hashtags #here",
			expected: []string{"#multiple", "#hashtags", "#here"},
		},
		{
			name:     "Duplicate hashtags",
			content:  "This note has #duplicate #duplicate hashtags",
			expected: []string{"#duplicate"},
		},
		{
			name:     "Hashtag with special characters",
			content:  "This note has #test123 hashtag",
			expected: []string{"#test123"},
		},
		{
			name:     "Mixed case hashtags",
			content:  "This note has #Mixed #Case hashtags",
			expected: []string{"#Mixed", "#Case"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			note := &models.Note{Content: tt.content}
			tags := note.ExtractHashtags()
			assert.Equal(t, tt.expected, tags)
		})
	}
}

func TestCreateNoteRequest(t *testing.T) {
	userID := uuid.New()

	tests := []struct {
		name     string
		req      *models.CreateNoteRequest
		expected *models.Note
	}{
		{
			name: "Note with title",
			req: &models.CreateNoteRequest{
				Title:   "Test Note",
				Content: "This is test content",
			},
			expected: &models.Note{
				UserID:    userID,
				Title:     stringPtr("Test Note"),
				Content:   "This is test content",
				Version:   1,
				CreatedAt: time.Now(),
				UpdatedAt: time.Now(),
			},
		},
		{
			name: "Note without title",
			req: &models.CreateNoteRequest{
				Content: "This is test content",
			},
			expected: &models.Note{
				UserID:    userID,
				Title:     stringPtr("This is test content"),
				Content:   "This is test content",
				Version:   1,
				CreatedAt: time.Now(),
				UpdatedAt: time.Now(),
			},
		},
		{
			name: "Note with long first line",
			req: &models.CreateNoteRequest{
				Content: "This is a very long first line that should be truncated because it exceeds fifty characters limit for auto-generated titles",
			},
			expected: &models.Note{
				UserID:    userID,
				Title:     stringPtr("This is a very long first line that should be trun..."),
				Content:   "This is a very long first line that should be truncated because it exceeds fifty characters limit for auto-generated titles",
				Version:   1,
				CreatedAt: time.Now(),
				UpdatedAt: time.Now(),
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			note := tt.req.ToNote(userID)

			assert.Equal(t, userID, note.UserID)
			assert.Equal(t, tt.req.Content, note.Content)
			assert.Equal(t, 1, note.Version)
			assert.WithinDuration(t, time.Now(), note.CreatedAt, time.Second)
			assert.WithinDuration(t, time.Now(), note.UpdatedAt, time.Second)

			if tt.req.Title != "" {
				assert.Equal(t, tt.req.Title, *note.Title)
			} else {
				// Auto-generated title should be based on first line
				assert.NotNil(t, note.Title)
			}
		})
	}
}

func TestTagValidation(t *testing.T) {
	tests := []struct {
		name        string
		tag         *models.Tag
		expectError bool
		errorMsg    string
	}{
		{
			name: "Valid tag",
			tag: &models.Tag{
				Name: "#test",
			},
			expectError: false,
		},
		{
			name: "Empty tag",
			tag: &models.Tag{
				Name: "",
			},
			expectError: true,
			errorMsg:    "name is required",
		},
		{
			name: "Tag too long",
			tag: &models.Tag{
				Name: string(make([]byte, 150)), // 150 characters
			},
			expectError: true,
			errorMsg:    "name too long",
		},
		{
			name: "Tag doesn't start with #",
			tag: &models.Tag{
				Name: "test",
			},
			expectError: true,
			errorMsg:    "tag must start with #",
		},
		{
			name: "Tag with invalid characters",
			tag: &models.Tag{
				Name: "#test@tag",
			},
			expectError: true,
			errorMsg:    "tag must start with # and contain only alphanumeric characters",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.tag.Validate()

			if tt.expectError {
				assert.Error(t, err)
				if tt.errorMsg != "" {
					assert.Contains(t, err.Error(), tt.errorMsg)
				}
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestTagSanitization(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "Valid tag",
			input:    "#test",
			expected: "#test",
		},
		{
			name:     "Tag without #",
			input:    "test",
			expected: "#test",
		},
		{
			name:     "Tag with spaces",
			input:    " #test ",
			expected: "#test",
		},
		{
			name:     "Uppercase tag",
			input:    "#TEST",
			expected: "#test",
		},
		{
			name:     "Tag with invalid characters",
			input:    "#test@tag",
			expected: "#testtag",
		},
		{
			name:     "Empty input",
			input:    "",
			expected: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tag := &models.Tag{Name: tt.input}
			tag.SanitizeName()
			assert.Equal(t, tt.expected, tag.Name)
		})
	}
}

func TestExtractTagsFromContent(t *testing.T) {
	tests := []struct {
		name     string
		content  string
		expected []string
	}{
		{
			name:     "No hashtags",
			content:  "This is a note without hashtags",
			expected: []string{},
		},
		{
			name:     "Single hashtag",
			content:  "This note has #one hashtag",
			expected: []string{"#one"},
		},
		{
			name:     "Multiple hashtags",
			content:  "This note has #multiple #hashtags #here",
			expected: []string{"#multiple", "#hashtags", "#here"},
		},
		{
			name:     "Duplicate hashtags with different cases",
			content:  "This note has #duplicate #DUPLICATE hashtags",
			expected: []string{"#duplicate"},
		},
		{
			name:     "Hashtag with spaces",
			content:  "This note has # spaced hashtag",
			expected: []string{"#spaced"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tags := models.ExtractTagsFromContent(tt.content)
			assert.Equal(t, tt.expected, tags)
		})
	}
}

// Helper function to create string pointer
func stringPtr(s string) *string {
	return &s
}