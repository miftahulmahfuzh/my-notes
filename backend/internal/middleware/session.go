package middleware

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/gpd/my-notes/internal/models"
	"github.com/gpd/my-notes/internal/services"
)

// SessionMiddleware handles session management and validation
type SessionMiddleware struct {
	userService       services.UserServiceInterface
	sessionTimeout    time.Duration
	maxSessions       int
	enableConcurrency bool
}

// SessionConfig holds session configuration
type SessionConfig struct {
	SessionTimeout     time.Duration
	MaxSessions        int
	EnableConcurrency  bool
	InactiveTimeout    time.Duration
	RefreshThreshold   time.Duration
}

// NewSessionMiddleware creates a new session middleware
func NewSessionMiddleware(userService services.UserServiceInterface, config *SessionConfig) *SessionMiddleware {
	if config == nil {
		config = &SessionConfig{
			SessionTimeout:    24 * time.Hour,
			MaxSessions:       5,
			EnableConcurrency: true,
			InactiveTimeout:   7 * 24 * time.Hour, // 7 days
			RefreshThreshold:  5 * time.Minute,
		}
	}

	return &SessionMiddleware{
		userService:       userService,
		sessionTimeout:    config.SessionTimeout,
		maxSessions:       config.MaxSessions,
		enableConcurrency: config.EnableConcurrency,
	}
}

// SessionManager handles session lifecycle
func (sm *SessionMiddleware) SessionManager(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Skip session management for certain endpoints
		if sm.shouldSkipSessionManagement(r) {
			next.ServeHTTP(w, r)
			return
		}

		// Get session ID from context (set by auth middleware)
		sessionID, ok := r.Context().Value("sessionID").(string)
		if !ok || sessionID == "" {
			sm.writeErrorResponse(w, http.StatusUnauthorized, "No session found")
			return
		}

		// Get user from context
		user, ok := r.Context().Value("user").(*models.User)
		if !ok {
			sm.writeErrorResponse(w, http.StatusUnauthorized, "No user found")
			return
		}

		// Validate session
		session, err := sm.validateSession(sessionID, user.ID.String())
		if err != nil {
			sm.writeErrorResponse(w, http.StatusUnauthorized, "Invalid session")
			return
		}

		// Check session timeout
		if sm.isSessionExpired(session) {
			sm.invalidateSession(sessionID)
			sm.writeErrorResponse(w, http.StatusUnauthorized, "Session expired")
			return
		}

		// Check concurrency limits if enabled
		if sm.enableConcurrency {
			if err := sm.checkConcurrencyLimits(user.ID.String()); err != nil {
				sm.writeErrorResponse(w, http.StatusTooManyRequests, err.Error())
				return
			}
		}

		// Update session activity
		sm.updateSessionActivity(sessionID, r)

		// Add session to context
		ctx := context.WithValue(r.Context(), "session", session)

		// Continue with the request
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// validateSession validates a session exists and is valid
func (sm *SessionMiddleware) validateSession(sessionID, userID string) (*models.UserSession, error) {
	// Get active sessions for user
	sessions, err := sm.userService.GetActiveSessions(userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get sessions: %w", err)
	}

	// Find the specific session
	for _, session := range sessions {
		if session.ID == sessionID && session.IsActive {
			return &session, nil
		}
	}

	return nil, fmt.Errorf("session not found")
}

// isSessionExpired checks if a session has expired
func (sm *SessionMiddleware) isSessionExpired(session *models.UserSession) bool {
	return time.Since(session.LastSeen) > sm.sessionTimeout
}

// invalidateSession marks a session as inactive
func (sm *SessionMiddleware) invalidateSession(sessionID string) error {
	// This would typically update the database
	// For now, we'll implement a placeholder
	return nil // Placeholder implementation
}

// checkConcurrencyLimits checks if user has exceeded concurrent session limits
func (sm *SessionMiddleware) checkConcurrencyLimits(userID string) error {
	sessions, err := sm.userService.GetActiveSessions(userID)
	if err != nil {
		return fmt.Errorf("failed to check session limits: %w", err)
	}

	if len(sessions) >= sm.maxSessions {
		return fmt.Errorf("maximum concurrent sessions (%d) exceeded", sm.maxSessions)
	}

	return nil
}

// updateSessionActivity updates the last seen time for a session
func (sm *SessionMiddleware) updateSessionActivity(sessionID string, r *http.Request) {
	go func() {
		ipAddress := getClientIP(r)
		userAgent := r.Header.Get("User-Agent")

		err := sm.userService.UpdateSessionActivity(sessionID, ipAddress, userAgent)
		if err != nil {
			fmt.Printf("Failed to update session activity: %v\n", err)
		}
	}()
}

// shouldSkipSessionManagement determines if session management should be skipped
func (sm *SessionMiddleware) shouldSkipSessionManagement(r *http.Request) bool {
	// Skip for health checks, options, and static assets
	if r.URL.Path == "/health" || r.Method == http.MethodOptions {
		return true
	}

	// Skip for public endpoints
	publicPaths := []string{
		"/api/v1/auth/google",
		"/api/v1/auth/validate",
	}

	for _, path := range publicPaths {
		if r.URL.Path == path {
			return true
		}
	}

	return false
}

// SessionInfo provides session information for logging and monitoring
type SessionInfo struct {
	SessionID     string    `json:"session_id"`
	UserID        string    `json:"user_id"`
	IPAddress     string    `json:"ip_address"`
	UserAgent     string    `json:"user_agent"`
	CreatedAt     time.Time `json:"created_at"`
	LastSeen      time.Time `json:"last_seen"`
	IsActive      bool      `json:"is_active"`
	RequestCount  int       `json:"request_count"`
	Duration      string    `json:"duration"`
}

// SessionActivity tracks session activity for analytics
type SessionActivity struct {
	SessionID    string    `json:"session_id"`
	UserID       string    `json:"user_id"`
	RequestType  string    `json:"request_type"`
	Path         string    `json:"path"`
	Method       string    `json:"method"`
	Timestamp    time.Time `json:"timestamp"`
	ResponseTime int64     `json:"response_time_ms"`
	StatusCode   int       `json:"status_code"`
	UserAgent    string    `json:"user_agent"`
	IPAddress    string    `json:"ip_address"`
}

// SessionTracker tracks session activity for monitoring
type SessionTracker struct {
	activities []SessionActivity
	maxRecords  int
}

// NewSessionTracker creates a new session tracker
func NewSessionTracker(maxRecords int) *SessionTracker {
	if maxRecords <= 0 {
		maxRecords = 1000 // Default limit
	}

	return &SessionTracker{
		activities: make([]SessionActivity, 0, maxRecords),
		maxRecords:  maxRecords,
	}
}

// TrackActivity tracks session activity
func (st *SessionTracker) TrackActivity(activity SessionActivity) {
	st.activities = append(st.activities, activity)

	// Keep only the most recent activities
	if len(st.activities) > st.maxRecords {
		st.activities = st.activities[1:]
	}
}

// GetRecentActivities returns recent activities for a session
func (st *SessionTracker) GetRecentActivities(sessionID string, limit int) []SessionActivity {
	if limit <= 0 {
		limit = 50 // Default limit
	}

	var result []SessionActivity
	count := 0

	// Iterate backwards to get most recent first
	for i := len(st.activities) - 1; i >= 0 && count < limit; i-- {
		if st.activities[i].SessionID == sessionID {
			result = append(result, st.activities[i])
			count++
		}
	}

	return result
}

// GetUserSessions returns all sessions for a user
func (st *SessionTracker) GetUserSessions(userID string) []SessionInfo {
	// This would typically query the database
	// For now, we'll implement a placeholder
	return []SessionInfo{} // Placeholder implementation
}

// SessionMonitor provides session monitoring and cleanup
type SessionMonitor struct {
	userService      services.UserServiceInterface
	sessionTracker   *SessionTracker
	cleanupInterval  time.Duration
	inactiveTimeout  time.Duration
}

// NewSessionMonitor creates a new session monitor
func NewSessionMonitor(userService services.UserServiceInterface, config *SessionConfig) *SessionMonitor {
	if config == nil {
		config = &SessionConfig{
			InactiveTimeout: 7 * 24 * time.Hour, // 7 days
		}
	}

	return &SessionMonitor{
		userService:     userService,
		sessionTracker:  NewSessionTracker(1000),
		cleanupInterval: time.Hour,
		inactiveTimeout: config.InactiveTimeout,
	}
}

// Start starts the session monitor cleanup routine
func (sm *SessionMonitor) Start() {
	ticker := time.NewTicker(sm.cleanupInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			sm.cleanupInactiveSessions()
		}
	}
}

// cleanupInactiveSessions removes inactive sessions
func (sm *SessionMonitor) cleanupInactiveSessions() {
	// This would typically query the database for inactive sessions
	// and mark them as inactive or delete them
	fmt.Printf("Running session cleanup at %s\n", time.Now().Format(time.RFC3339))
}

// GetSessionStatistics returns session statistics
func (sm *SessionMonitor) GetSessionStatistics() map[string]interface{} {
	// This would typically query the database for statistics
	return map[string]interface{}{
		"total_sessions":      0,
		"active_sessions":     0,
		"inactive_sessions":   0,
		"average_session_duration": "0h 0m",
		"last_cleanup_time":   time.Now().Format(time.RFC3339),
	}
}

// writeErrorResponse writes a standardized error response
func (sm *SessionMiddleware) writeErrorResponse(w http.ResponseWriter, code int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)

	response := map[string]interface{}{
		"error":   message,
		"code":    code,
		"success": false,
	}

	json.NewEncoder(w).Encode(response)
}

// SessionAnalytics provides analytics for session data
type SessionAnalytics struct {
	TotalSessions     int               `json:"total_sessions"`
	ActiveSessions    int               `json:"active_sessions"`
	AverageDuration   string            `json:"average_duration"`
	MostActiveTime    string            `json:"most_active_time"`
	TopUserAgents     []UserAgentStat   `json:"top_user_agents"`
	TopIPAddresses    []IPStat          `json:"top_ip_addresses"`
	SessionsByHour    []HourlyStat      `json:"sessions_by_hour"`
}

// UserAgentStat represents user agent statistics
type UserAgentStat struct {
	UserAgent string `json:"user_agent"`
	Count     int    `json:"count"`
	Percentage float64 `json:"percentage"`
}

// IPStat represents IP address statistics
type IPStat struct {
	IPAddress string `json:"ip_address"`
	Count     int    `json:"count"`
	Percentage float64 `json:"percentage"`
}

// HourlyStat represents hourly session statistics
type HourlyStat struct {
	Hour  int `json:"hour"`
	Count int `json:"count"`
}

// GetSessionAnalytics returns session analytics
func (sm *SessionMonitor) GetSessionAnalytics(startDate, endDate time.Time) (*SessionAnalytics, error) {
	// This would typically query the database and calculate analytics
	// For now, we'll return placeholder data
	return &SessionAnalytics{
		TotalSessions:   0,
		ActiveSessions:  0,
		AverageDuration: "0h 0m",
		MostActiveTime:  "14:00",
		TopUserAgents:   []UserAgentStat{},
		TopIPAddresses:  []IPStat{},
		SessionsByHour:  []HourlyStat{},
	}, nil
}

// ExportSessions exports session data to various formats
func (sm *SessionMonitor) ExportSessions(format string, userID string) ([]byte, error) {
	// Get sessions for user
	sessions, err := sm.userService.GetActiveSessions(userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get sessions: %w", err)
	}

	// Convert to export format
	switch format {
	case "json":
		return json.MarshalIndent(sessions, "", "  ")
	case "csv":
		return sm.exportToCSV(sessions)
	default:
		return nil, fmt.Errorf("unsupported format: %s", format)
	}
}

// exportToCSV exports sessions to CSV format
func (sm *SessionMonitor) exportToCSV(sessions []models.UserSession) ([]byte, error) {
	// This would generate CSV data
	// For now, we'll return placeholder data
	csv := "Session ID,User ID,IP Address,User Agent,Created At,Last Seen,Active\n"
	for _, session := range sessions {
		csv += fmt.Sprintf("%s,%s,%s,%s,%s,%s,%t\n",
			session.ID,
			session.UserID,
			session.IPAddress,
			session.UserAgent,
			session.CreatedAt.Format(time.RFC3339),
			session.LastSeen.Format(time.RFC3339),
			session.IsActive,
		)
	}
	return []byte(csv), nil
}