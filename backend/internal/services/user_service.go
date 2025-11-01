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
		`SELECT id, google_id, email, name, avatar_url, preferences, created_at, updated_at
		 FROM users WHERE google_id = $1`,
		userInfo.ID).Scan(
		&user.ID, &user.GoogleID, &user.Email, &user.Name, &user.AvatarURL,
		&user.Preferences, &user.CreatedAt, &user.UpdatedAt)

	if err == sql.ErrNoRows {
		// Create new user
		user = models.User{
			ID:        uuid.New(),
			GoogleID:  userInfo.ID,
			Email:     userInfo.Email,
			Name:      userInfo.Name,
			AvatarURL: &userInfo.Picture,
			Preferences: models.UserPreferences{
				Theme:              "light",
				Language:           "en",
				TimeZone:           "UTC",
				EmailNotifications: true,
				AutoSave:           true,
				DefaultNoteView:    "grid",
			},
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
		user.Name = userInfo.Name
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
		`SELECT id, google_id, email, name, avatar_url, preferences, created_at, updated_at
		 FROM users WHERE id = $1`,
		userID).Scan(
		&user.ID, &user.GoogleID, &user.Email, &user.Name, &user.AvatarURL,
		&user.Preferences, &user.CreatedAt, &user.UpdatedAt)

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
		`SELECT id, google_id, email, name, avatar_url, preferences, created_at, updated_at
		 FROM users WHERE email = $1`,
		email).Scan(
		&user.ID, &user.GoogleID, &user.Email, &user.Name, &user.AvatarURL,
		&user.Preferences, &user.CreatedAt, &user.UpdatedAt)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("user not found")
	} else if err != nil {
		return nil, fmt.Errorf("failed to query user: %w", err)
	}

	return &user, nil
}

// UpdatePreferences updates user preferences
func (s *UserService) UpdatePreferences(userID string, preferences models.UserPreferences) error {
	ctx := context.Background()

	query := `
		UPDATE users
		SET preferences = $1, updated_at = $2
		WHERE id = $3
	`

	_, err := s.db.ExecContext(ctx, query, preferences, time.Now(), userID)
	if err != nil {
		return fmt.Errorf("failed to update user preferences: %w", err)
	}

	return nil
}

// GetPreferences retrieves user preferences
func (s *UserService) GetPreferences(userID string) (*models.UserPreferences, error) {
	ctx := context.Background()

	var preferences models.UserPreferences
	err := s.db.QueryRowContext(ctx,
		"SELECT preferences FROM users WHERE id = $1", userID).Scan(&preferences)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("user not found")
	} else if err != nil {
		return nil, fmt.Errorf("failed to get user preferences: %w", err)
	}

	return &preferences, nil
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

// InvalidateSession invalidates a specific session
func (s *UserService) InvalidateSession(sessionID string) error {
	ctx := context.Background()

	query := `UPDATE user_sessions SET is_active = false WHERE id = $1`
	_, err := s.db.ExecContext(ctx, query, sessionID)
	if err != nil {
		return fmt.Errorf("failed to invalidate session: %w", err)
	}

	return nil
}

// InvalidateAllUserSessions invalidates all sessions for a user
func (s *UserService) InvalidateAllUserSessions(userID string) error {
	ctx := context.Background()

	query := `UPDATE user_sessions SET is_active = false WHERE user_id = $1`
	_, err := s.db.ExecContext(ctx, query, userID)
	if err != nil {
		return fmt.Errorf("failed to invalidate user sessions: %w", err)
	}

	return nil
}

// Private helper methods

func (s *UserService) createUser(ctx context.Context, user *models.User) error {
	query := `
		INSERT INTO users (id, google_id, email, name, avatar_url, preferences, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`

	_, err := s.db.ExecContext(ctx, query,
		user.ID, user.GoogleID, user.Email, user.Name, user.AvatarURL,
		user.Preferences, user.CreatedAt, user.UpdatedAt)

	return err
}

func (s *UserService) updateUser(ctx context.Context, user *models.User) error {
	query := `
		UPDATE users
		SET name = $1, avatar_url = $2, updated_at = $3
		WHERE id = $4
	`

	_, err := s.db.ExecContext(ctx, query,
		user.Name, user.AvatarURL, user.UpdatedAt, user.ID)

	return err
}