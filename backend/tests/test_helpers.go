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
	}

	// Apply each migration
	for i, migration := range migrations {
		if _, err := db.Exec(migration); err != nil {
			t.Fatalf("Failed to apply migration %d: %v", i+1, err)
		}
	}
}

// cleanupTestData cleans up all test data
func cleanupTestData(t *testing.T, db *sql.DB) {
	tables := []string{
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