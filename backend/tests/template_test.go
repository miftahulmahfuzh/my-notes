package integration

import (
	"context"
	"database/sql"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/gpd/my-notes/internal/config"
	"github.com/gpd/my-notes/internal/handlers"
	"github.com/gpd/my-notes/internal/models"
	"github.com/gpd/my-notes/internal/services"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TemplateTestSuite tests template functionality without HTTP layer
type TemplateTestSuite struct {
	db               *sql.DB
	templateService  *services.TemplateService
	templateHandler  *handlers.TemplateHandler
	testUserID       uuid.UUID
	testUser         *models.User
	cleanup          func()
}

// SetupTemplateTestSuite creates a new test suite
func SetupTemplateTestSuite(t *testing.T) *TemplateTestSuite {
	// Setup test database
	testDB, cleanup := setupTestDB(t)

	// Create test user
	userID := uuid.New()
	testUser := &models.User{
		ID:        userID,
		Email:     "test@example.com",
		Name:      "Test User",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	// Insert test user
	_, err := testDB.Exec(`
		INSERT INTO users (id, email, name, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5)
	`, testUser.ID, testUser.Email, testUser.Name, testUser.CreatedAt, testUser.UpdatedAt)
	require.NoError(t, err)

	// Initialize template service
	templateService := services.NewTemplateService(testDB)

	// Initialize template handler
	templateHandler := handlers.NewTemplateHandler(templateService)

	return &TemplateTestSuite{
		db:              testDB,
		templateService: templateService,
		templateHandler: templateHandler,
		testUserID:      userID,
		testUser:        testUser,
		cleanup:         cleanup,
	}
}

// TestTemplateService_GetBuiltInTemplates tests built-in template retrieval
func (s *TemplateTestSuite) TestTemplateService_GetBuiltInTemplates(t *testing.T) {
	// Call the service method directly
	templates, err := s.templateService.GetBuiltInTemplates()

	// Assert no error
	assert.NoError(t, err)

	// Should have built-in templates
	assert.GreaterOrEqual(t, len(templates), 2, "Should have at least 2 built-in templates")

	// Check template properties
	templateMap := make(map[string]*models.Template)
	for _, template := range templates {
		templateMap[template.ID.String()] = template
		assert.True(t, template.IsBuiltIn, "All templates should be built-in")
		assert.NotEmpty(t, template.Name, "Template should have a name")
		assert.NotEmpty(t, template.Content, "Template should have content")
		assert.NotEmpty(t, template.Category, "Template should have a category")
	}

	// Check for expected built-in templates
	expectedTemplates := []string{
		"00000000-0000-0000-0000-000000000101", // Meeting Notes
		"00000000-0000-0000-0000-000000000102", // Daily Journal
	}

	for _, expectedID := range expectedTemplates {
		template, exists := templateMap[expectedID]
		assert.True(t, exists, "Expected built-in template %s should exist", expectedID)
		if exists {
			assert.NotEmpty(t, template.Name, "Template %s should have a name", expectedID)
			assert.NotEmpty(t, template.Content, "Template %s should have content", expectedID)
		}
	}

	// Print templates for debugging
	t.Logf("Found %d built-in templates:", len(templates))
	for _, template := range templates {
		t.Logf("  - %s (%s): %s", template.Name, template.ID, template.Category)
	}
}

// TestTemplateService_GetUserTemplates tests user template retrieval
func (s *TemplateTestSuite) TestTemplateService_GetUserTemplates(t *testing.T) {
	// Create some test user templates
	testTemplates := []*models.Template{
		{
			ID:          uuid.New(),
			UserID:      &s.testUserID,
			Name:        "Test Template 1",
			Description: "A test template",
			Content:     "# {{title}}\n\nThis is a test template.",
			Category:    "test",
			Variables:   []string{"title"},
			IsBuiltIn:   false,
			UsageCount:  0,
			IsPublic:    false,
			Icon:        "document",
			Tags:        []string{},
			CreatedAt:   time.Now(),
			UpdatedAt:   time.Now(),
		},
		{
			ID:          uuid.New(),
			UserID:      &s.testUserID,
			Name:        "Test Template 2",
			Description: "Another test template",
			Content:     "## {{heading}}\n\nContent goes here.",
			Category:    "test",
			Variables:   []string{"heading"},
			IsBuiltIn:   false,
			UsageCount:  5,
			IsPublic:    true,
			Icon:        "star",
			Tags:        []string{"test", "sample"},
			CreatedAt:   time.Now(),
			UpdatedAt:   time.Now(),
		},
	}

	// Insert test templates
	for _, template := range testTemplates {
		_, err := s.db.Exec(`
			INSERT INTO templates (
				id, user_id, name, description, content, category,
				variables, is_built_in, usage_count, is_public,
				icon, tags, created_at, updated_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
		`,
			template.ID, template.UserID, template.Name, template.Description,
			template.Content, template.Category, template.Variables,
			template.IsBuiltIn, template.UsageCount, template.IsPublic,
			template.Icon, template.Tags, template.CreatedAt, template.UpdatedAt,
		)
		require.NoError(t, err)
	}

	// Test getting user templates
	templates, err := s.templateService.GetUserTemplates(s.testUserID)

	assert.NoError(t, err)
	assert.Equal(t, len(testTemplates), len(templates), "Should return correct number of user templates")

	// Verify template properties
	templateMap := make(map[uuid.UUID]*models.Template)
	for _, template := range templates {
		templateMap[template.ID] = template
		assert.False(t, template.IsBuiltIn, "User templates should not be built-in")
		assert.Equal(t, s.testUserID, *template.UserID, "Template should belong to test user")
	}

	for _, expectedTemplate := range testTemplates {
		template, exists := templateMap[expectedTemplate.ID]
		assert.True(t, exists, "Expected template %s should exist", expectedTemplate.ID)
		if exists {
			assert.Equal(t, expectedTemplate.Name, template.Name)
			assert.Equal(t, expectedTemplate.Content, template.Content)
		}
	}
}

// TestTemplateService_GetTemplate tests getting a specific template
func (s *TemplateTestSuite) TestTemplateService_GetTemplate(t *testing.T) {
	// Create a test template
	templateID := uuid.New()
	testTemplate := &models.Template{
		ID:          templateID,
		UserID:      &s.testUserID,
		Name:        "Test Template",
		Description: "A test template",
		Content:     "# {{title}}\n\nTest content.",
		Category:    "test",
		Variables:   []string{"title"},
		IsBuiltIn:   false,
		UsageCount:  0,
		IsPublic:    false,
		Icon:        "document",
		Tags:        []string{},
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	// Insert template
	_, err := s.db.Exec(`
		INSERT INTO templates (
			id, user_id, name, description, content, category,
			variables, is_built_in, usage_count, is_public,
			icon, tags, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
	`,
		testTemplate.ID, testTemplate.UserID, testTemplate.Name, testTemplate.Description,
		testTemplate.Content, testTemplate.Category, testTemplate.Variables,
		testTemplate.IsBuiltIn, testTemplate.UsageCount, testTemplate.IsPublic,
		testTemplate.Icon, testTemplate.Tags, testTemplate.CreatedAt, testTemplate.UpdatedAt,
	)
	require.NoError(t, err)

	// Test getting the template
	template, err := s.templateService.GetTemplate(templateID, s.testUserID)

	assert.NoError(t, err)
	assert.NotNil(t, template)
	assert.Equal(t, testTemplate.ID, template.ID)
	assert.Equal(t, testTemplate.Name, template.Name)
	assert.Equal(t, testTemplate.Content, template.Content)
	assert.Equal(t, testTemplate.UserID, template.UserID)

	// Test getting built-in template (no user ID required)
	builtInTemplate, err := s.templateService.GetTemplate(
		uuid.MustParse("00000000-0000-0000-0000-000000000101"),
		uuid.Nil,
	)
	assert.NoError(t, err)
	assert.NotNil(t, builtInTemplate)
	assert.True(t, builtInTemplate.IsBuiltIn)
}

// TestTemplateService_CreateTemplate tests creating a new template
func (s *TemplateTestSuite) TestTemplateService_CreateTemplate(t *testing.T) {
	// Test data
	req := &services.CreateTemplateRequest{
		UserID:      s.testUserID,
		Name:        "New Template",
		Description: "A newly created template",
		Content:     "# {{title}}\n\nCreated template content.",
		Category:    "custom",
		Variables:   []string{"title", "date"},
		IsPublic:    false,
		Icon:        "star",
		Tags:        []string{"custom", "test"},
	}

	// Create template
	template, err := s.templateService.CreateTemplate(req)

	assert.NoError(t, err)
	assert.NotNil(t, template)
	assert.NotEqual(t, uuid.Nil, template.ID)
	assert.Equal(t, req.Name, template.Name)
	assert.Equal(t, req.Description, template.Description)
	assert.Equal(t, req.Content, template.Content)
	assert.Equal(t, req.Category, template.Category)
	assert.Equal(t, req.Variables, template.Variables)
	assert.Equal(t, req.IsPublic, template.IsPublic)
	assert.Equal(t, req.Icon, template.Icon)
	assert.Equal(t, req.Tags, template.Tags)
	assert.False(t, template.IsBuiltIn)
	assert.Equal(t, s.testUserID, *template.UserID)
	assert.WithinDuration(t, time.Now(), template.CreatedAt, 5*time.Second)
	assert.WithinDuration(t, time.Now(), template.UpdatedAt, 5*time.Second)

	// Verify template exists in database
	var count int
	err = s.db.QueryRow("SELECT COUNT(*) FROM templates WHERE id = $1", template.ID).Scan(&count)
	assert.NoError(t, err)
	assert.Equal(t, 1, count)
}

// TestTemplateService_UpdateTemplate tests updating a template
func (s *TemplateTestSuite) TestTemplateService_UpdateTemplate(t *testing.T) {
	// Create initial template
	templateID := uuid.New()
	initialTemplate := &models.Template{
		ID:          templateID,
		UserID:      &s.testUserID,
		Name:        "Original Template",
		Description: "Original description",
		Content:     "Original content",
		Category:    "original",
		Variables:   []string{"original"},
		IsBuiltIn:   false,
		UsageCount:  0,
		IsPublic:    false,
		Icon:        "document",
		Tags:        []string{"original"},
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	// Insert initial template
	_, err := s.db.Exec(`
		INSERT INTO templates (
			id, user_id, name, description, content, category,
			variables, is_built_in, usage_count, is_public,
			icon, tags, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
	`,
		initialTemplate.ID, initialTemplate.UserID, initialTemplate.Name,
		initialTemplate.Description, initialTemplate.Content, initialTemplate.Category,
		initialTemplate.Variables, initialTemplate.IsBuiltIn, initialTemplate.UsageCount,
		initialTemplate.IsPublic, initialTemplate.Icon, initialTemplate.Tags,
		initialTemplate.CreatedAt, initialTemplate.UpdatedAt,
	)
	require.NoError(t, err)

	// Update data
	updateReq := &services.UpdateTemplateRequest{
		ID:          templateID,
		UserID:      s.testUserID,
		Name:        "Updated Template",
		Description: "Updated description",
		Content:     "Updated content with {{variable}}",
		Category:    "updated",
		Variables:   []string{"variable"},
		IsPublic:    true,
		Icon:        "star",
		Tags:        []string{"updated", "modified"},
	}

	// Update template
	updatedTemplate, err := s.templateService.UpdateTemplate(updateReq)

	assert.NoError(t, err)
	assert.NotNil(t, updatedTemplate)
	assert.Equal(t, templateID, updatedTemplate.ID)
	assert.Equal(t, updateReq.Name, updatedTemplate.Name)
	assert.Equal(t, updateReq.Description, updatedTemplate.Description)
	assert.Equal(t, updateReq.Content, updatedTemplate.Content)
	assert.Equal(t, updateReq.Category, updatedTemplate.Category)
	assert.Equal(t, updateReq.Variables, updatedTemplate.Variables)
	assert.Equal(t, updateReq.IsPublic, updatedTemplate.IsPublic)
	assert.Equal(t, updateReq.Icon, updatedTemplate.Icon)
	assert.Equal(t, updateReq.Tags, updatedTemplate.Tags)
	assert.True(t, updatedTemplate.UpdatedAt.After(initialTemplate.UpdatedAt))
}

// TestTemplateService_DeleteTemplate tests deleting a template
func (s *TemplateTestSuite) TestTemplateService_DeleteTemplate(t *testing.T) {
	// Create test template
	templateID := uuid.New()
	testTemplate := &models.Template{
		ID:          templateID,
		UserID:      &s.testUserID,
		Name:        "Template to Delete",
		Description: "This template will be deleted",
		Content:     "Content to delete",
		Category:    "delete",
		Variables:   []string{},
		IsBuiltIn:   false,
		UsageCount:  0,
		IsPublic:    false,
		Icon:        "document",
		Tags:        []string{},
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	// Insert template
	_, err := s.db.Exec(`
		INSERT INTO templates (
			id, user_id, name, description, content, category,
			variables, is_built_in, usage_count, is_public,
			icon, tags, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
	`,
		testTemplate.ID, testTemplate.UserID, testTemplate.Name, testTemplate.Description,
		testTemplate.Content, testTemplate.Category, testTemplate.Variables,
		testTemplate.IsBuiltIn, testTemplate.UsageCount, testTemplate.IsPublic,
		testTemplate.Icon, testTemplate.Tags, testTemplate.CreatedAt, testTemplate.UpdatedAt,
	)
	require.NoError(t, err)

	// Verify template exists
	var count int
	err = s.db.QueryRow("SELECT COUNT(*) FROM templates WHERE id = $1", templateID).Scan(&count)
	assert.NoError(t, err)
	assert.Equal(t, 1, count)

	// Delete template
	err = s.templateService.DeleteTemplate(templateID, s.testUserID)
	assert.NoError(t, err)

	// Verify template is deleted
	err = s.db.QueryRow("SELECT COUNT(*) FROM templates WHERE id = $1", templateID).Scan(&count)
	assert.NoError(t, err)
	assert.Equal(t, 0, count)
}

// TestTemplateService_ApplyTemplate tests applying a template with variables
func (s *TemplateTestSuite) TestTemplateService_ApplyTemplate(t *testing.T) {
	// Create test template with variables
	templateID := uuid.New()
	testTemplate := &models.Template{
		ID:          templateID,
		UserID:      &s.testUserID,
		Name:        "Template with Variables",
		Description: "Template for testing variable substitution",
		Content:     "# {{title}}\n\nDate: {{date}}\n\nAttendees: {{attendees}}\n\nAgenda: {{agenda}}",
		Category:    "test",
		Variables:   []string{"title", "date", "attendees", "agenda"},
		IsBuiltIn:   false,
		UsageCount:  0,
		IsPublic:    false,
		Icon:        "document",
		Tags:        []string{},
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	// Insert template
	_, err := s.db.Exec(`
		INSERT INTO templates (
			id, user_id, name, description, content, category,
			variables, is_built_in, usage_count, is_public,
			icon, tags, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
	`,
		testTemplate.ID, testTemplate.UserID, testTemplate.Name, testTemplate.Description,
		testTemplate.Content, testTemplate.Category, testTemplate.Variables,
		testTemplate.IsBuiltIn, testTemplate.UsageCount, testTemplate.IsPublic,
		testTemplate.Icon, testTemplate.Tags, testTemplate.CreatedAt, testTemplate.UpdatedAt,
	)
	require.NoError(t, err)

	// Test applying template with variables
	req := &services.ApplyTemplateRequest{
		TemplateID: templateID,
		UserID:     s.testUserID,
		Variables: map[string]string{
			"title":     "Meeting Notes",
			"date":      "2025-11-02",
			"attendees": "John Doe, Jane Smith",
			"agenda":    "1. Project update\n2. Q4 planning\n3. Next steps",
		},
	}

	result, err := s.templateService.ApplyTemplate(req)

	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.NotEmpty(t, result.Content)

	expectedContent := `# Meeting Notes

Date: 2025-11-02

Attendees: John Doe, Jane Smith

Agenda: 1. Project update
2. Q4 planning
3. Next steps`
	assert.Equal(t, expectedContent, result.Content)

	// Verify usage count was incremented
	var usageCount int
	err = s.db.QueryRow("SELECT usage_count FROM templates WHERE id = $1", templateID).Scan(&usageCount)
	assert.NoError(t, err)
	assert.Equal(t, 1, usageCount)
}

// TestTemplateService_SearchTemplates tests template search functionality
func (s *TemplateTestSuite) TestTemplateService_SearchTemplates(t *testing.T) {
	// Create test templates for search
	testTemplates := []*models.Template{
		{
			ID:          uuid.New(),
			UserID:      &s.testUserID,
			Name:        "Project Meeting Template",
			Description: "Template for project meetings",
			Content:     "# Project Meeting: {{project_name}}",
			Category:    "meeting",
			IsBuiltIn:   false,
			UsageCount:  5,
			IsPublic:    true,
			Tags:        []string{"meeting", "project"},
			CreatedAt:   time.Now(),
			UpdatedAt:   time.Now(),
		},
		{
			ID:          uuid.New(),
			UserID:      &s.testUserID,
			Name:        "Daily Standup",
			Description: "Daily standup meeting template",
			Content:     "## Daily Standup - {{date}}",
			Category:    "meeting",
			IsBuiltIn:   false,
			UsageCount:  10,
			IsPublic:    false,
			Tags:        []string{"daily", "standup"},
			CreatedAt:   time.Now(),
			UpdatedAt:   time.Now(),
		},
	}

	// Insert test templates
	for _, template := range testTemplates {
		_, err := s.db.Exec(`
			INSERT INTO templates (
				id, user_id, name, description, content, category,
				is_built_in, usage_count, is_public, tags, created_at, updated_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		`,
			template.ID, template.UserID, template.Name, template.Description,
			template.Content, template.Category, template.IsBuiltIn,
			template.UsageCount, template.IsPublic, template.Tags,
			template.CreatedAt, template.UpdatedAt,
		)
		require.NoError(t, err)
	}

	// Test search by query
	searchReq := &services.SearchTemplatesRequest{
		UserID: s.testUserID,
		Query:  "meeting",
		Limit:  10,
		Offset: 0,
	}

	results, err := s.templateService.SearchTemplates(searchReq)
	assert.NoError(t, err)
	assert.GreaterOrEqual(t, len(results), 2, "Should find at least 2 templates with 'meeting'")

	// Test search by category
	searchReq.Category = "meeting"
	results, err = s.templateService.SearchTemplates(searchReq)
	assert.NoError(t, err)
	assert.GreaterOrEqual(t, len(results), 2, "Should find templates in 'meeting' category")
}

// Cleanup cleans up the test suite
func (s *TemplateTestSuite) Cleanup() {
	if s.cleanup != nil {
		s.cleanup()
	}
}

// TestTemplateIntegration runs all template integration tests
func TestTemplateIntegration(t *testing.T) {
	suite := SetupTemplateTestSuite(t)
	defer suite.Cleanup()

	t.Run("GetBuiltInTemplates", func(t *testing.T) {
		suite.TestTemplateService_GetBuiltInTemplates(t)
	})

	t.Run("GetUserTemplates", func(t *testing.T) {
		suite.TestTemplateService_GetUserTemplates(t)
	})

	t.Run("GetTemplate", func(t *testing.T) {
		suite.TestTemplateService_GetTemplate(t)
	})

	t.Run("CreateTemplate", func(t *testing.T) {
		suite.TestTemplateService_CreateTemplate(t)
	})

	t.Run("UpdateTemplate", func(t *testing.T) {
		suite.TestTemplateService_UpdateTemplate(t)
	})

	t.Run("DeleteTemplate", func(t *testing.T) {
		suite.TestTemplateService_DeleteTemplate(t)
	})

	t.Run("ApplyTemplate", func(t *testing.T) {
		suite.TestTemplateService_ApplyTemplate(t)
	})

	t.Run("SearchTemplates", func(t *testing.T) {
		suite.TestTemplateService_SearchTemplates(t)
	})
}