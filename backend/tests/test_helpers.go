package tests

import (
	"database/sql"
	"fmt"
	"testing"

	_ "github.com/lib/pq"
)

// setupTestDB creates a test database connection and applies migrations
func setupTestDB(t *testing.T) (*sql.DB, func()) {
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

	// Return cleanup function
	cleanup := func() {
		// Clean up test data
		cleanupTestData(t, db)
		db.Close()
	}

	return db, cleanup
}

// applyMigrations applies database migrations for testing
func applyMigrations(t *testing.T, db *sql.DB) {
	// Apply migration files in order
	migrations := []string{
		// Users table
		`CREATE TABLE IF NOT EXISTS users (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			google_id VARCHAR(255) UNIQUE,
			email VARCHAR(255) UNIQUE NOT NULL,
			avatar_url TEXT,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);`,

		// User sessions table
		`CREATE TABLE IF NOT EXISTS user_sessions (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			session_id VARCHAR(255) UNIQUE NOT NULL,
			refresh_token_hash VARCHAR(255) NOT NULL,
			expires_at TIMESTAMP NOT NULL,
			is_active BOOLEAN DEFAULT true,
			ip_address INET,
			user_agent TEXT,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);`,

		// Notes table
		`CREATE TABLE IF NOT EXISTS notes (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			title VARCHAR(1000),
			content TEXT NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			version INTEGER DEFAULT 1
		);`,

		// Tags table
		`CREATE TABLE IF NOT EXISTS tags (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			name VARCHAR(100) UNIQUE NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);`,

		// Note tags junction table
		`CREATE TABLE IF NOT EXISTS note_tags (
			note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
			tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (note_id, tag_id)
		);`,

		// Template categories table
		`CREATE TABLE IF NOT EXISTS template_categories (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			name VARCHAR(100) UNIQUE NOT NULL,
			description TEXT,
			icon VARCHAR(50) DEFAULT 'folder',
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

		// Template usages table
		`CREATE TABLE IF NOT EXISTS template_usages (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
			user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			note_id UUID REFERENCES notes(id) ON DELETE SET NULL,
			variables_used JSONB DEFAULT '{}',
			applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			context TEXT
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
			// Insert built-in template
			_, err := db.Exec(`
				INSERT INTO templates (
					id, name, description, content, category,
					variables, is_built_in, usage_count, is_public,
					icon, tags, created_at, updated_at
				) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
			`,
				template.id, template.name, template.description, template.content,
				template.category, template.variables, true, 0, true,
				template.icon, template.tags,
			)
			if err != nil {
				t.Fatalf("Failed to insert built-in template %s: %v", template.name, err)
			}
		}
	}

	// Create indexes for performance
	indexes := []string{
		"CREATE INDEX IF NOT EXISTS idx_templates_user_id ON templates(user_id)",
		"CREATE INDEX IF NOT EXISTS idx_templates_category ON templates(category)",
		"CREATE INDEX IF NOT EXISTS idx_templates_is_built_in ON templates(is_built_in)",
		"CREATE INDEX IF NOT EXISTS idx_templates_is_public ON templates(is_public)",
		"CREATE INDEX IF NOT EXISTS idx_templates_usage_count ON templates(usage_count DESC)",
		"CREATE INDEX IF NOT EXISTS idx_templates_created_at ON templates(created_at DESC)",
		"CREATE INDEX IF NOT EXISTS idx_templates_updated_at ON templates(updated_at DESC)",
		"CREATE INDEX IF NOT EXISTS idx_templates_search ON templates USING GIN(to_tsvector('english', COALESCE(name, '') || ' ' || COALESCE(description, '') || ' ' || COALESCE(content, '')))",
	}

	for _, index := range indexes {
		if _, err := db.Exec(index); err != nil {
			t.Logf("Warning: Failed to create index: %v", err)
		}
	}
}

// cleanupTestData cleans up all test data
func cleanupTestData(t *testing.T, db *sql.DB) {
	tables := []string{
		"template_usages",
		"templates",
		"note_tags",
		"notes",
		"tags",
		"user_sessions",
		"users",
	}

	for _, table := range tables {
		if _, err := db.Exec(fmt.Sprintf("DELETE FROM %s", table)); err != nil {
			t.Logf("Warning: Failed to clean up table %s: %v", table, err)
		}
	}
}