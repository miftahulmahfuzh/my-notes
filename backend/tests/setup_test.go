package tests

import (
	"database/sql"
	"fmt"
	"os"
	"testing"

	"github.com/gpd/my-notes/internal/config"
	"github.com/gpd/my-notes/internal/database"
	"github.com/google/uuid"
)

// TestMain is the main entry point for tests
func TestMain(m *testing.M) {
	// Load configuration to ensure .env file is loaded before tests
	_, err := config.LoadConfig("")
	if err != nil {
		fmt.Printf("Warning: Failed to load config: %v\n", err)
	}

	// Run tests
	code := m.Run()
	os.Exit(code)
}


// TestConfig holds configuration for testing
type TestConfig struct {
	Database config.DatabaseConfig
	Server   config.ServerConfig
	App      config.AppConfig
}

// GetTestConfig returns test configuration
func GetTestConfig() *TestConfig {
	// Load configuration to ensure .env file is loaded
	_, err := config.LoadConfig("")
	if err != nil {
		// Fall back to environment variables if config loading fails
	}

	// Override with test-specific values
	return &TestConfig{
		Database: config.DatabaseConfig{
			Host:     getEnv("TEST_DB_HOST", getEnv("DB_HOST", "localhost")),
			Port:     getEnvInt("TEST_DB_PORT", getEnvInt("DB_PORT", 5432)),
			User:     getEnv("TEST_DB_USER", getEnv("DB_USER", "postgres")),
			Password: getEnv("TEST_DB_PASSWORD", getEnv("DB_PASSWORD", "postgres123")),
			Name:     getEnv("TEST_DB_NAME", getEnv("DB_NAME", "notes_test")),
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

	if !USE_POSTGRE_DURING_TEST {
		t.Skip("PostgreSQL tests are disabled. Set USE_POSTGRE_DURING_TEST=true to enable.")
	}

	cfg := GetTestConfig()

	// Create test database connection for the template database
	templateDB, err := sql.Open("postgres", cfg.Database.DSN())
	if err != nil {
		t.Fatalf("Failed to connect to template database: %v", err)
	}
	defer templateDB.Close()

	// Create test database
	db, err := database.CreateTestDatabase(cfg.Database)
	if err != nil {
		t.Fatalf("Failed to create test database: %v", err)
	}

	// Run migrations
	migrator := database.NewMigrator(db, "../migrations")
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
	if !USE_POSTGRE_DURING_TEST {
		t.Skip("PostgreSQL tests are disabled. Set USE_POSTGRE_DURING_TEST=true to enable.")
	}
	database.DropTestDatabase(db)
}

// CreateTestUser creates a test user in the database
func CreateTestUser(t *testing.T, db *sql.DB, email string) string {
	t.Helper()
	if !USE_POSTGRE_DURING_TEST {
		t.Skip("PostgreSQL tests are disabled. Set USE_POSTGRE_DURING_TEST=true to enable.")
	}

	userID := uuid.New()
	googleID := fmt.Sprintf("google_%s", userID.String())

	query := `
		INSERT INTO users (id, google_id, email, created_at, updated_at)
		VALUES ($1, $2, $3, NOW(), NOW())
		RETURNING id
	`

	var id string
	err := db.QueryRow(query, userID, googleID, email).Scan(&id)
	if err != nil {
		t.Fatalf("Failed to create test user: %v", err)
	}

	return id
}

// CreateTestNote creates a test note in the database
func CreateTestNote(t *testing.T, db *sql.DB, userID string, title, content string) string {
	t.Helper()
	if !USE_POSTGRE_DURING_TEST {
		t.Skip("PostgreSQL tests are disabled. Set USE_POSTGRE_DURING_TEST=true to enable.")
	}

	noteID := uuid.New()

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
	if !USE_POSTGRE_DURING_TEST {
		t.Skip("PostgreSQL tests are disabled. Set USE_POSTGRE_DURING_TEST=true to enable.")
	}

	tagID := uuid.New()

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
	if !USE_POSTGRE_DURING_TEST {
		t.Skip("PostgreSQL tests are disabled. Set USE_POSTGRE_DURING_TEST=true to enable.")
	}

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
	if !USE_POSTGRE_DURING_TEST {
		t.Skip("PostgreSQL tests are disabled. Set USE_POSTGRE_DURING_TEST=true to enable.")
	}

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
	if !USE_POSTGRE_DURING_TEST {
		t.Skip("PostgreSQL tests are disabled. Set USE_POSTGRE_DURING_TEST=true to enable.")
	}

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

