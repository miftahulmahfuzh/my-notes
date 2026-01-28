package tests

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestMigrationsPathFromProjectRoot verifies that migrations can be found
// when the server is run from the project root (which is how deploy_backend.sh works)
func TestMigrationsPathFromProjectRoot(t *testing.T) {
	// Get the current file's location - this should be backend/tests/
	_, filename, _, ok := runtime.Caller(0)
	require.True(t, ok, "Could not get caller information")

	testsDir := filepath.Dir(filename)
	backendDir := filepath.Dir(testsDir)
	projectRoot := filepath.Dir(backendDir)

	// The migrations directory should be at backend/migrations from project root
	migrationsPath := filepath.Join(projectRoot, "backend", "migrations")

	// Verify the migrations directory exists
	info, err := os.Stat(migrationsPath)
	require.NoError(t, err, "Migrations directory should exist at %s", migrationsPath)
	assert.True(t, info.IsDir(), "Migrations path should be a directory")

	// List migration files to verify they're there
	entries, err := os.ReadDir(migrationsPath)
	require.NoError(t, err, "Should be able to read migrations directory")

	// Verify there are migration files
	assert.Greater(t, len(entries), 0, "Migrations directory should contain migration files")

	// Check that at least one .sql file exists
	foundSQL := false
	for _, entry := range entries {
		if !entry.IsDir() && filepath.Ext(entry.Name()) == ".sql" {
			foundSQL = true
			break
		}
	}
	assert.True(t, foundSQL, "Migrations directory should contain at least one .sql file")
}

// TestMigrationsPathWithWrongPath demonstrates that using "migrations" fails
// when running from project root (this demonstrates the bug)
func TestMigrationsPathWithWrongPath(t *testing.T) {
	// Save current working directory
	originalWd, _ := os.Getwd()
	defer os.Chdir(originalWd)

	// Get the current file's location - this should be backend/tests/
	_, filename, _, ok := runtime.Caller(0)
	require.True(t, ok, "Could not get caller information")

	testsDir := filepath.Dir(filename)
	backendDir := filepath.Dir(testsDir)
	projectRoot := filepath.Dir(backendDir)

	// Change to project root (simulating how deploy_backend.sh runs the server)
	err := os.Chdir(projectRoot)
	require.NoError(t, err, "Should be able to change to project root")

	// Using "migrations" from project root should fail because the actual path is "backend/migrations"
	_, err = os.Stat("migrations")

	// This test expects the error (demonstrating the bug)
	assert.Error(t, err, "Using 'migrations' from project root should fail")
	assert.True(t, os.IsNotExist(err), "Error should be 'not found'")
}

// TestMigrationsPathWithCorrectPath demonstrates that using "backend/migrations"
// works when running from project root (this demonstrates the fix)
func TestMigrationsPathWithCorrectPath(t *testing.T) {
	// Save current working directory
	originalWd, _ := os.Getwd()
	defer os.Chdir(originalWd)

	// Get the current file's location - this should be backend/tests/
	_, filename, _, ok := runtime.Caller(0)
	require.True(t, ok, "Could not get caller information")

	testsDir := filepath.Dir(filename)
	backendDir := filepath.Dir(testsDir)
	projectRoot := filepath.Dir(backendDir)

	// Change to project root (simulating how deploy_backend.sh runs the server)
	err := os.Chdir(projectRoot)
	require.NoError(t, err, "Should be able to change to project root")

	// Using "backend/migrations" from project root should work
	info, err := os.Stat("backend/migrations")

	// This should succeed (demonstrating the correct fix)
	assert.NoError(t, err, "Using 'backend/migrations' from project root should work")
	assert.True(t, info.IsDir(), "Should be a directory")
}
