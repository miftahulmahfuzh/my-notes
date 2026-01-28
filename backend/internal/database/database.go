package database

import (
	"database/sql"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/gpd/my-notes/internal/config"
	_ "github.com/lib/pq"
)

// NewConnection creates a new database connection with connection pooling
func NewConnection(cfg config.DatabaseConfig) (*sql.DB, error) {
	// Build connection string
	dsn := cfg.DSN()

	// Open database connection
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// Configure connection pool
	db.SetMaxOpenConns(25)                 // Maximum number of open connections
	db.SetMaxIdleConns(5)                  // Maximum number of idle connections
	db.SetConnMaxLifetime(5 * time.Minute) // Maximum lifetime of a connection

	// Test connection
	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	log.Printf("Database connection established to %s:%d/%s", cfg.Host, cfg.Port, cfg.Name)

	return db, nil
}

// CreateTestDatabase creates a test database for testing purposes
func CreateTestDatabase(cfg config.DatabaseConfig) (*sql.DB, error) {
	// Create a unique database name for testing
	testDBName := fmt.Sprintf("%s_test_%d", cfg.Name, time.Now().UnixNano())

	// Connect to postgres database to create test database
	adminCfg := cfg
	adminCfg.Name = "postgres"

	db, err := NewConnection(adminCfg)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to admin database: %w", err)
	}
	defer db.Close()

	// Create test database
	_, err = db.Exec(fmt.Sprintf("CREATE DATABASE %s", testDBName))
	if err != nil {
		return nil, fmt.Errorf("failed to create test database: %w", err)
	}

	// Connect to the test database
	testCfg := cfg
	testCfg.Name = testDBName

	testDB, err := NewConnection(testCfg)
	if err != nil {
		// Try to drop the database if connection fails
		dropTestDatabase(adminCfg, testDBName)
		return nil, fmt.Errorf("failed to connect to test database: %w", err)
	}

	log.Printf("Test database created: %s", testDBName)

	return testDB, nil
}

// DropTestDatabase drops a test database
func DropTestDatabase(db *sql.DB) {
	if db == nil {
		return
	}

	// Get database name from connection
	var dbName string
	err := db.QueryRow("SELECT current_database()").Scan(&dbName)
	if err != nil {
		log.Printf("Failed to get database name: %v", err)
		return
	}

	// Only drop if it's a test database (must contain "test" somewhere in the name)
	// This prevents accidentally dropping production databases
	if !strings.Contains(strings.ToLower(dbName), "test") {
		log.Printf("Skipping drop of non-test database: %s", dbName)
		return
	}

	// Close connection to the database we want to drop
	db.Close()

	// Use test config to connect to postgres database for cleanup
	// Import config package to get test database settings
	cfg := config.GetTestDatabaseConfig()
	cfg.Name = "postgres" // Connect to postgres database to drop the test database

	adminDB, err := NewConnection(cfg)
	if err != nil {
		log.Printf("Failed to connect to admin database: %v", err)
		return
	}
	defer adminDB.Close()

	// Kill connections to the test database
	_, err = adminDB.Exec(fmt.Sprintf(`
		SELECT pg_terminate_backend(pg_stat_activity.pid)
		FROM pg_stat_activity
		WHERE pg_stat_activity.datname = '%s'
		AND pid <> pg_backend_pid()
	`, dbName))

	// Drop the test database
	_, err = adminDB.Exec(fmt.Sprintf("DROP DATABASE %s", dbName))
	if err != nil {
		log.Printf("Failed to drop test database %s: %v", dbName, err)
		return
	}

	log.Printf("Test database dropped: %s", dbName)
}

// dropTestDatabase is a helper function to drop a test database by name
func dropTestDatabase(cfg config.DatabaseConfig, dbName string) {
	db, err := NewConnection(cfg)
	if err != nil {
		log.Printf("Failed to connect to admin database: %v", err)
		return
	}
	defer db.Close()

	// Kill connections to the test database
	_, err = db.Exec(fmt.Sprintf(`
		SELECT pg_terminate_backend(pg_stat_activity.pid)
		FROM pg_stat_activity
		WHERE pg_stat_activity.datname = '%s'
		AND pid <> pg_backend_pid()
	`, dbName))

	// Drop the test database
	_, err = db.Exec(fmt.Sprintf("DROP DATABASE %s", dbName))
	if err != nil {
		log.Printf("Failed to drop test database %s: %v", dbName, err)
		return
	}
}