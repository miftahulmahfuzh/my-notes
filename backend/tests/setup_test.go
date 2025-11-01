package tests

import (
	"database/sql"
	"fmt"
	"os"
	"strconv"
	"testing"
	"time"

	"github.com/gpd/my-notes/internal/config"
	"github.com/gpd/my-notes/internal/database"
)

// TestConfig holds configuration for testing
type TestConfig struct {
	Database config.DatabaseConfig
	Server   config.ServerConfig
	App      config.AppConfig
}

// GetTestConfig returns test configuration
func GetTestConfig() *TestConfig {
	return &TestConfig{
		Database: config.DatabaseConfig{
			Host:     getEnv("TEST_DB_HOST", "localhost"),
			Port:     getEnvInt("TEST_DB_PORT", 5432),
			User:     getEnv("TEST_DB_USER", "postgres"),
			Password: getEnv("TEST_DB_PASSWORD", "postgres123"),
			SSLMode:  "disable",
		},
		Server: config.ServerConfig{
			Host: "localhost",
			Port: "9999", // Use different port for testing
		},
		App: config.AppConfig{
			Environment: "test",
			Debug:       false,
			LogLevel:    "error",
		},
	}
}

// SetupTestDB creates a test database and runs migrations
func SetupTestDB(t *testing.T) *sql.DB {
	t.Helper()

	cfg := GetTestConfig()

	// Create test database
	db, err := database.CreateTestDatabase(cfg.Database)
	if err != nil {
		t.Fatalf("Failed to create test database: %v", err)
	}

	// Run migrations
	migrator := database.NewMigrator(db, "../../migrations")
	if err := migrator.Up(); err != nil {
		// Clean up database if migrations fail
		database.DropTestDatabase(db)
		t.Fatalf("Failed to run migrations: %v", err)
	}

	return db
}

// CleanupTestDB drops the test database
func CleanupTestDB(t *testing.T, db *sql.DB) {
	t.Helper()
	database.DropTestDatabase(db)
}

// CreateTestUser creates a test user in the database
func CreateTestUser(t *testing.T, db *sql.DB, email string) string {
	t.Helper()

	userID := fmt.Sprintf("test_user_%d", time.Now().UnixNano())

	query := `
		INSERT INTO users (id, google_id, email, name, created_at, updated_at)
		VALUES ($1, $2, $3, $4, NOW(), NOW())
		RETURNING id
	`

	var id string
	err := db.QueryRow(query, userID, "google_"+userID, email, "Test User").Scan(&id)
	if err != nil {
		t.Fatalf("Failed to create test user: %v", err)
	}

	return id
}

// CreateTestNote creates a test note in the database
func CreateTestNote(t *testing.T, db *sql.DB, userID string, title, content string) string {
	t.Helper()

	noteID := fmt.Sprintf("test_note_%d", time.Now().UnixNano())

	query := `
		INSERT INTO notes (id, user_id, title, content, created_at, updated_at, version)
		VALUES ($1, $2, $3, $4, NOW(), NOW(), 1)
		RETURNING id
	`

	var id string
	err := db.QueryRow(query, noteID, userID, title, content).Scan(&id)
	if err != nil {
		t.Fatalf("Failed to create test note: %v", err)
	}

	return id
}

// CreateTestTag creates a test tag in the database
func CreateTestTag(t *testing.T, db *sql.DB, name string) string {
	t.Helper()

	tagID := fmt.Sprintf("test_tag_%d", time.Now().UnixNano())

	query := `
		INSERT INTO tags (id, name, created_at)
		VALUES ($1, $2, NOW())
		RETURNING id
	`

	var id string
	err := db.QueryRow(query, tagID, name).Scan(&id)
	if err != nil {
		t.Fatalf("Failed to create test tag: %v", err)
	}

	return id
}

// AssertTableRowCount asserts the number of rows in a table
func AssertTableRowCount(t *testing.T, db *sql.DB, table string, expected int) {
	t.Helper()

	var count int
	query := fmt.Sprintf("SELECT COUNT(*) FROM %s", table)
	err := db.QueryRow(query).Scan(&count)
	if err != nil {
		t.Fatalf("Failed to count rows in %s: %v", table, err)
	}

	if count != expected {
		t.Errorf("Expected %d rows in %s, got %d", expected, table, count)
	}
}

// AssertExists asserts that a record exists in the database
func AssertExists(t *testing.T, db *sql.DB, table, condition string, args ...interface{}) {
	t.Helper()

	query := fmt.Sprintf("SELECT COUNT(*) FROM %s WHERE %s", table, condition)
	var count int
	err := db.QueryRow(query, args...).Scan(&count)
	if err != nil {
		t.Fatalf("Failed to check existence in %s: %v", table, err)
	}

	if count == 0 {
		t.Errorf("Record not found in %s where %s", table, condition)
	}
}

// AssertNotExists asserts that a record does not exist in the database
func AssertNotExists(t *testing.T, db *sql.DB, table, condition string, args ...interface{}) {
	t.Helper()

	query := fmt.Sprintf("SELECT COUNT(*) FROM %s WHERE %s", table, condition)
	var count int
	err := db.QueryRow(query, args...).Scan(&count)
	if err != nil {
		t.Fatalf("Failed to check non-existence in %s: %v", table, err)
	}

	if count > 0 {
		t.Errorf("Record found in %s where %s, but should not exist", table, condition)
	}
}

// Helper functions for environment variables
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}