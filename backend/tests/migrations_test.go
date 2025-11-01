package tests

import (
	"database/sql"
	"testing"
	"time"

	"github.com/gpd/my-notes/internal/database"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMigrationsUp(t *testing.T) {
	// Create test database
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Check that all tables exist
	tables := []string{
		"schema_migrations",
		"users",
		"notes",
		"tags",
		"note_tags",
	}

	for _, table := range tables {
		t.Run("Table_"+table, func(t *testing.T) {
			var exists bool
			query := `
				SELECT EXISTS (
					SELECT FROM information_schema.tables
					WHERE table_schema = 'public'
					AND table_name = $1
				)
			`
			err := db.QueryRow(query, table).Scan(&exists)
			require.NoError(t, err)
			assert.True(t, exists, "Table %s should exist", table)
		})
	}
}

func TestMigrationsRollback(t *testing.T) {
	// Create test database
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Get migrator
	migrator := database.NewMigrator(db, "../../migrations")

	// Check that we can rollback (at least one migration)
	err := migrator.Down()
	assert.NoError(t, err)

	// Check that the last migration was rolled back
	// The last migration should be the note_tags table
	var exists bool
	query := `
		SELECT EXISTS (
			SELECT FROM information_schema.tables
			WHERE table_schema = 'public'
			AND table_name = 'note_tags'
		)
	`
	err = db.QueryRow(query).Scan(&exists)
	require.NoError(t, err)
	assert.False(t, exists, "note_tags table should not exist after rollback")

	// Check that other tables still exist
	tables := []string{
		"schema_migrations",
		"users",
		"notes",
		"tags",
	}

	for _, table := range tables {
		t.Run("Table_StillExists_"+table, func(t *testing.T) {
			query := `
				SELECT EXISTS (
					SELECT FROM information_schema.tables
					WHERE table_schema = 'public'
					AND table_name = $1
				)
			`
			err := db.QueryRow(query, table).Scan(&exists)
			require.NoError(t, err)
			assert.True(t, exists, "Table %s should still exist", table)
		})
	}
}

func TestMigrationStatus(t *testing.T) {
	// Create test database
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Get migrator
	migrator := database.NewMigrator(db, "../../migrations")

	// Check status (this should not error)
	err := migrator.Status()
	assert.NoError(t, err)
}

func TestUsersTableStructure(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Check columns
	expectedColumns := map[string]string{
		"id":         "uuid",
		"google_id":  "character varying",
		"email":      "character varying",
		"name":       "character varying",
		"avatar_url": "text",
		"created_at": "timestamp with time zone",
		"updated_at": "timestamp with time zone",
	}

	for column, expectedType := range expectedColumns {
		t.Run("Column_"+column, func(t *testing.T) {
			var dataType string
			query := `
				SELECT data_type
				FROM information_schema.columns
				WHERE table_name = 'users'
				AND column_name = $1
			`
			err := db.QueryRow(query, column).Scan(&dataType)
			require.NoError(t, err)
			assert.Equal(t, expectedType, dataType)
		})
	}

	// Check constraints
	t.Run("Constraints", func(t *testing.T) {
		// Test unique constraint on google_id
		userID := CreateTestUser(t, db, "test1@example.com")

		// Try to create another user with same google_id (should fail)
		query := `
			INSERT INTO users (id, google_id, email, name, created_at, updated_at)
			VALUES ($1, $2, $3, $4, NOW(), NOW())
		`
		_, err := db.Exec(query, "test_user_2", "google_test_user_1", "test2@example.com", "Test User 2")
		assert.Error(t, err, "Should fail due to unique constraint on google_id")

		// Test unique constraint on email
		_, err = db.Exec(query, "test_user_3", "google_test_user_3", "test1@example.com", "Test User 3")
		assert.Error(t, err, "Should fail due to unique constraint on email")
	})

	// Test updated_at trigger
	t.Run("UpdatedAtTrigger", func(t *testing.T) {
		// Create user
		userID := CreateTestUser(t, db, "trigger@example.com")

		// Get initial updated_at
		var initialUpdatedAt time.Time
		query := `SELECT updated_at FROM users WHERE id = $1`
		err := db.QueryRow(query, userID).Scan(&initialUpdatedAt)
		require.NoError(t, err)

		// Wait a bit to ensure different timestamp
		time.Sleep(10 * time.Millisecond)

		// Update user
		_, err = db.Exec("UPDATE users SET name = $1 WHERE id = $2", "Updated Name", userID)
		require.NoError(t, err)

		// Check that updated_at changed
		var newUpdatedAt time.Time
		err = db.QueryRow(query, userID).Scan(&newUpdatedAt)
		require.NoError(t, err)
		assert.True(t, newUpdatedAt.After(initialUpdatedAt), "updated_at should have changed")
	})
}

func TestNotesTableStructure(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Check columns
	expectedColumns := map[string]string{
		"id":         "uuid",
		"user_id":    "uuid",
		"title":      "character varying",
		"content":    "text",
		"created_at": "timestamp with time zone",
		"updated_at": "timestamp with time zone",
		"version":    "integer",
	}

	for column, expectedType := range expectedColumns {
		t.Run("Column_"+column, func(t *testing.T) {
			var dataType string
			query := `
				SELECT data_type
				FROM information_schema.columns
				WHERE table_name = 'notes'
				AND column_name = $1
			`
			err := db.QueryRow(query, column).Scan(&dataType)
			require.NoError(t, err)
			assert.Equal(t, expectedType, dataType)
		})
	}

	// Test foreign key constraint
	t.Run("ForeignKeyConstraint", func(t *testing.T) {
		// Try to create note with non-existent user_id (should fail)
		query := `
			INSERT INTO notes (id, user_id, content, created_at, updated_at, version)
			VALUES ($1, $2, $3, NOW(), NOW(), 1)
		`
		_, err := db.Exec(query, "test_note_id", "00000000-0000-0000-0000-000000000000", "Test content")
		assert.Error(t, err, "Should fail due to foreign key constraint")
	})

	// Test version increment trigger
	t.Run("VersionIncrementTrigger", func(t *testing.T) {
		// Create user and note
		userID := CreateTestUser(t, db, "version@example.com")
		noteID := CreateTestNote(t, db, userID, "Test Note", "Test content")

		// Get initial version
		var initialVersion int
		query := `SELECT version FROM notes WHERE id = $1`
		err := db.QueryRow(query, noteID).Scan(&initialVersion)
		require.NoError(t, err)
		assert.Equal(t, 1, initialVersion)

		// Update note
		_, err = db.Exec("UPDATE notes SET content = $1 WHERE id = $2", "Updated content", noteID)
		require.NoError(t, err)

		// Check that version incremented
		var newVersion int
		err = db.QueryRow(query, noteID).Scan(&newVersion)
		require.NoError(t, err)
		assert.Equal(t, 2, newVersion, "Version should have incremented")
	})

	// Test CASCADE delete
	t.Run("CascadeDelete", func(t *testing.T) {
		// Create user and note
		userID := CreateTestUser(t, db, "cascade@example.com")
		noteID := CreateTestNote(t, db, userID, "Test Note", "Test content")

		// Verify note exists
		AssertExists(t, db, "notes", "id = $1", noteID)

		// Delete user
		_, err := db.Exec("DELETE FROM users WHERE id = $1", userID)
		require.NoError(t, err)

		// Check that note was also deleted (CASCADE)
		AssertNotExists(t, db, "notes", "id = $1", noteID)
	})
}

func TestTagsTableStructure(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Check columns
	expectedColumns := map[string]string{
		"id":         "uuid",
		"name":       "character varying",
		"created_at": "timestamp with time zone",
	}

	for column, expectedType := range expectedColumns {
		t.Run("Column_"+column, func(t *testing.T) {
			var dataType string
			query := `
				SELECT data_type
				FROM information_schema.columns
				WHERE table_name = 'tags'
				AND column_name = $1
			`
			err := db.QueryRow(query, column).Scan(&dataType)
			require.NoError(t, err)
			assert.Equal(t, expectedType, dataType)
		})
	}

	// Test unique constraint on name
	t.Run("UniqueNameConstraint", func(t *testing.T) {
		tagID := CreateTestTag(t, db, "#test")

		// Try to create another tag with same name (should fail)
		query := `
			INSERT INTO tags (id, name, created_at)
			VALUES ($1, $2, NOW())
		`
		_, err := db.Exec(query, "test_tag_2", "#test")
		assert.Error(t, err, "Should fail due to unique constraint on name")
	})

	// Test valid_tag_name constraint
	t.Run("ValidTagNameConstraint", func(t *testing.T) {
		// Try to create tag with invalid name (should fail)
		query := `
			INSERT INTO tags (id, name, created_at)
			VALUES ($1, $2, NOW())
		`
		_, err := db.Exec(query, "test_tag_invalid", "invalid-tag") // doesn't start with #
		assert.Error(t, err, "Should fail due to valid_tag_name constraint")

		_, err = db.Exec(query, "test_tag_invalid2", "#invalid tag") // contains space
		assert.Error(t, err, "Should fail due to valid_tag_name constraint")
	})
}

func TestNoteTagsTableStructure(t *testing.T) {
	db := SetupTestDB(t)
	defer CleanupTestDB(t, db)

	// Check columns
	expectedColumns := map[string]string{
		"note_id":    "uuid",
		"tag_id":     "uuid",
		"created_at": "timestamp with time zone",
	}

	for column, expectedType := range expectedColumns {
		t.Run("Column_"+column, func(t *testing.T) {
			var dataType string
			query := `
				SELECT data_type
				FROM information_schema.columns
				WHERE table_name = 'note_tags'
				AND column_name = $1
			`
			err := db.QueryRow(query, column).Scan(&dataType)
			require.NoError(t, err)
			assert.Equal(t, expectedType, dataType)
		})
	}

	// Test primary key constraint
	t.Run("PrimaryKeyConstraint", func(t *testing.T) {
		// Create user, note, and tag
		userID := CreateTestUser(t, db, "jointable@example.com")
		noteID := CreateTestNote(t, db, userID, "Test Note", "Test content")
		tagID := CreateTestTag(t, db, "#test")

		// Create note-tag relationship
		query := `
			INSERT INTO note_tags (note_id, tag_id, created_at)
			VALUES ($1, $2, NOW())
		`
		_, err := db.Exec(query, noteID, tagID)
		require.NoError(t, err)

		// Try to create the same relationship (should fail)
		_, err = db.Exec(query, noteID, tagID)
		assert.Error(t, err, "Should fail due to primary key constraint")
	})

	// Test foreign key constraints
	t.Run("ForeignKeyConstraints", func(t *testing.T) {
		// Try to create relationship with non-existent note
		query := `
			INSERT INTO note_tags (note_id, tag_id, created_at)
			VALUES ($1, $2, NOW())
		`
		_, err := db.Exec(query, "00000000-0000-0000-0000-000000000000", "00000000-0000-0000-0000-000000000000")
		assert.Error(t, err, "Should fail due to foreign key constraint on note_id")
	})

	// Test CASCADE delete
	t.Run("CascadeDelete", func(t *testing.T) {
		// Create user, note, and tag
		userID := CreateTestUser(t, db, "cascade2@example.com")
		noteID := CreateTestNote(t, db, userID, "Test Note", "Test content")
		tagID := CreateTestTag(t, db, "#test2")

		// Create relationship
		query := `
			INSERT INTO note_tags (note_id, tag_id, created_at)
			VALUES ($1, $2, NOW())
		`
		_, err := db.Exec(query, noteID, tagID)
		require.NoError(t, err)

		// Verify relationship exists
		AssertExists(t, db, "note_tags", "note_id = $1 AND tag_id = $2", noteID, tagID)

		// Delete note
		_, err = db.Exec("DELETE FROM notes WHERE id = $1", noteID)
		require.NoError(t, err)

		// Check that relationship was also deleted (CASCADE)
		AssertNotExists(t, db, "note_tags", "note_id = $1 AND tag_id = $2", noteID, tagID)
	})
}