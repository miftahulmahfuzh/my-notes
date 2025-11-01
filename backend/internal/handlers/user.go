package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gpd/my-notes/internal/models"
	"github.com/gpd/my-notes/internal/services"
	"github.com/gorilla/mux"
)

// UserHandler handles user-related HTTP requests
type UserHandler struct {
	userService services.UserServiceInterface
}

// NewUserHandler creates a new UserHandler instance
func NewUserHandler(userService services.UserServiceInterface) *UserHandler {
	return &UserHandler{
		userService: userService,
	}
}

// GetUserProfile handles GET /api/v1/users/profile
func (h *UserHandler) GetUserProfile(w http.ResponseWriter, r *http.Request) {
	// Get user from context (set by auth middleware)
	user, ok := r.Context().Value("user").(*models.User)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	respondWithJSON(w, http.StatusOK, user.ToResponse())
}

// GetProfile handles GET /api/v1/user/profile (for test compatibility)
func (h *UserHandler) GetProfile(w http.ResponseWriter, r *http.Request) {
	// Get user from context (set by auth middleware)
	user, ok := r.Context().Value("user").(*models.User)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	respondWithJSON(w, http.StatusOK, user.ToResponse())
}

// UpdateUserProfile handles PUT /api/v1/users/profile
func (h *UserHandler) UpdateUserProfile(w http.ResponseWriter, r *http.Request) {
	// Get user from context
	user, ok := r.Context().Value("user").(*models.User)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	var req struct {
		Name      *string `json:"name,omitempty"`
		AvatarURL *string `json:"avatar_url,omitempty"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Update user fields if provided
	if req.Name != nil {
		user.Name = *req.Name
	}
	if req.AvatarURL != nil {
		user.AvatarURL = req.AvatarURL
	}

	// Update user in database
	updatedUser, err := h.userService.Update(user)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to update user profile")
		return
	}

	respondWithJSON(w, http.StatusOK, updatedUser.ToResponse())
}

// GetUserPreferences handles GET /api/v1/users/preferences
func (h *UserHandler) GetUserPreferences(w http.ResponseWriter, r *http.Request) {
	// Get user from context
	user, ok := r.Context().Value("user").(*models.User)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	respondWithJSON(w, http.StatusOK, user.Preferences)
}

// UpdateUserPreferences handles PUT /api/v1/users/preferences
func (h *UserHandler) UpdateUserPreferences(w http.ResponseWriter, r *http.Request) {
	// Get user from context
	user, ok := r.Context().Value("user").(*models.User)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	var req models.UserPreferences
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Validate preferences
	if err := validatePreferences(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, err.Error())
		return
	}

	// Update user preferences
	user.Preferences = req

	// Update user in database
	updatedUser, err := h.userService.Update(user)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to update user preferences")
		return
	}

	respondWithJSON(w, http.StatusOK, updatedUser.ToResponse().Preferences)
}

// GetUserSessions handles GET /api/v1/users/sessions
func (h *UserHandler) GetUserSessions(w http.ResponseWriter, r *http.Request) {
	// Get user from context
	user, ok := r.Context().Value("user").(*models.User)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	sessions, err := h.userService.GetActiveSessions(user.ID.String())
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to get user sessions")
		return
	}

	// Convert sessions to response format
	sessionResponses := make([]models.UserSessionResponse, len(sessions))
	for i, session := range sessions {
		sessionResponses[i] = session.ToResponse()
	}

	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"sessions": sessionResponses,
		"total":    len(sessionResponses),
	})
}

// DeleteUserSession handles DELETE /api/v1/users/sessions/{sessionId}
func (h *UserHandler) DeleteUserSession(w http.ResponseWriter, r *http.Request) {
	// Get user from context
	user, ok := r.Context().Value("user").(*models.User)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	vars := mux.Vars(r)
	sessionID := vars["sessionId"]
	if sessionID == "" {
		respondWithError(w, http.StatusBadRequest, "Session ID is required")
		return
	}

	// Delete the session
	err := h.userService.DeleteSession(sessionID, user.ID.String())
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to delete session")
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{
		"message": "Session deleted successfully",
	})
}

// DeleteAllUserSessions handles DELETE /api/v1/users/sessions
func (h *UserHandler) DeleteAllUserSessions(w http.ResponseWriter, r *http.Request) {
	// Get user from context
	user, ok := r.Context().Value("user").(*models.User)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	// Delete all sessions for the user
	err := h.userService.DeleteAllSessions(user.ID.String())
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to delete all sessions")
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{
		"message": "All sessions deleted successfully",
	})
}

// GetUserStats handles GET /api/v1/users/stats
func (h *UserHandler) GetUserStats(w http.ResponseWriter, r *http.Request) {
	// Get user from context
	user, ok := r.Context().Value("user").(*models.User)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	// Get user statistics
	stats, err := h.userService.GetUserStats(user.ID.String())
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to get user statistics")
		return
	}

	respondWithJSON(w, http.StatusOK, stats)
}

// DeleteUserAccount handles DELETE /api/v1/users/account
func (h *UserHandler) DeleteUserAccount(w http.ResponseWriter, r *http.Request) {
	// Get user from context
	user, ok := r.Context().Value("user").(*models.User)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	// Get password confirmation from request body
	var req struct {
		Password string `json:"password"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// For Google OAuth users, we might implement additional verification
	// For now, we'll proceed with account deletion

	// Delete user account
	err := h.userService.Delete(user.ID.String())
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to delete user account")
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{
		"message": "User account deleted successfully",
	})
}

// SearchUsers handles GET /api/v1/users/search
func (h *UserHandler) SearchUsers(w http.ResponseWriter, r *http.Request) {
	// Get query parameters
	query := r.URL.Query().Get("q")
	if query == "" {
		respondWithError(w, http.StatusBadRequest, "Search query is required")
		return
	}

	// Parse pagination parameters
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}

	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit < 1 || limit > 100 {
		limit = 20
	}

	// Search users
	users, total, err := h.userService.SearchUsers(query, page, limit)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to search users")
		return
	}

	// Convert users to response format
	userResponses := make([]models.UserResponse, len(users))
	for i, user := range users {
		userResponses[i] = user.ToResponse()
	}

	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"users": userResponses,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

// validatePreferences validates user preferences
func validatePreferences(prefs *models.UserPreferences) error {
	// Validate theme
	validThemes := []string{"light", "dark"}
	isValidTheme := false
	for _, theme := range validThemes {
		if prefs.Theme == theme {
			isValidTheme = true
			break
		}
	}
	if !isValidTheme {
		return &ValidationError{Field: "theme", Message: "Invalid theme value"}
	}

	// Validate note view
	validViews := []string{"list", "grid"}
	isValidView := false
	for _, view := range validViews {
		if prefs.DefaultNoteView == view {
			isValidView = true
			break
		}
	}
	if !isValidView {
		return &ValidationError{Field: "default_note_view", Message: "Invalid default note view value"}
	}

	// Validate language (basic validation)
	if len(prefs.Language) == 0 || len(prefs.Language) > 10 {
		return &ValidationError{Field: "language", Message: "Invalid language code"}
	}

	// Validate timezone (basic validation)
	if len(prefs.TimeZone) == 0 || len(prefs.TimeZone) > 50 {
		return &ValidationError{Field: "time_zone", Message: "Invalid timezone value"}
	}

	return nil
}

// ValidationError represents a validation error
type ValidationError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

func (e *ValidationError) Error() string {
	return e.Message
}