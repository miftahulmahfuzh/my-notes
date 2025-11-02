package template

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/lib/pq"
	"github.com/google/uuid"
	"github.com/gpd/my-notes/internal/services"
	"github.com/gpd/my-notes/internal/models"
	"github.com/stretchr/testify/assert"
)

func TestTemplateService_GetBuiltInTemplates(t *testing.T) {
	// Setup test database
	db := setupTestDB(t)
	defer db.Close()

	// Initialize template service
	templateService := services.NewTemplateService(db)

	// Test GetBuiltInTemplates
	templates, err := templateService.GetBuiltInTemplates()
	assert.NoError(t, err, "GetBuiltInTemplates should not return an error")

	// Should have built-in templates
	assert.GreaterOrEqual(t, len(templates), 2, "Should have at least 2 built-in templates")

	// Check template properties
	templateMap := make(map[uuid.UUID]*models.Template)
	for _, template := range templates {
		templateMap[template.ID] = template
		assert.True(t, template.IsBuiltIn, "All templates should be built-in")
		assert.NotEmpty(t, template.Name, "Template should have a name")
		assert.NotEmpty(t, template.Content, "Template should have content")
		assert.NotEmpty(t, template.Category, "Template should have a category")
	}

	// Check for expected built-in templates
	expectedTemplates := []uuid.UUID{
		uuid.MustParse("00000000-0000-0000-0000-000000000101"), // Meeting Notes
		uuid.MustParse("00000000-0000-0000-0000-000000000102"), // Daily Journal
	}

	for _, expectedID := range expectedTemplates {
		template, exists := templateMap[expectedID]
		assert.True(t, exists, "Expected built-in template %s should exist", expectedID)
		if exists {
			assert.NotEmpty(t, template.Name, "Template %s should have a name", expectedID)
			assert.NotEmpty(t, template.Content, "Template %s should have content", expectedID)
		}
	}
}

func TestTemplateService_GetTemplate(t *testing.T) {
	// Setup test database
	db := setupTestDB(t)
	defer db.Close()

	// Initialize template service
	templateService := services.NewTemplateService(db)

	// Test getting built-in template (no user ID required)
	builtInTemplate, err := templateService.GetTemplate(
		uuid.MustParse("00000000-0000-0000-0000-000000000101"),
		uuid.Nil,
	)
	assert.NoError(t, err, "GetTemplate (built-in) should not return an error")
	assert.NotNil(t, builtInTemplate, "Built-in template should not be nil")
	assert.True(t, builtInTemplate.IsBuiltIn)
	assert.Equal(t, "Meeting Notes", builtInTemplate.Name)
}

func setupTestDB(t *testing.T) *sql.DB {
	// Get database connection details from environment or use defaults
	dbHost := getEnv("TEST_DB_HOST", "localhost")
	dbPort := getEnv("TEST_DB_PORT", "5432")
	dbUser := getEnv("TEST_DB_USER", "test_user")
	dbPassword := getEnv("TEST_DB_PASSWORD", "test_password")
	dbName := getEnv("TEST_DB_NAME", "my_notes_test")

	// Connect to test database
	connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		dbHost, dbPort, dbUser, dbPassword, dbName)

	db, err := sql.Open("postgres", connStr)
	if err != nil {
		t.Fatalf("Failed to connect to test database: %v", err)
	}

	// Test connection
	if err := db.Ping(); err != nil {
		t.Fatalf("Failed to ping test database: %v", err)
	}

	// Apply migrations if needed
	applyMigrations(t, db)

	return db
}

func applyMigrations(t *testing.T, db *sql.DB) {
	// Apply migration files in order
	migrations := []string{
		// Users table
		`CREATE TABLE IF NOT EXISTS users (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			google_id VARCHAR(255) UNIQUE,
			email VARCHAR(255) UNIQUE NOT NULL,
			name VARCHAR(255) NOT NULL,
			avatar_url TEXT,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);`,

		// Templates table
		`CREATE TABLE IF NOT EXISTS templates (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id UUID REFERENCES users(id) ON DELETE CASCADE,
			name VARCHAR(255) NOT NULL,
			description TEXT,
			content TEXT NOT NULL,
			category VARCHAR(100) DEFAULT 'general',
			variables TEXT[] DEFAULT '{}',
			is_built_in BOOLEAN DEFAULT FALSE,
			usage_count INTEGER DEFAULT 0,
			is_public BOOLEAN DEFAULT FALSE,
			icon VARCHAR(50) DEFAULT 'document',
			tags JSONB DEFAULT '[]',
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			CONSTRAINT templates_usage_count_non_negative CHECK (usage_count >= 0),
			CONSTRAINT templates_name_not_empty CHECK (length(trim(name)) > 0),
			CONSTRAINT templates_content_not_empty CHECK (length(trim(content)) > 0)
		);`,
	}

	// Apply each migration
	for i, migration := range migrations {
		if _, err := db.Exec(migration); err != nil {
			t.Fatalf("Failed to apply migration %d: %v", i+1, err)
		}
	}

	// Insert built-in templates if they don't exist
	builtInTemplates := []struct {
		id        string
		name      string
		description string
		content   string
		category  string
		variables []string
		icon      string
		tags      []string
	}{
		{
			id:          "00000000-0000-0000-0000-000000000101",
			name:        "Meeting Notes",
			description: "Template for taking structured meeting notes",
			content:     "# Meeting Notes - {{date}}\n\n**Attendees:**\n{{attendees}}\n\n**Agenda:**\n{{agenda}}\n\n**Action Items:**\n{{action_items}}\n\n**Next Steps:**\n{{next_steps}}",
			category:    "meeting",
			variables:   []string{"date", "attendees", "agenda", "action_items", "next_steps"},
			icon:        "users",
			tags:        []string{"#meeting", "#notes"},
		},
		{
			id:          "00000000-0000-0000-0000-000000000102",
			name:        "Daily Journal",
			description: "Template for daily journaling",
			content:     "# Daily Journal - {{date}}\n\n**Mood:** {{mood}}\n\n**Highlights:**\n{{highlights}}\n\n**Gratitude:**\n{{gratitude}}\n\n**Lessons Learned:**\n{{lessons}}",
			category:    "personal",
			variables:   []string{"date", "mood", "highlights", "gratitude", "lessons"},
			icon:        "book",
			tags:        []string{"#journal", "#daily"},
		},
	}

	for _, template := range builtInTemplates {
		// Check if template already exists
		var count int
		err := db.QueryRow("SELECT COUNT(*) FROM templates WHERE id = $1", template.id).Scan(&count)
		if err != nil {
			t.Fatalf("Failed to check if template exists: %v", err)
		}

		if count == 0 {
			// Convert tags to JSON
			tagsJSON, _ := json.Marshal(template.tags)

			// Insert built-in template
			_, err := db.Exec(`
				INSERT INTO templates (
					id, name, description, content, category,
					variables, is_built_in, usage_count, is_public,
					icon, tags, created_at, updated_at
				) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
			`,
				template.id, template.name, template.description, template.content,
				template.category, pq.Array(template.variables), true, 0, true,
				template.icon, tagsJSON, time.Now(), time.Now(),
			)
			if err != nil {
				t.Fatalf("Failed to insert built-in template %s: %v", template.name, err)
			}
		}
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}