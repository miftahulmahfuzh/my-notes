package security

import (
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"
)

// SecurityEvent represents a security-related event
type SecurityEvent struct {
	ID        string                 `json:"id"`
	Type      SecurityEventType      `json:"type"`
	Level     SecurityEventLevel     `json:"level"`
	UserID    string                 `json:"user_id,omitempty"`
	IPAddress string                 `json:"ip_address"`
	UserAgent string                 `json:"user_agent,omitempty"`
	Path      string                 `json:"path"`
	Method    string                 `json:"method"`
	Message   string                 `json:"message"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
	Timestamp time.Time              `json:"timestamp"`
}

// SecurityEventType represents different types of security events
type SecurityEventType string

const (
	EventAuthenticationFailure SecurityEventType = "auth_failure"
	EventAuthenticationSuccess SecurityEventType = "auth_success"
	EventRateLimitExceeded    SecurityEventType = "rate_limit_exceeded"
	EventSessionInvalidated   SecurityEventType = "session_invalidated"
	EventSuspiciousActivity   SecurityEventType = "suspicious_activity"
	EventUnauthorizedAccess   SecurityEventType = "unauthorized_access"
	EventTokenBlacklisted     SecurityEventType = "token_blacklisted"
	EventCSRFAttempt          SecurityEventType = "csrf_attempt"
	EventXSSAttempt           SecurityEventType = "xss_attempt"
	EventSQLInjectionAttempt  SecurityEventType = "sql_injection_attempt"
)

// SecurityEventLevel represents the severity level of security events
type SecurityEventLevel string

const (
	LevelInfo    SecurityEventLevel = "info"
	LevelWarning SecurityEventLevel = "warning"
	LevelError   SecurityEventLevel = "error"
	LevelCritical SecurityEventLevel = "critical"
)

// SecurityMonitor tracks and manages security events
type SecurityMonitor struct {
	events    []SecurityEvent
	maxEvents int
	mu        sync.RWMutex

	// Metrics
	eventCounts map[SecurityEventType]int
	levelCounts map[SecurityEventLevel]int

	// Alerting
	alertThresholds map[SecurityEventType]int
	lastAlertTime   map[SecurityEventType]time.Time
}

// NewSecurityMonitor creates a new security monitor
func NewSecurityMonitor(maxEvents int) *SecurityMonitor {
	if maxEvents <= 0 {
		maxEvents = 10000 // Default limit
	}

	return &SecurityMonitor{
		events:          make([]SecurityEvent, 0, maxEvents),
		maxEvents:       maxEvents,
		eventCounts:     make(map[SecurityEventType]int),
		levelCounts:     make(map[SecurityEventLevel]int),
		alertThresholds: getDefaultAlertThresholds(),
		lastAlertTime:   make(map[SecurityEventType]time.Time),
	}
}

// LogEvent logs a security event
func (sm *SecurityMonitor) LogEvent(event SecurityEvent) {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	// Set timestamp if not provided
	if event.Timestamp.IsZero() {
		event.Timestamp = time.Now()
	}

	// Generate ID if not provided
	if event.ID == "" {
		event.ID = generateEventID()
	}

	// Add event to list
	sm.events = append(sm.events, event)

	// Maintain max events limit
	if len(sm.events) > sm.maxEvents {
		sm.events = sm.events[1:]
	}

	// Update counts
	sm.eventCounts[event.Type]++
	sm.levelCounts[event.Level]++

	// Check for alerts
	sm.checkAlerts(event)

	// Log to console
	log.Printf("[SECURITY] %s: %s - %s %s - %s",
		string(event.Level),
		string(event.Type),
		event.Method,
		event.Path,
		event.Message)
}

// GetEvents returns recent security events
func (sm *SecurityMonitor) GetEvents(limit int, eventType SecurityEventType) []SecurityEvent {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	if limit <= 0 {
		limit = 100 // Default limit
	}

	var events []SecurityEvent

	// Iterate backwards to get most recent events
	for i := len(sm.events) - 1; i >= 0 && len(events) < limit; i-- {
		if eventType == "" || sm.events[i].Type == eventType {
			events = append(events, sm.events[i])
		}
	}

	return events
}

// GetEventsByUser returns security events for a specific user
func (sm *SecurityMonitor) GetEventsByUser(userID string, limit int) []SecurityEvent {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	if limit <= 0 {
		limit = 100 // Default limit
	}

	var events []SecurityEvent

	for i := len(sm.events) - 1; i >= 0 && len(events) < limit; i-- {
		if sm.events[i].UserID == userID {
			events = append(events, sm.events[i])
		}
	}

	return events
}

// GetEventsByIP returns security events for a specific IP address
func (sm *SecurityMonitor) GetEventsByIP(ipAddress string, limit int) []SecurityEvent {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	if limit <= 0 {
		limit = 100 // Default limit
	}

	var events []SecurityEvent

	for i := len(sm.events) - 1; i >= 0 && len(events) < limit; i-- {
		if sm.events[i].IPAddress == ipAddress {
			events = append(events, sm.events[i])
		}
	}

	return events
}

// GetMetrics returns security monitoring metrics
func (sm *SecurityMonitor) GetMetrics() map[string]interface{} {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	return map[string]interface{}{
		"total_events":        len(sm.events),
		"event_counts":        sm.eventCounts,
		"level_counts":        sm.levelCounts,
		"alert_thresholds":    sm.alertThresholds,
		"last_alert_times":    sm.lastAlertTime,
		"monitoring_active":   true,
		"max_events":          sm.maxEvents,
	}
}

// GetRecentActivity returns recent security activity summary
func (sm *SecurityMonitor) GetRecentActivity(duration time.Duration) map[string]interface{} {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	cutoff := time.Now().Add(-duration)

	var recentEvents []SecurityEvent
	eventCounts := make(map[SecurityEventType]int)
	levelCounts := make(map[SecurityEventLevel]int)

	for _, event := range sm.events {
		if event.Timestamp.After(cutoff) {
			recentEvents = append(recentEvents, event)
			eventCounts[event.Type]++
			levelCounts[event.Level]++
		}
	}

	return map[string]interface{}{
		"duration":         duration.String(),
		"recent_events":    len(recentEvents),
		"event_counts":     eventCounts,
		"level_counts":     levelCounts,
		"events_per_hour":  float64(len(recentEvents)) / duration.Hours(),
	}
}

// checkAlerts checks if any alert thresholds are exceeded
func (sm *SecurityMonitor) checkAlerts(event SecurityEvent) {
	threshold, exists := sm.alertThresholds[event.Type]
	if !exists {
		return
	}

	count := sm.eventCounts[event.Type]
	lastAlert, hasRecentAlert := sm.lastAlertTime[event.Type]

	// Check if threshold exceeded and enough time has passed since last alert
	if count >= threshold && (!hasRecentAlert || time.Since(lastAlert) > time.Hour) {
		sm.sendAlert(event, count)
		sm.lastAlertTime[event.Type] = time.Now()
	}
}

// sendAlert sends a security alert
func (sm *SecurityMonitor) sendAlert(event SecurityEvent, count int) {
	alertMessage := fmt.Sprintf("🚨 SECURITY ALERT: %s events exceeded threshold (%d occurrences) - Last event: %s from %s",
		string(event.Type),
		count,
		event.Path,
		event.IPAddress)

	log.Printf(alertMessage)

	// In a real implementation, you might send emails, Slack notifications, etc.
	// For now, we'll just log the alert
}

// ClearEvents clears all security events (use with caution)
func (sm *SecurityMonitor) ClearEvents() {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	sm.events = sm.events[:0]
	for k := range sm.eventCounts {
		delete(sm.eventCounts, k)
	}
	for k := range sm.levelCounts {
		delete(sm.levelCounts, k)
	}

	log.Println("[SECURITY] All security events cleared")
}

// ExportEvents exports security events to JSON
func (sm *SecurityMonitor) ExportEvents() ([]byte, error) {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	return json.MarshalIndent(map[string]interface{}{
		"export_time": time.Now().Format(time.RFC3339),
		"metrics":     sm.GetMetrics(),
		"events":      sm.events,
	}, "", "  ")
}

// getDefaultAlertThresholds returns default alert thresholds for different event types
func getDefaultAlertThresholds() map[SecurityEventType]int {
	return map[SecurityEventType]int{
		EventAuthenticationFailure: 10,  // Alert after 10 auth failures
		EventRateLimitExceeded:    20,  // Alert after 20 rate limit violations
		EventSuspiciousActivity:   5,   // Alert after 5 suspicious activities
		EventUnauthorizedAccess:   3,   // Alert after 3 unauthorized access attempts
		EventCSRFAttempt:          1,   // Alert immediately on CSRF attempts
		EventXSSAttempt:           1,   // Alert immediately on XSS attempts
		EventSQLInjectionAttempt:  1,   // Alert immediately on SQL injection attempts
	}
}

// generateEventID generates a unique event ID
func generateEventID() string {
	return fmt.Sprintf("evt_%d", time.Now().UnixNano())
}