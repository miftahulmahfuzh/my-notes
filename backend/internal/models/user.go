package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// UserPreferences represents user preferences and settings
type UserPreferences struct {
	Theme              string `json:"theme" db:"theme"`
	Language           string `json:"language" db:"language"`
	TimeZone           string `json:"timezone" db:"timezone"`
	EmailNotifications bool   `json:"email_notifications" db:"email_notifications"`
	AutoSave           bool   `json:"auto_save" db:"auto_save"`
	DefaultNoteView    string `json:"default_note_view" db:"default_note_view"`
}

// UserSession represents a user session
type UserSession struct {
	ID        string    `json:"id" db:"id"`
	UserID    string    `json:"user_id" db:"user_id"`
	IPAddress string    `json:"ip_address" db:"ip_address"`
	UserAgent string    `json:"user_agent" db:"user_agent"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	LastSeen  time.Time `json:"last_seen" db:"last_seen"`
	IsActive  bool      `json:"is_active" db:"is_active"`
}

// User represents a user in the system
type User struct {
	ID          uuid.UUID      `json:"id" db:"id"`
	GoogleID    string         `json:"google_id" db:"google_id"`
	Email       string         `json:"email" db:"email"`
	Name        string         `json:"name" db:"name"`
	AvatarURL   *string        `json:"avatar_url,omitempty" db:"avatar_url"`
	Preferences UserPreferences `json:"preferences" db:"preferences"`
	CreatedAt   time.Time      `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at" db:"updated_at"`
}

// UserResponse is the safe response format for user data
type UserResponse struct {
	ID          uuid.UUID      `json:"id"`
	Email       string         `json:"email"`
	Name        string         `json:"name"`
	AvatarURL   *string        `json:"avatar_url,omitempty"`
	Preferences UserPreferences `json:"preferences"`
	CreatedAt   time.Time      `json:"created_at"`
}

// ToResponse converts User to UserResponse (omits sensitive data)
func (u *User) ToResponse() UserResponse {
	return UserResponse{
		ID:          u.ID,
		Email:       u.Email,
		Name:        u.Name,
		AvatarURL:   u.AvatarURL,
		Preferences: u.Preferences,
		CreatedAt:   u.CreatedAt,
	}
}

// Validate validates the user data
func (u *User) Validate() error {
	if u.GoogleID == "" {
		return fmt.Errorf("google_id is required")
	}
	if u.Email == "" {
		return fmt.Errorf("email is required")
	}
	if u.Name == "" {
		return fmt.Errorf("name is required")
	}
	if len(u.Email) > 255 {
		return fmt.Errorf("email too long (max 255 characters)")
	}
	if len(u.Name) > 255 {
		return fmt.Errorf("name too long (max 255 characters)")
	}
	if len(u.GoogleID) > 255 {
		return fmt.Errorf("google_id too long (max 255 characters)")
	}
	return nil
}

// Scan implements the sql.Scanner interface for UUID
func (u *User) Scan(value interface{}) error {
	if value == nil {
		return nil
	}
	switch v := value.(type) {
	case []byte:
		return u.ID.Scan(v)
	case string:
		return u.ID.Scan(v)
	default:
		return fmt.Errorf("cannot scan %T into User", value)
	}
}

// Value implements the driver.Valuer interface for UUID
func (u User) Value() (driver.Value, error) {
	return u.ID.Value()
}

// TableName returns the table name for the User model
func (User) TableName() string {
	return "users"
}

// UserList represents a list of users with pagination
type UserList struct {
	Users []UserResponse `json:"users"`
	Total int            `json:"total"`
	Page  int            `json:"page"`
	Limit int            `json:"limit"`
}

// CreateUserRequest represents the request to create a new user
type CreateUserRequest struct {
	GoogleID  string  `json:"google_id" validate:"required"`
	Email     string  `json:"email" validate:"required,email"`
	Name      string  `json:"name" validate:"required"`
	AvatarURL *string `json:"avatar_url,omitempty"`
}

// UpdateUserRequest represents the request to update a user
type UpdateUserRequest struct {
	Name      *string `json:"name,omitempty"`
	AvatarURL *string `json:"avatar_url,omitempty"`
}

// ToUser converts CreateUserRequest to User model
func (r *CreateUserRequest) ToUser() *User {
	return &User{
		GoogleID:  r.GoogleID,
		Email:     r.Email,
		Name:      r.Name,
		AvatarURL: r.AvatarURL,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
}

// MarshalJSON custom JSON marshaling for User
func (u *User) MarshalJSON() ([]byte, error) {
	type Alias User
	return json.Marshal(&struct {
		*Alias
		CreatedAt string `json:"created_at"`
		UpdatedAt string `json:"updated_at"`
	}{
		Alias:     (*Alias)(u),
		CreatedAt: u.CreatedAt.Format(time.RFC3339),
		UpdatedAt: u.UpdatedAt.Format(time.RFC3339),
	})
}

// UnmarshalJSON custom JSON unmarshaling for User
func (u *User) UnmarshalJSON(data []byte) error {
	type Alias User
	aux := &struct {
		*Alias
		CreatedAt string `json:"created_at"`
		UpdatedAt string `json:"updated_at"`
	}{
		Alias: (*Alias)(u),
	}

	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}

	if aux.CreatedAt != "" {
		if t, err := time.Parse(time.RFC3339, aux.CreatedAt); err == nil {
			u.CreatedAt = t
		}
	}

	if aux.UpdatedAt != "" {
		if t, err := time.Parse(time.RFC3339, aux.UpdatedAt); err == nil {
			u.UpdatedAt = t
		}
	}

	return nil
}