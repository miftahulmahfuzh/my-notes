package services

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/gpd/my-notes/internal/auth"
	"github.com/gpd/my-notes/internal/models"
	"github.com/google/uuid"
)

// UserServiceInterface defines the interface for user service operations
type UserServiceInterface interface {
	CreateOrUpdateFromGoogle(userInfo *auth.GoogleUserInfo) (*models.User, error)
	GetByID(userID string) (*models.User, error)
	Update(user *models.User) (*models.User, error)
	Delete(userID string) error
	CreateSession(userID, ipAddress, userAgent string) (*models.UserSession, error)
	UpdateSessionActivity(sessionID, ipAddress, userAgent string) error
	GetActiveSessions(userID string) ([]models.UserSession, error)
	DeleteSession(sessionID, userID string) error
	DeleteAllSessions(userID string) error
	GetUserStats(userID string) (*models.UserStats, error)
	SearchUsers(query string, page, limit int) ([]models.User, int, error)
}

// UserService handles user-related operations
type UserService struct {
	db *sql.DB
}

// NewUserService creates a new UserService instance
func NewUserService(db *sql.DB) *UserService {
	return &UserService{
		db: db,
	}
}

// CreateOrUpdateFromGoogle creates a new user or updates an existing one from Google OAuth info
func (s *UserService) CreateOrUpdateFromGoogle(userInfo *auth.GoogleUserInfo) (*models.User, error) {
	ctx := context.Background()

	// Check if user exists
	var user models.User
	err := s.db.QueryRowContext(ctx,
		`SELECT id, google_id, email, avatar_url, created_at, updated_at
		 FROM users WHERE google_id = $1`,
		userInfo.ID).Scan(
		&user.ID, &user.GoogleID, &user.Email, &user.AvatarURL,
		&user.CreatedAt, &user.UpdatedAt)

	if err == sql.ErrNoRows {
		// Create new user
		user = models.User{
			ID:        uuid.New(),
			GoogleID:  userInfo.ID,
			Email:     userInfo.Email,
			AvatarURL: &userInfo.Picture,
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		}

		err = s.createUser(ctx, &user)
		if err != nil {
			return nil, fmt.Errorf("failed to create user: %w", err)
		}
	} else if err != nil {
		return nil, fmt.Errorf("failed to query user: %w", err)
	} else {
		// Update existing user
		user.AvatarURL = &userInfo.Picture
		user.UpdatedAt = time.Now()

		err = s.updateUser(ctx, &user)
		if err != nil {
			return nil, fmt.Errorf("failed to update user: %w", err)
		}
	}

	return &user, nil
}

// GetByID retrieves a user by ID
func (s *UserService) GetByID(userID string) (*models.User, error) {
	ctx := context.Background()

	var user models.User
	err := s.db.QueryRowContext(ctx,
		`SELECT id, google_id, email, avatar_url, created_at, updated_at
		 FROM users WHERE id = $1`,
		userID).Scan(
		&user.ID, &user.GoogleID, &user.Email, &user.AvatarURL,
		&user.CreatedAt, &user.UpdatedAt)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("user not found")
	} else if err != nil {
		return nil, fmt.Errorf("failed to query user: %w", err)
	}

	return &user, nil
}

// GetByEmail retrieves a user by email
func (s *UserService) GetByEmail(email string) (*models.User, error) {
	ctx := context.Background()

	var user models.User
	err := s.db.QueryRowContext(ctx,
		`SELECT id, google_id, email, avatar_url, created_at, updated_at
		 FROM users WHERE email = $1`,
		email).Scan(
		&user.ID, &user.GoogleID, &user.Email, &user.AvatarURL,
		&user.CreatedAt, &user.UpdatedAt)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("user not found")
	} else if err != nil {
		return nil, fmt.Errorf("failed to query user: %w", err)
	}

	return &user, nil
}

// CreateSession creates a new user session
func (s *UserService) CreateSession(userID, ipAddress, userAgent string) (*models.UserSession, error) {
	ctx := context.Background()

	session := &models.UserSession{
		ID:        uuid.New().String(),
		UserID:    userID,
		IPAddress: ipAddress,
		UserAgent: userAgent,
		CreatedAt: time.Now(),
		LastSeen:  time.Now(),
		IsActive:  true,
	}

	query := `
		INSERT INTO user_sessions (id, user_id, ip_address, user_agent, created_at, last_seen, is_active)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`

	_, err := s.db.ExecContext(ctx, query,
		session.ID, session.UserID, session.IPAddress, session.UserAgent,
		session.CreatedAt, session.LastSeen, session.IsActive)

	if err != nil {
		return nil, fmt.Errorf("failed to create user session: %w", err)
	}

	return session, nil
}

// Update updates an existing user
func (s *UserService) Update(user *models.User) (*models.User, error) {
	ctx := context.Background()

	user.UpdatedAt = time.Now()

	query := `
		UPDATE users
		SET avatar_url = $1, updated_at = $2
		WHERE id = $3
		RETURNING id, google_id, email, avatar_url, created_at, updated_at
	`

	err := s.db.QueryRowContext(ctx, query,
		user.AvatarURL, user.UpdatedAt, user.ID).Scan(
		&user.ID, &user.GoogleID, &user.Email, &user.AvatarURL,
		&user.CreatedAt, &user.UpdatedAt)

	if err != nil {
		return nil, fmt.Errorf("failed to update user: %w", err)
	}

	return user, nil
}

// Delete deletes a user and all associated data
func (s *UserService) Delete(userID string) error {
	ctx := context.Background()

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Delete user sessions first
	_, err = tx.ExecContext(ctx, "DELETE FROM user_sessions WHERE user_id = $1", userID)
	if err != nil {
		return fmt.Errorf("failed to delete user sessions: %w", err)
	}

	// TODO: Delete user's notes and tags when those tables are created

	// Delete the user
	_, err = tx.ExecContext(ctx, "DELETE FROM users WHERE id = $1", userID)
	if err != nil {
		return fmt.Errorf("failed to delete user: %w", err)
	}

	// Commit the transaction
	if err = tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

// UpdateSessionActivity updates the last seen time for a session
func (s *UserService) UpdateSessionActivity(sessionID, ipAddress, userAgent string) error {
	ctx := context.Background()

	query := `
		UPDATE user_sessions
		SET last_seen = $1, ip_address = $2, user_agent = $3
		WHERE id = $4 AND is_active = true
	`

	_, err := s.db.ExecContext(ctx, query, time.Now(), ipAddress, userAgent, sessionID)
	if err != nil {
		return fmt.Errorf("failed to update session activity: %w", err)
	}

	return nil
}

// GetActiveSessions retrieves all active sessions for a user
func (s *UserService) GetActiveSessions(userID string) ([]models.UserSession, error) {
	ctx := context.Background()

	query := `
		SELECT id, user_id, ip_address, user_agent, created_at, last_seen, is_active
		FROM user_sessions
		WHERE user_id = $1 AND is_active = true
		ORDER BY last_seen DESC
	`

	rows, err := s.db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user sessions: %w", err)
	}
	defer rows.Close()

	var sessions []models.UserSession
	for rows.Next() {
		var session models.UserSession
		err := rows.Scan(&session.ID, &session.UserID, &session.IPAddress,
			&session.UserAgent, &session.CreatedAt, &session.LastSeen, &session.IsActive)
		if err != nil {
			return nil, fmt.Errorf("failed to scan session: %w", err)
		}
		sessions = append(sessions, session)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating sessions: %w", err)
	}

	return sessions, nil
}

// DeleteSession deletes a specific session for a user
func (s *UserService) DeleteSession(sessionID, userID string) error {
	ctx := context.Background()

	query := `UPDATE user_sessions SET is_active = false WHERE id = $1 AND user_id = $2`
	_, err := s.db.ExecContext(ctx, query, sessionID, userID)
	if err != nil {
		return fmt.Errorf("failed to delete session: %w", err)
	}

	return nil
}

// DeleteAllSessions deletes all active sessions for a user
func (s *UserService) DeleteAllSessions(userID string) error {
	ctx := context.Background()

	query := `UPDATE user_sessions SET is_active = false WHERE user_id = $1`
	_, err := s.db.ExecContext(ctx, query, userID)
	if err != nil {
		return fmt.Errorf("failed to delete all sessions: %w", err)
	}

	return nil
}

// GetUserStats retrieves user statistics
func (s *UserService) GetUserStats(userID string) (*models.UserStats, error) {
	ctx := context.Background()

	stats := &models.UserStats{}

	// Get user info for account age
	var createdAt time.Time
	err := s.db.QueryRowContext(ctx, "SELECT created_at FROM users WHERE id = $1", userID).Scan(&createdAt)
	if err != nil {
		return nil, fmt.Errorf("failed to get user creation time: %w", err)
	}

	// Calculate account age in days
	stats.AccountAgeDays = int(time.Since(createdAt).Hours() / 24)

	// Get total notes (placeholder - will be implemented when notes table exists)
	err = s.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM notes WHERE user_id = $1", userID).Scan(&stats.TotalNotes)
	if err != nil {
		stats.TotalNotes = 0 // Set to 0 if notes table doesn't exist yet
	}

	// Get total tags (placeholder - will be implemented when tags table exists)
	err = s.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM tags WHERE user_id = $1", userID).Scan(&stats.TotalTags)
	if err != nil {
		stats.TotalTags = 0 // Set to 0 if tags table doesn't exist yet
	}

	// Get active sessions count
	err = s.db.QueryRowContext(ctx,
		"SELECT COUNT(*) FROM user_sessions WHERE user_id = $1 AND is_active = true",
		userID).Scan(&stats.ActiveSessions)
	if err != nil {
		return nil, fmt.Errorf("failed to get active sessions count: %w", err)
	}

	// Get last login time
	var lastLogin sql.NullTime
	err = s.db.QueryRowContext(ctx,
		"SELECT MAX(last_seen) FROM user_sessions WHERE user_id = $1",
		userID).Scan(&lastLogin)
	if err != nil {
		return nil, fmt.Errorf("failed to get last login time: %w", err)
	}

	if lastLogin.Valid {
		stats.LastLoginAt = lastLogin.Time.Format(time.RFC3339)
	} else {
		stats.LastLoginAt = createdAt.Format(time.RFC3339)
	}

	return stats, nil
}

// SearchUsers searches for users by email
func (s *UserService) SearchUsers(query string, page, limit int) ([]models.User, int, error) {
	ctx := context.Background()

	offset := (page - 1) * limit

	// Get total count
	var total int
	err := s.db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM users
		 WHERE email ILIKE $1`,
		"%"+query+"%").Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to get total users count: %w", err)
	}

	// Get users with pagination
	dbQuery := `
		SELECT id, google_id, email, avatar_url, created_at, updated_at
		FROM users
		WHERE email ILIKE $1
		ORDER BY email
		LIMIT $2 OFFSET $3
	`

	rows, err := s.db.QueryContext(ctx, dbQuery, "%"+query+"%", limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to search users: %w", err)
	}
	defer rows.Close()

	var users []models.User
	for rows.Next() {
		var user models.User
		err := rows.Scan(&user.ID, &user.GoogleID, &user.Email, &user.AvatarURL,
			&user.CreatedAt, &user.UpdatedAt)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan user: %w", err)
		}
		users = append(users, user)
	}

	if err = rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("error iterating users: %w", err)
	}

	return users, total, nil
}

// Private helper methods

func (s *UserService) createUser(ctx context.Context, user *models.User) error {
	query := `
		INSERT INTO users (id, google_id, email, avatar_url, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6)
	`

	_, err := s.db.ExecContext(ctx, query,
		user.ID, user.GoogleID, user.Email, user.AvatarURL,
		user.CreatedAt, user.UpdatedAt)

	return err
}

func (s *UserService) updateUser(ctx context.Context, user *models.User) error {
	query := `
		UPDATE users
		SET avatar_url = $1, updated_at = $2
		WHERE id = $3
	`

	_, err := s.db.ExecContext(ctx, query,
		user.AvatarURL, user.UpdatedAt, user.ID)

	return err
}