package database

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	_ "github.com/lib/pq"
)

// Migrator handles database migrations
type Migrator struct {
	db             *sql.DB
	migrationsPath string
}

// NewMigrator creates a new migrator instance
func NewMigrator(db *sql.DB, migrationsPath string) *Migrator {
	return &Migrator{
		db:             db,
		migrationsPath: migrationsPath,
	}
}

// CreateMigrationsTable creates the migrations tracking table
func (m *Migrator) CreateMigrationsTable() error {
	query := `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version VARCHAR(255) PRIMARY KEY,
			applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		)
	`
	_, err := m.db.Exec(query)
	return err
}

// GetAppliedMigrations returns the list of applied migrations
func (m *Migrator) GetAppliedMigrations() (map[string]bool, error) {
	query := "SELECT version FROM schema_migrations"
	rows, err := m.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	applied := make(map[string]bool)
	for rows.Next() {
		var version string
		if err := rows.Scan(&version); err != nil {
			return nil, err
		}
		applied[version] = true
	}

	return applied, rows.Err()
}

// GetPendingMigrations returns the list of pending migrations
func (m *Migrator) GetPendingMigrations() ([]string, error) {
	applied, err := m.GetAppliedMigrations()
	if err != nil {
		return nil, err
	}

	files, err := os.ReadDir(m.migrationsPath)
	if err != nil {
		return nil, err
	}

	var migrations []string
	for _, file := range files {
		if strings.HasSuffix(file.Name(), ".up.sql") {
			version := strings.TrimSuffix(file.Name(), ".up.sql")
			if !applied[version] {
				migrations = append(migrations, version)
			}
		}
	}

	// Sort migrations by version
	sort.Strings(migrations)

	return migrations, nil
}

// Up applies all pending migrations
func (m *Migrator) Up() error {
	if err := m.CreateMigrationsTable(); err != nil {
		return fmt.Errorf("failed to create migrations table: %w", err)
	}

	pending, err := m.GetPendingMigrations()
	if err != nil {
		return fmt.Errorf("failed to get pending migrations: %w", err)
	}

	if len(pending) == 0 {
		fmt.Println("No pending migrations")
		return nil
	}

	fmt.Printf("Applying %d migrations...\n", len(pending))

	for _, version := range pending {
		if err := m.applyMigration(version); err != nil {
			return fmt.Errorf("failed to apply migration %s: %w", version, err)
		}
		fmt.Printf("Applied migration: %s\n", version)
	}

	fmt.Println("All migrations applied successfully")
	return nil
}

// Down rolls back the last migration
func (m *Migrator) Down() error {
	applied, err := m.GetAppliedMigrations()
	if err != nil {
		return fmt.Errorf("failed to get applied migrations: %w", err)
	}

	if len(applied) == 0 {
		fmt.Println("No migrations to rollback")
		return nil
	}

	// Get the latest migration
	var latestMigration string
	for version := range applied {
		if version > latestMigration {
			latestMigration = version
		}
	}

	if err := m.rollbackMigration(latestMigration); err != nil {
		return fmt.Errorf("failed to rollback migration %s: %w", latestMigration, err)
	}

	fmt.Printf("Rolled back migration: %s\n", latestMigration)
	return nil
}

// applyMigration applies a single migration
func (m *Migrator) applyMigration(version string) error {
	// Read migration file
	upFile := filepath.Join(m.migrationsPath, version+".up.sql")
	content, err := os.ReadFile(upFile)
	if err != nil {
		return fmt.Errorf("failed to read migration file %s: %w", upFile, err)
	}

	// Start transaction
	tx, err := m.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Execute migration
	if _, err := tx.Exec(string(content)); err != nil {
		return fmt.Errorf("failed to execute migration: %w", err)
	}

	// Record migration
	if _, err := tx.Exec("INSERT INTO schema_migrations (version) VALUES ($1)", version); err != nil {
		return fmt.Errorf("failed to record migration: %w", err)
	}

	// Commit transaction
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

// rollbackMigration rolls back a single migration
func (m *Migrator) rollbackMigration(version string) error {
	// Read rollback file
	downFile := filepath.Join(m.migrationsPath, version+".down.sql")
	if _, err := os.Stat(downFile); os.IsNotExist(err) {
		return fmt.Errorf("rollback file not found for migration %s", version)
	}

	content, err := os.ReadFile(downFile)
	if err != nil {
		return fmt.Errorf("failed to read rollback file %s: %w", downFile, err)
	}

	// Start transaction
	tx, err := m.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Execute rollback
	if _, err := tx.Exec(string(content)); err != nil {
		return fmt.Errorf("failed to execute rollback: %w", err)
	}

	// Remove migration record
	if _, err := tx.Exec("DELETE FROM schema_migrations WHERE version = $1", version); err != nil {
		return fmt.Errorf("failed to remove migration record: %w", err)
	}

	// Commit transaction
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

// Status shows migration status
func (m *Migrator) Status() error {
	applied, err := m.GetAppliedMigrations()
	if err != nil {
		return fmt.Errorf("failed to get applied migrations: %w", err)
	}

	pending, err := m.GetPendingMigrations()
	if err != nil {
		return fmt.Errorf("failed to get pending migrations: %w", err)
	}

	fmt.Println("Migration Status:")
	fmt.Println("================")

	fmt.Println("Applied migrations:")
	if len(applied) == 0 {
		fmt.Println("  None")
	} else {
		var appliedList []string
		for version := range applied {
			appliedList = append(appliedList, version)
		}
		sort.Strings(appliedList)
		for _, version := range appliedList {
			fmt.Printf("  ✓ %s\n", version)
		}
	}

	fmt.Println("\nPending migrations:")
	if len(pending) == 0 {
		fmt.Println("  None")
	} else {
		for _, version := range pending {
			fmt.Printf("  ○ %s\n", version)
		}
	}

	return nil
}