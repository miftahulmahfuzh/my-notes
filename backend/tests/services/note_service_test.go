package services

import (
	"context"
	"testing"
	"time"

	"github.com/gpd/my-notes/internal/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// MockNoteRepository is a mock implementation of NoteRepositoryInterface
type MockNoteRepository struct {
	notes map[string]models.Note
}

func NewMockNoteRepository() *MockNoteRepository {
	return &MockNoteRepository{
		notes: make(map[string]models.Note),
	}
}

func (m *MockNoteRepository) Create(ctx context.Context, note *models.Note) error {
	note.CreatedAt = time.Now()
	note.UpdatedAt = time.Now()
	m.notes[note.ID] = *note
	return nil
}

func (m *MockNoteRepository) GetByID(ctx context.Context, id string) (*models.Note, error) {
	note, exists := m.notes[id]
	if !exists {
		return nil, ErrNoteNotFound
	}
	return &note, nil
}

func (m *MockNoteRepository) Update(ctx context.Context, note *models.Note) error {
	if _, exists := m.notes[note.ID]; !exists {
		return ErrNoteNotFound
	}
	note.UpdatedAt = time.Now()
	m.notes[note.ID] = *note
	return nil
}

func (m *MockNoteRepository) Delete(ctx context.Context, id string) error {
	if _, exists := m.notes[id]; !exists {
		return ErrNoteNotFound
	}
	delete(m.notes, id)
	return nil
}

func (m *MockNoteRepository) List(ctx context.Context, userID string, limit, offset int, orderBy, orderDir string) ([]models.Note, int64, error) {
	var notes []models.Note
	for _, note := range m.notes {
		if note.UserID == userID {
			notes = append(notes, note)
		}
	}
	return notes, int64(len(notes)), nil
}

func (m *MockNoteRepository) Search(ctx context.Context, userID string, query string, limit, offset int) ([]models.Note, int64, error) {
	var notes []models.Note
	for _, note := range m.notes {
		if note.UserID == userID &&
		   (contains(note.Title, query) || contains(note.Content, query)) {
			notes = append(notes, note)
		}
	}
	return notes, int64(len(notes)), nil
}

func (m *MockNoteRepository) GetByTag(ctx context.Context, userID, tag string, limit, offset int) ([]models.Note, int64, error) {
	var notes []models.Note
	for _, note := range m.notes {
		if note.UserID == userID && contains(note.Content, tag) {
			notes = append(notes, note)
		}
	}
	return notes, int64(len(notes)), nil
}

func (m *MockNoteRepository) GetUpdatedSince(ctx context.Context, userID string, since time.Time) ([]models.Note, error) {
	var notes []models.Note
	for _, note := range m.notes {
		if note.UserID == userID && note.UpdatedAt.After(since) {
			notes = append(notes, note)
		}
	}
	return notes, nil
}

func (m *MockNoteRepository) BatchCreate(ctx context.Context, notes []models.Note) error {
	for _, note := range notes {
		note.CreatedAt = time.Now()
		note.UpdatedAt = time.Now()
		m.notes[note.ID] = note
	}
	return nil
}

func (m *MockNoteRepository) BatchUpdate(ctx context.Context, updates []models.NoteUpdate) ([]models.Note, error) {
	var updatedNotes []models.Note
	for _, update := range updates {
		if note, exists := m.notes[update.NoteID]; exists {
			note.Title = update.Request.Title
			note.Content = update.Request.Content
			note.UpdatedAt = time.Now()
			note.Version++
			m.notes[update.NoteID] = note
			updatedNotes = append(updatedNotes, note)
		}
	}
	return updatedNotes, nil
}

func (m *MockNoteRepository) GetStats(ctx context.Context, userID string) (*models.NoteStats, error) {
	var count int64
	var oldestTime, newestTime time.Time
	first := true

	for _, note := range m.notes {
		if note.UserID == userID {
			count++
			if first {
				oldestTime = note.CreatedAt
				newestTime = note.CreatedAt
				first = false
			} else {
				if note.CreatedAt.Before(oldestTime) {
					oldestTime = note.CreatedAt
				}
				if note.CreatedAt.After(newestTime) {
					newestTime = note.CreatedAt
				}
			}
		}
	}

	return &models.NoteStats{
		TotalNotes: count,
		OldestNote: oldestTime,
		NewestNote: newestTime,
	}, nil
}

// Helper function for string contains
func contains(s, substr string) bool {
	return len(s) >= len(substr) &&
		   (s == substr ||
		    len(s) > len(substr) &&
		    (s[:len(substr)] == substr ||
		     s[len(s)-len(substr):] == substr ||
		     findSubstring(s, substr)))
}

func findSubstring(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

// Test Setup

func setupTestNoteService() (*NoteService, *MockNoteRepository) {
	repo := NewMockNoteRepository()
	service := NewNoteService(repo)
	return service, repo
}

func createTestNote(userID, title, content string) *models.CreateNoteRequest {
	return &models.CreateNoteRequest{
		Title:   title,
		Content: content,
	}
}

// Test Cases

func TestNoteService_CreateNote(t *testing.T) {
	service, repo := setupTestNoteService()
	ctx := context.Background()
	userID := "test-user-123"

	t.Run("successful note creation", func(t *testing.T) {
		request := createTestNote(userID, "Test Note", "This is a test note")

		note, err := service.CreateNote(userID, request)

		require.NoError(t, err)
		assert.NotEmpty(t, note.ID)
		assert.Equal(t, userID, note.UserID)
		assert.Equal(t, request.Title, note.Title)
		assert.Equal(t, request.Content, note.Content)
		assert.Equal(t, 1, note.Version)
		assert.NotZero(t, note.CreatedAt)
		assert.NotZero(t, note.UpdatedAt)
		assert.Equal(t, note.CreatedAt, note.UpdatedAt)
	})

	t.Run("empty content validation", func(t *testing.T) {
		request := createTestNote(userID, "Title", "")

		note, err := service.CreateNote(userID, request)

		assert.Error(t, err)
		assert.Nil(t, note)
		assert.Contains(t, err.Error(), "content is required")
	})

	t.Run("title auto-generation", func(t *testing.T) {
		request := createTestNote(userID, "", "This is content without title")

		note, err := service.CreateNote(userID, request)

		require.NoError(t, err)
		assert.NotEmpty(t, note.Title)
		assert.True(t, len(note.Title) <= 50)
	})
}

func TestNoteService_GetNote(t *testing.T) {
	service, repo := setupTestNoteService()
	ctx := context.Background()
	userID := "test-user-123"

	t.Run("existing note", func(t *testing.T) {
		request := createTestNote(userID, "Test Note", "Content")
		createdNote, _ := service.CreateNote(userID, request)

		retrievedNote, err := service.GetNote(ctx, createdNote.ID, userID)

		require.NoError(t, err)
		assert.Equal(t, createdNote.ID, retrievedNote.ID)
		assert.Equal(t, createdNote.Title, retrievedNote.Title)
		assert.Equal(t, createdNote.Content, retrievedNote.Content)
	})

	t.Run("non-existent note", func(t *testing.T) {
		note, err := service.GetNote(ctx, "non-existent-id", userID)

		assert.Error(t, err)
		assert.Nil(t, note)
		assert.Equal(t, ErrNoteNotFound, err)
	})

	t.Run("unauthorized access", func(t *testing.T) {
		request := createTestNote(userID, "Test Note", "Content")
		createdNote, _ := service.CreateNote(userID, request)

		note, err := service.GetNote(ctx, createdNote.ID, "different-user")

		assert.Error(t, err)
		assert.Nil(t, note)
		assert.Equal(t, ErrNoteNotFound, err)
	})
}

func TestNoteService_UpdateNote(t *testing.T) {
	service, repo := setupTestNoteService()
	ctx := context.Background()
	userID := "test-user-123"

	t.Run("successful update", func(t *testing.T) {
		request := createTestNote(userID, "Original Title", "Original Content")
		createdNote, _ := service.CreateNote(userID, request)

		updateRequest := &models.UpdateNoteRequest{
			Title:   "Updated Title",
			Content: "Updated Content",
			Version: 1,
		}

		updatedNote, err := service.UpdateNote(ctx, createdNote.ID, userID, updateRequest)

		require.NoError(t, err)
		assert.Equal(t, createdNote.ID, updatedNote.ID)
		assert.Equal(t, updateRequest.Title, updatedNote.Title)
		assert.Equal(t, updateRequest.Content, updatedNote.Content)
		assert.Equal(t, 2, updatedNote.Version)
		assert.True(t, updatedNote.UpdatedAt.After(updatedNote.CreatedAt))
	})

	t.Run("version mismatch", func(t *testing.T) {
		request := createTestNote(userID, "Title", "Content")
		createdNote, _ := service.CreateNote(userID, request)

		updateRequest := &models.UpdateNoteRequest{
			Title:   "Updated",
			Content: "Updated",
			Version: 99, // Wrong version
		}

		note, err := service.UpdateNote(ctx, createdNote.ID, userID, updateRequest)

		assert.Error(t, err)
		assert.Nil(t, note)
		assert.Contains(t, err.Error(), "version mismatch")
	})

	t.Run("non-existent note", func(t *testing.T) {
		updateRequest := &models.UpdateNoteRequest{
			Title:   "Updated",
			Content: "Updated",
			Version: 1,
		}

		note, err := service.UpdateNote(ctx, "non-existent", userID, updateRequest)

		assert.Error(t, err)
		assert.Nil(t, note)
		assert.Equal(t, ErrNoteNotFound, err)
	})
}

func TestNoteService_DeleteNote(t *testing.T) {
	service, repo := setupTestNoteService()
	ctx := context.Background()
	userID := "test-user-123"

	t.Run("successful deletion", func(t *testing.T) {
		request := createTestNote(userID, "Test Note", "Content")
		createdNote, _ := service.CreateNote(userID, request)

		err := service.DeleteNote(ctx, createdNote.ID, userID)

		assert.NoError(t, err)

		// Verify note is deleted
		_, err = service.GetNote(ctx, createdNote.ID, userID)
		assert.Error(t, err)
		assert.Equal(t, ErrNoteNotFound, err)
	})

	t.Run("non-existent note", func(t *testing.T) {
		err := service.DeleteNote(ctx, "non-existent", userID)

		assert.Error(t, err)
		assert.Equal(t, ErrNoteNotFound, err)
	})

	t.Run("unauthorized deletion", func(t *testing.T) {
		request := createTestNote(userID, "Test Note", "Content")
		createdNote, _ := service.CreateNote(userID, request)

		err := service.DeleteNote(ctx, createdNote.ID, "different-user")

		assert.Error(t, err)
		assert.Equal(t, ErrNoteNotFound, err)
	})
}

func TestNoteService_ListNotes(t *testing.T) {
	service, repo := setupTestNoteService()
	ctx := context.Background()
	userID := "test-user-123"

	// Create test notes
	for i := 0; i < 15; i++ {
		request := createTestNote(userID, fmt.Sprintf("Note %d", i), fmt.Sprintf("Content %d", i))
		service.CreateNote(userID, request)
	}

	t.Run("list all notes", func(t *testing.T) {
		notes, total, err := service.ListNotes(ctx, userID, 20, 0, "created_at", "desc")

		require.NoError(t, err)
		assert.Equal(t, int64(15), total)
		assert.Len(t, notes, 15)
	})

	t.Run("paginated listing", func(t *testing.T) {
		notes, total, err := service.ListNotes(ctx, userID, 5, 0, "created_at", "desc")

		require.NoError(t, err)
		assert.Equal(t, int64(15), total)
		assert.Len(t, notes, 5)
	})

	t.Run("offset pagination", func(t *testing.T) {
		notes, total, err := service.ListNotes(ctx, userID, 5, 5, "created_at", "desc")

		require.NoError(t, err)
		assert.Equal(t, int64(15), total)
		assert.Len(t, notes, 5)
	})
}

func TestNoteService_SearchNotes(t *testing.T) {
	service, repo := setupTestNoteService()
	ctx := context.Background()
	userID := "test-user-123"

	// Create test notes
	notes := []struct{ title, content string }{
		{"Shopping List", "Buy milk, eggs, and bread"},
		{"Work Meeting", "Discuss project timeline and deliverables"},
		{"Personal Notes", "Remember to call mom"},
		{"Shopping", "Buy vegetables and fruits"},
	}

	for _, note := range notes {
		request := createTestNote(userID, note.title, note.content)
		service.CreateNote(userID, request)
	}

	t.Run("search by title", func(t *testing.T) {
		foundNotes, total, err := service.SearchNotes(ctx, userID, "Shopping", 10, 0)

		require.NoError(t, err)
		assert.Equal(t, int64(2), total)
		assert.Len(t, foundNotes, 2)
	})

	t.Run("search by content", func(t *testing.T) {
		foundNotes, total, err := service.SearchNotes(ctx, userID, "milk", 10, 0)

		require.NoError(t, err)
		assert.Equal(t, int64(1), total)
		assert.Len(t, foundNotes, 1)
		assert.Equal(t, "Buy milk, eggs, and bread", foundNotes[0].Content)
	})

	t.Run("search with no results", func(t *testing.T) {
		foundNotes, total, err := service.SearchNotes(ctx, userID, "nonexistent", 10, 0)

		require.NoError(t, err)
		assert.Equal(t, int64(0), total)
		assert.Len(t, foundNotes, 0)
	})
}

func TestNoteService_BatchOperations(t *testing.T) {
	service, repo := setupTestNoteService()
	ctx := context.Background()
	userID := "test-user-123"

	t.Run("batch create", func(t *testing.T) {
		requests := []*models.CreateNoteRequest{
			{Title: "Note 1", Content: "Content 1"},
			{Title: "Note 2", Content: "Content 2"},
			{Title: "Note 3", Content: "Content 3"},
		}

		notes, err := service.BatchCreateNotes(ctx, userID, requests)

		require.NoError(t, err)
		assert.Len(t, notes, 3)

		for i, note := range notes {
			assert.Equal(t, requests[i].Title, note.Title)
			assert.Equal(t, requests[i].Content, note.Content)
			assert.Equal(t, userID, note.UserID)
		}
	})

	t.Run("batch update", func(t *testing.T) {
		// Create notes first
		requests := []*models.CreateNoteRequest{
			{Title: "Original 1", Content: "Original 1"},
			{Title: "Original 2", Content: "Original 2"},
		}
		createdNotes, _ := service.BatchCreateNotes(ctx, userID, requests)

		// Update notes
		updates := []models.NoteUpdate{
			{
				NoteID: createdNotes[0].ID,
				Request: &models.UpdateNoteRequest{
					Title:   "Updated 1",
					Content: "Updated 1",
					Version: 1,
				},
			},
			{
				NoteID: createdNotes[1].ID,
				Request: &models.UpdateNoteRequest{
					Title:   "Updated 2",
					Content: "Updated 2",
					Version: 1,
				},
			},
		}

		updatedNotes, err := service.BatchUpdateNotes(ctx, userID, updates)

		require.NoError(t, err)
		assert.Len(t, updatedNotes, 2)

		for i, note := range updatedNotes {
			assert.Equal(t, updates[i].Request.Title, note.Title)
			assert.Equal(t, updates[i].Request.Content, note.Content)
			assert.Equal(t, 2, note.Version)
		}
	})
}

func TestNoteService_ExtractHashtags(t *testing.T) {
	service, repo := setupTestNoteService()

	t.Run("multiple hashtags", func(t *testing.T) {
		content := "This is a note with #work and #personal tags"
		hashtags := service.ExtractHashtags(content)

		assert.Len(t, hashtags, 2)
		assert.Contains(t, hashtags, "#work")
		assert.Contains(t, hashtags, "#personal")
	})

	t.Run("single hashtag", func(t *testing.T) {
		content := "Just one #important tag here"
		hashtags := service.ExtractHashtags(content)

		assert.Len(t, hashtags, 1)
		assert.Equal(t, "#important", hashtags[0])
	})

	t.Run("no hashtags", func(t *testing.T) {
		content := "No tags in this note"
		hashtags := service.ExtractHashtags(content)

		assert.Len(t, hashtags, 0)
	})

	t.Run("duplicate hashtags", func(t *testing.T) {
		content := "Duplicate #test tags and another #test tag"
		hashtags := service.ExtractHashtags(content)

		assert.Len(t, hashtags, 1)
		assert.Equal(t, "#test", hashtags[0])
	})

	t.Run("invalid hashtag patterns", func(t *testing.T) {
		content := "Invalid #123 tags and #!@#$ tags"
		hashtags := service.ExtractHashtags(content)

		assert.Len(t, hashtags, 0)
	})
}

// Performance Tests

func TestNoteService_Performance(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping performance tests in short mode")
	}

	service, repo := setupTestNoteService()
	ctx := context.Background()
	userID := "perf-test-user"

	t.Run("large number of notes creation", func(t *testing.T) {
		start := time.Now()

		for i := 0; i < 1000; i++ {
			request := createTestNote(userID, fmt.Sprintf("Perf Note %d", i), fmt.Sprintf("Content %d", i))
			_, err := service.CreateNote(userID, request)
			require.NoError(t, err)
		}

		duration := time.Since(start)
		t.Logf("Created 1000 notes in %v (%.2f notes/sec)", duration, float64(1000)/duration.Seconds())
		assert.Less(t, duration, 5*time.Second) // Should complete within 5 seconds
	})

	t.Run("large search performance", func(t *testing.T) {
		// Create 1000 notes with varied content
		for i := 0; i < 1000; i++ {
			request := createTestNote(userID, fmt.Sprintf("Search Test %d", i),
				fmt.Sprintf("This is search test content number %d with keyword search", i))
			service.CreateNote(userID, request)
		}

		start := time.Now()
		notes, total, err := service.SearchNotes(ctx, userID, "search", 100, 0)
		duration := time.Since(start)

		require.NoError(t, err)
		assert.Greater(t, total, int64(0))
		t.Logf("Searched 1000+ notes in %v (found %d results)", duration, total)
		assert.Less(t, duration, 100*time.Millisecond) // Search should be fast
	})
}

// Benchmark Tests

func BenchmarkNoteService_CreateNote(b *testing.B) {
	service, repo := setupTestNoteService()
	userID := "bench-user"
	request := createTestNote(userID, "Benchmark Note", "Benchmark content")

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := service.CreateNote(userID, request)
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkNoteService_ExtractHashtags(b *testing.B) {
	service, repo := setupTestNoteService()
	content := "This is a benchmark note with #multiple #hashtags and #various #content #patterns"

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = service.ExtractHashtags(content)
	}
}