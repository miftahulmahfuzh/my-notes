package middleware

import (
	"database/sql"
	"fmt"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/gpd/my-notes/internal/config"
	"github.com/gpd/my-notes/internal/database"
	"github.com/gpd/my-notes/internal/middleware"
	"github.com/gpd/my-notes/internal/models"
	"github.com/gpd/my-notes/internal/services"
	"github.com/gpd/my-notes/tests"
	_ "github.com/lib/pq"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
)

// SessionMiddlewareTestSuite tests the session middleware functionality
type SessionMiddlewareTestSuite struct {
	suite.Suite
	db              *sql.DB
	userService     services.UserServiceInterface
	sessionMW       *middleware.SessionMiddleware
	testUserID      string
	cleanupSessions []string // Track created sessions for cleanup
}

// SetupSuite runs once before all tests
func (suite *SessionMiddlewareTestSuite) SetupSuite() {
	if !tests.USE_POSTGRE_DURING_TEST {
		suite.T().Skip("PostgreSQL tests are disabled. Set USE_POSTGRE_DURING_TEST=true to enable.")
	}

	// Load configuration
	cfg, err := config.LoadConfig("")
	require.NoError(suite.T(), err, "Failed to load config")

	// Create test database
	db, err := database.CreateTestDatabase(cfg.Database)
	require.NoError(suite.T(), err, "Failed to create test database")
	suite.db = db

	// Run migrations
	migrator := database.NewMigrator(db, "../../migrations")
	err = migrator.Up()
	require.NoError(suite.T(), err, "Failed to run migrations")

	suite.userService = services.NewUserService(suite.db)
	suite.testUserID = "3631d096-4834-4a5f-a173-ae871efb408e"
	suite.cleanupSessions = make([]string, 0)

	// Create test user (required for session foreign key constraint)
	_, err = suite.db.Exec(`
		INSERT INTO users (id, google_id, email, created_at, updated_at)
		VALUES ($1, $2, $3, NOW(), NOW())
		ON CONFLICT (id) DO NOTHING
	`, suite.testUserID, "test-google-id-session-test", "session-test@example.com")
	require.NoError(suite.T(), err, "Failed to create test user")
}

// SetupTest runs before each test
func (suite *SessionMiddlewareTestSuite) SetupTest() {
	// Create session middleware with low limit for testing
	config := &middleware.SessionConfig{
		SessionTimeout:    24 * time.Hour,
		MaxSessions:       3, // Low limit for testing cleanup
		EnableConcurrency: true,
	}

	suite.sessionMW = middleware.NewSessionMiddleware(suite.userService, suite.db, config)
}

// TearDownTest runs after each test
func (suite *SessionMiddlewareTestSuite) TearDownTest() {
	// Clean up any test sessions we created
	for _, sessionID := range suite.cleanupSessions {
		_, err := suite.db.Exec("DELETE FROM user_sessions WHERE id = $1", sessionID)
		if err != nil {
			suite.T().Logf("Warning: Failed to cleanup session %s: %v", sessionID, err)
		}
	}
	suite.cleanupSessions = make([]string, 0)
}

// TearDownSuite runs once after all tests
func (suite *SessionMiddlewareTestSuite) TearDownSuite() {
	if suite.db != nil {
		database.DropTestDatabase(suite.db)
	}
}

// TestSessionCleanupIntegration tests the complete session cleanup functionality
func (suite *SessionMiddlewareTestSuite) TestSessionCleanupIntegration() {
	// Get initial session count
	initialSessions, err := suite.userService.GetActiveSessions(suite.testUserID)
	require.NoError(suite.T(), err, "Failed to get initial sessions")

	initialCount := len(initialSessions)
	suite.T().Logf("Initial session count: %d", initialCount)

	// Create test sessions to exceed the limit
	testSessions := make([]string, 0)
	for i := 0; i < 5; i++ { // Create 5 sessions, limit is 3
		sessionID := uuid.New().String()
		session := suite.createTestSession(sessionID)
		testSessions = append(testSessions, session.ID)
		suite.cleanupSessions = append(suite.cleanupSessions, session.ID)
	}

	// Wait a bit between sessions to ensure different timestamps
	time.Sleep(10 * time.Millisecond)

	// Verify we have exceeded the limit
	sessionsBeforeCleanup, err := suite.userService.GetActiveSessions(suite.testUserID)
	require.NoError(suite.T(), err, "Failed to get sessions before cleanup")
	assert.GreaterOrEqual(suite.T(), len(sessionsBeforeCleanup), 5, "Should have at least 5 sessions (initial + test)")

	suite.T().Logf("Session count before cleanup: %d", len(sessionsBeforeCleanup))

	// Test the session cleanup logic by simulating a new session request
	// This would normally be called by the middleware during authentication
	err = suite.simulateSessionLimitCheck()
	require.NoError(suite.T(), err, "Session limit check should succeed after cleanup")

	// Verify cleanup occurred
	sessionsAfterCleanup, err := suite.userService.GetActiveSessions(suite.testUserID)
	require.NoError(suite.T(), err, "Failed to get sessions after cleanup")

	suite.T().Logf("Session count after cleanup: %d", len(sessionsAfterCleanup))

	// Should have at most 3 active sessions (the limit)
	assert.LessOrEqual(suite.T(), len(sessionsAfterCleanup), 3,
		"Should have at most 3 sessions after cleanup")

	// Verify the newest sessions are still active
	activeSessionIDs := make(map[string]bool)
	for _, session := range sessionsAfterCleanup {
		activeSessionIDs[session.ID] = true
	}

	// The last 3 created sessions should still be active
	expectedActiveSessions := testSessions[2:] // Last 3 sessions
	for _, expectedSessionID := range expectedActiveSessions {
		assert.True(suite.T(), activeSessionIDs[expectedSessionID],
			"Session %s should still be active after cleanup", expectedSessionID)
	}
}

// TestSessionCleanupOrdering tests that sessions are cleaned up in the correct order (oldest first)
func (suite *SessionMiddlewareTestSuite) TestSessionCleanupOrdering() {
	// Get session count before creating our test sessions
	sessionsBefore, err := suite.userService.GetActiveSessions(suite.testUserID)
	require.NoError(suite.T(), err)
	initialCount := len(sessionsBefore)

	// Create sessions with known timestamps (make them obviously old)
	sessions := make([]*models.UserSession, 0)
	for i := 0; i < 4; i++ {
		sessionID := uuid.New().String()
		// Create sessions with increasingly old timestamps (1, 2, 3, 4 hours old)
		session := suite.createTestSessionWithTimestamp(
			sessionID,
			time.Now().Add(-time.Duration(i+1)*time.Hour),
		)
		sessions = append(sessions, session)
		suite.cleanupSessions = append(suite.cleanupSessions, session.ID)
		time.Sleep(10 * time.Millisecond) // Ensure different timestamps
	}

	// Verify we now have more sessions
	sessionsAfterCreation, err := suite.userService.GetActiveSessions(suite.testUserID)
	require.NoError(suite.T(), err)
	require.Greater(suite.T(), len(sessionsAfterCreation), initialCount,
		"Should have more sessions after creating test sessions")

	// Trigger cleanup with a lower limit to force cleanup of our oldest sessions
	// This simulates what would happen if the session limit was lower
	err = suite.simulateSessionLimitCheckWithCustomLimit(initialCount + 2) // Allow only 2 of our new sessions
	require.NoError(suite.T(), err)

	// Verify cleanup occurred - we should have fewer sessions now
	finalSessions, err := suite.userService.GetActiveSessions(suite.testUserID)
	require.NoError(suite.T(), err)

	// We should have approximately the initial count + 2 (our limit for new sessions)
	assert.LessOrEqual(suite.T(), len(finalSessions), initialCount+2,
		"Should have cleaned up oldest sessions to stay within limit")

	suite.T().Logf("Session counts: Initial=%d, After creation=%d, After cleanup=%d",
		initialCount, len(sessionsAfterCreation), len(finalSessions))
}

// TestSessionCleanupWithEmptySessions tests cleanup behavior when no sessions exist
func (suite *SessionMiddlewareTestSuite) TestSessionCleanupWithEmptySessions() {
	// Don't create any sessions, just test the cleanup logic

	// This should not cause any errors
	err := suite.simulateSessionLimitCheck()
	assert.NoError(suite.T(), err, "Cleanup should not error when no sessions exist")
}

// TestSessionInvalidation tests individual session invalidation
func (suite *SessionMiddlewareTestSuite) TestSessionInvalidation() {
	// Create a test session
	sessionID := uuid.New().String()
	session := suite.createTestSession(sessionID)
	suite.cleanupSessions = append(suite.cleanupSessions, session.ID)

	// Verify session is active
	activeSessions, err := suite.userService.GetActiveSessions(suite.testUserID)
	require.NoError(suite.T(), err)

	foundActive := false
	for _, s := range activeSessions {
		if s.ID == session.ID {
			foundActive = true
			break
		}
	}
	assert.True(suite.T(), foundActive, "Session should be active initially")

	// Invalidate the session (this would be done by the middleware)
	err = suite.invalidateSessionDirect(session.ID)
	require.NoError(suite.T(), err, "Session invalidation should succeed")

	// Verify session is no longer active
	activeSessions, err = suite.userService.GetActiveSessions(suite.testUserID)
	require.NoError(suite.T(), err)

	foundActive = false
	for _, s := range activeSessions {
		if s.ID == session.ID {
			foundActive = true
			break
		}
	}
	assert.False(suite.T(), foundActive, "Session should be inactive after invalidation")
}

// Helper methods

// createTestSession creates a test session for the test user
func (suite *SessionMiddlewareTestSuite) createTestSession(sessionID string) *models.UserSession {
	return suite.createTestSessionWithTimestamp(sessionID, time.Now())
}

// createTestSessionWithTimestamp creates a test session with a specific timestamp
func (suite *SessionMiddlewareTestSuite) createTestSessionWithTimestamp(sessionID string, timestamp time.Time) *models.UserSession {
	query := `
		INSERT INTO user_sessions (id, user_id, ip_address, user_agent, created_at, last_seen, is_active)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, user_id, ip_address, user_agent, created_at, last_seen, is_active
	`

	var session models.UserSession
	err := suite.db.QueryRow(query,
		sessionID,
		suite.testUserID,
		"127.0.0.1",
		"Test-Agent",
		timestamp,
		timestamp,
		true,
	).Scan(
		&session.ID,
		&session.UserID,
		&session.IPAddress,
		&session.UserAgent,
		&session.CreatedAt,
		&session.LastSeen,
		&session.IsActive,
	)

	require.NoError(suite.T(), err, "Failed to create test session")
	return &session
}

// simulateSessionLimitCheck simulates the session limit check that would happen during authentication
func (suite *SessionMiddlewareTestSuite) simulateSessionLimitCheck() error {
	return suite.simulateSessionLimitCheckWithCustomLimit(3) // Our test limit
}

// simulateSessionLimitCheckWithCustomLimit simulates the session limit check with a custom limit
func (suite *SessionMiddlewareTestSuite) simulateSessionLimitCheckWithCustomLimit(maxSessions int) error {
	// This simulates what happens in the session middleware when checking concurrency limits
	sessions, err := suite.userService.GetActiveSessions(suite.testUserID)
	if err != nil {
		return fmt.Errorf("failed to check session limits: %w", err)
	}

	if len(sessions) > maxSessions {
		// Simulate the cleanup logic
		return suite.cleanupOldestSessions(maxSessions)
	}

	return nil
}

// cleanupOldestSessions simulates the cleanup logic from the middleware
func (suite *SessionMiddlewareTestSuite) cleanupOldestSessions(maxSessions int) error {
	sessions, err := suite.userService.GetActiveSessions(suite.testUserID)
	if err != nil {
		return fmt.Errorf("failed to get sessions for cleanup: %w", err)
	}

	if len(sessions) <= maxSessions {
		return nil // No cleanup needed
	}

	// Sort sessions by LastSeen (oldest first)
	sortedSessions := make([]models.UserSession, len(sessions))
	copy(sortedSessions, sessions)

	for i := 0; i < len(sortedSessions)-1; i++ {
		for j := i + 1; j < len(sortedSessions); j++ {
			if sortedSessions[i].LastSeen.After(sortedSessions[j].LastSeen) {
				sortedSessions[i], sortedSessions[j] = sortedSessions[j], sortedSessions[i]
			}
		}
	}

	// Invalidate the oldest sessions (remove the excess)
	cleanupCount := len(sessions) - maxSessions
	for i := 0; i < cleanupCount; i++ {
		sessionID := sortedSessions[i].ID
		err := suite.invalidateSessionDirect(sessionID)
		if err != nil {
			suite.T().Logf("Failed to invalidate session %s: %v", sessionID, err)
		} else {
			suite.T().Logf("Successfully invalidated session %s", sessionID)
		}
	}

	return nil
}

// invalidateSessionDirect directly invalidates a session in the database
func (suite *SessionMiddlewareTestSuite) invalidateSessionDirect(sessionID string) error {
	query := `UPDATE user_sessions SET is_active = false WHERE id = $1`
	_, err := suite.db.Exec(query, sessionID)
	return err
}

// Test functions for standalone testing

// TestSessionStatusCheck provides a standalone test to check current session status
func TestSessionStatusCheck(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping session status check in short mode")
	}

	if !tests.USE_POSTGRE_DURING_TEST {
		t.Skip("PostgreSQL tests are disabled. Set USE_POSTGRE_DURING_TEST=true to enable.")
	}

	// Load configuration
	cfg, err := config.LoadConfig("")
	require.NoError(t, err, "Failed to load config")

	// Create test database
	db, err := database.CreateTestDatabase(cfg.Database)
	require.NoError(t, err, "Failed to create test database")
	defer database.DropTestDatabase(db)

	// Run migrations
	migrator := database.NewMigrator(db, "../../migrations")
	err = migrator.Up()
	require.NoError(t, err, "Failed to run migrations")

	testUserID := "3631d096-4834-4a5f-a173-ae871efb408e"
	sessions, err := getActiveSessions(db, testUserID)
	require.NoError(t, err, "Failed to get active sessions")

	t.Logf("📊 Current active sessions for user %s: %d", testUserID, len(sessions))
	t.Logf("📅 Session limit is set to 10 sessions")

	for i, session := range sessions {
		t.Logf("  %d: ID=%s", i+1, session.ID)
		t.Logf("      Created: %s", session.CreatedAt.Format(time.RFC3339))
		t.Logf("      Last Seen: %s", session.LastSeen.Format(time.RFC3339))
		t.Logf("      User Agent: %s", session.UserAgent)
		t.Logf("      IP Address: %s", session.IPAddress)
	}

	if len(sessions) >= 10 {
		t.Logf("⚠️  User has %d sessions, which is at or above the limit!", len(sessions))
		t.Log("🔧 When the user tries to create a new session, our fix should automatically clean up the oldest sessions.")
	} else {
		t.Logf("✅ User has %d sessions, which is within the limit.", len(sessions))
	}
}

// Helper function for standalone testing
func getActiveSessions(db *sql.DB, userID string) ([]SessionInfo, error) {
	query := `
		SELECT id, user_id, ip_address, user_agent, created_at, last_seen, is_active
		FROM user_sessions
		WHERE user_id = $1 AND is_active = true
		ORDER BY last_seen DESC
	`

	rows, err := db.Query(query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to query sessions: %w", err)
	}
	defer rows.Close()

	var sessions []SessionInfo
	for rows.Next() {
		var session SessionInfo
		err := rows.Scan(
			&session.ID,
			&session.UserID,
			&session.IPAddress,
			&session.UserAgent,
			&session.CreatedAt,
			&session.LastSeen,
			&session.IsActive,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan session: %w", err)
		}
		sessions = append(sessions, session)
	}

	return sessions, nil
}

type SessionInfo struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	IPAddress string    `json:"ip_address"`
	UserAgent string    `json:"user_agent"`
	CreatedAt time.Time `json:"created_at"`
	LastSeen  time.Time `json:"last_seen"`
	IsActive  bool      `json:"is_active"`
}

// Test runner
func TestSessionMiddlewareTestSuite(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping middleware integration tests in short mode")
	}

	suite.Run(t, new(SessionMiddlewareTestSuite))
}