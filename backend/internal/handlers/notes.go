package handlers

import (
	"context"
	"crypto/md5"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gpd/my-notes/internal/models"
	"github.com/gpd/my-notes/internal/services"
	"github.com/gorilla/mux"
)

// NotesHandler handles note-related HTTP requests
type NotesHandler struct {
	noteService          services.NoteServiceInterface
	semanticSearchService *services.SemanticSearchService
	prettifyService      *services.PrettifyService
}

// NewNotesHandler creates a new NotesHandler instance
func NewNotesHandler(
	noteService services.NoteServiceInterface,
	semanticSearchService *services.SemanticSearchService,
	prettifyService *services.PrettifyService,
) *NotesHandler {
	return &NotesHandler{
		noteService:          noteService,
		semanticSearchService: semanticSearchService,
		prettifyService:      prettifyService,
	}
}

// CreateNote handles POST /api/notes
func (h *NotesHandler) CreateNote(w http.ResponseWriter, r *http.Request) {
	// Get user from context (set by auth middleware)
	user, ok := r.Context().Value("user").(*models.User)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	// Parse request body
	var request models.CreateNoteRequest
	decoder := json.NewDecoder(r.Body)
	if err := decoder.Decode(&request); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}
	defer r.Body.Close()

	// Create note
	note, err := h.noteService.CreateNote(user.ID.String(), &request)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, err.Error())
		return
	}

	// Get tags for the created note
	tags := note.ExtractHashtags()
	noteResponse := note.ToResponse()
	noteResponse.Tags = tags

	respondWithJSON(w, http.StatusCreated, noteResponse)
}

// ListNotes handles GET /api/notes
func (h *NotesHandler) ListNotes(w http.ResponseWriter, r *http.Request) {
	// Get user from context (set by auth middleware)
	user, ok := r.Context().Value("user").(*models.User)
	if !ok {
		log.Printf("[ListNotes] ERROR: User not authenticated")
		respondWithError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	log.Printf("[ListNotes] Getting notes for user: %s", user.ID)

	// Parse query parameters
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	if offset < 0 {
		offset = 0
	}

	orderBy := r.URL.Query().Get("order_by")
	if orderBy == "" {
		orderBy = "created_at"
	}

	orderDir := r.URL.Query().Get("order_dir")
	if orderDir == "" {
		orderDir = "desc"
	}

	log.Printf("[ListNotes] Query params: limit=%d, offset=%d, order_by=%s, order_dir=%s", limit, offset, orderBy, orderDir)

	// Get notes
	noteList, err := h.noteService.ListNotes(user.ID.String(), limit, offset, orderBy, orderDir)
	if err != nil {
		log.Printf("[ListNotes] ERROR: Failed to list notes for user %s: %v", user.ID, err)
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	log.Printf("[ListNotes] Successfully retrieved %d notes (total: %d)", len(noteList.Notes), noteList.Total)
	respondWithJSON(w, http.StatusOK, noteList)
}

// GetNote handles GET /api/notes/{id}
func (h *NotesHandler) GetNote(w http.ResponseWriter, r *http.Request) {
	// Get user from context (set by auth middleware)
	user, ok := r.Context().Value("user").(*models.User)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	// Get note ID from URL
	vars := mux.Vars(r)
	noteID := vars["id"]
	if noteID == "" {
		respondWithError(w, http.StatusBadRequest, "Note ID is required")
		return
	}

	// Get note
	note, err := h.noteService.GetNoteByID(user.ID.String(), noteID)
	if err != nil {
		if err.Error() == "note not found" {
			respondWithError(w, http.StatusNotFound, "Note not found")
		} else {
			respondWithError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}

	// Get tags for the note
	tags := note.ExtractHashtags()
	noteResponse := note.ToResponse()
	noteResponse.Tags = tags

	respondWithJSON(w, http.StatusOK, noteResponse)
}

// UpdateNote handles PUT /api/notes/{id}
func (h *NotesHandler) UpdateNote(w http.ResponseWriter, r *http.Request) {
	// Get user from context (set by auth middleware)
	user, ok := r.Context().Value("user").(*models.User)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	// Get note ID from URL
	vars := mux.Vars(r)
	noteID := vars["id"]
	if noteID == "" {
		respondWithError(w, http.StatusBadRequest, "Note ID is required")
		return
	}

	// Parse request body
	var request models.UpdateNoteRequest
	decoder := json.NewDecoder(r.Body)
	if err := decoder.Decode(&request); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}
	defer r.Body.Close()

	// Update note
	note, err := h.noteService.UpdateNote(user.ID.String(), noteID, &request)
	if err != nil {
		if err.Error() == "note not found" {
			respondWithError(w, http.StatusNotFound, "Note not found")
		} else if strings.Contains(err.Error(), "version mismatch") || strings.Contains(err.Error(), "concurrent update") {
			respondWithError(w, http.StatusConflict, err.Error())
		} else {
			respondWithError(w, http.StatusBadRequest, err.Error())
		}
		return
	}

	// Get tags for the updated note
	tags := note.ExtractHashtags()
	noteResponse := note.ToResponse()
	noteResponse.Tags = tags

	respondWithJSON(w, http.StatusOK, noteResponse)
}

// DeleteNote handles DELETE /api/notes/{id}
func (h *NotesHandler) DeleteNote(w http.ResponseWriter, r *http.Request) {
	// Get user from context (set by auth middleware)
	user, ok := r.Context().Value("user").(*models.User)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	// Get note ID from URL
	vars := mux.Vars(r)
	noteID := vars["id"]
	if noteID == "" {
		respondWithError(w, http.StatusBadRequest, "Note ID is required")
		return
	}

	// Delete note
	err := h.noteService.DeleteNote(user.ID.String(), noteID)
	if err != nil {
		if err.Error() == "note not found" {
			respondWithError(w, http.StatusNotFound, "Note not found")
		} else {
			respondWithError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{"message": "Note deleted successfully"})
}

// SearchNotes handles GET /api/search/notes
func (h *NotesHandler) SearchNotes(w http.ResponseWriter, r *http.Request) {
	// Get user from context (set by auth middleware)
	user, ok := r.Context().Value("user").(*models.User)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	// Parse query parameters
	query := r.URL.Query().Get("query")
	semanticParam := r.URL.Query().Get("semantic")
	isSemantic := semanticParam == "true"

	// Use semantic search if requested and service is available
	if isSemantic && h.semanticSearchService != nil {
		h.handleSemanticSearch(w, r, user, query)
		return
	}

	// Original keyword search logic
	request := &models.SearchNotesRequest{
		Query:   query,
		OrderBy: r.URL.Query().Get("order_by"),
		OrderDir: r.URL.Query().Get("order_dir"),
	}

	// Parse tags parameter
	tagsParam := r.URL.Query().Get("tags")
	if tagsParam != "" {
		request.Tags = strings.Split(tagsParam, ",")
		for i, tag := range request.Tags {
			request.Tags[i] = strings.TrimSpace(tag)
		}
	}

	// Parse pagination
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	request.Limit = limit

	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	if offset < 0 {
		offset = 0
	}
	request.Offset = offset

	// Search notes
	noteList, err := h.noteService.SearchNotes(user.ID.String(), request)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, noteList)
}

// handleSemanticSearch handles semantic search requests
func (h *NotesHandler) handleSemanticSearch(w http.ResponseWriter, r *http.Request, user *models.User, query string) {
	ctx := r.Context()

	notes, duration, err := h.semanticSearchService.Search(ctx, user.ID.String(), query)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	// Convert to NoteResponse format
	noteResponses := make([]models.NoteResponse, len(notes))
	for i, note := range notes {
		resp := note.ToResponse()
		resp.Tags = note.ExtractHashtags()
		noteResponses[i] = resp
	}

	// Return with duration metadata
	response := map[string]interface{}{
		"notes":    noteResponses,
		"total":    len(noteResponses),
		"duration": duration,
	}

	respondWithJSON(w, http.StatusOK, response)
}

// GetNotesByTag handles GET /api/notes/tags/{tag}
func (h *NotesHandler) GetNotesByTag(w http.ResponseWriter, r *http.Request) {
	// Get user from context (set by auth middleware)
	user, ok := r.Context().Value("user").(*models.User)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	// Get tag from URL
	vars := mux.Vars(r)
	tag := vars["tag"]
	if tag == "" {
		respondWithError(w, http.StatusBadRequest, "Tag is required")
		return
	}

	// Ensure tag starts with #
	if !strings.HasPrefix(tag, "#") {
		tag = "#" + tag
	}

	// Parse pagination parameters
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	if offset < 0 {
		offset = 0
	}

	// Get notes by tag
	noteList, err := h.noteService.GetNotesByTag(user.ID.String(), tag, limit, offset)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, noteList)
}

// syncParams holds parsed and validated sync request parameters
type syncParams struct {
	Limit          int
	Offset         int
	Timestamp      time.Time
	SyncToken      string
	IncludeDeleted bool
}

// parseSyncParams extracts and validates sync query parameters from the request
func parseSyncParams(r *http.Request) (*syncParams, error) {
	// Parse limit parameter
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 || limit > 1000 {
		limit = 1000 // Higher limit for sync operations
	}

	// Parse offset parameter
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	if offset < 0 {
		offset = 0
	}

	// Parse timestamp parameter
	timestampParam := r.URL.Query().Get("since")
	var timestamp time.Time
	var err error

	if timestampParam != "" {
		timestamp, err = time.Parse(time.RFC3339, timestampParam)
		if err != nil {
			return nil, fmt.Errorf("invalid timestamp format. Use RFC3339 format")
		}
	} else {
		// If no timestamp provided, use a default lookback period (24 hours)
		timestamp = time.Now().Add(-24 * time.Hour)
	}

	// Parse sync token and include deleted flag
	syncToken := r.URL.Query().Get("sync_token")
	includeDeleted := r.URL.Query().Get("include_deleted") == "true"

	return &syncParams{
		Limit:          limit,
		Offset:         offset,
		Timestamp:      timestamp,
		SyncToken:      syncToken,
		IncludeDeleted: includeDeleted,
	}, nil
}

// enrichNotesWithSyncMetadata converts notes to NoteResponse objects with tags and sync metadata
func (h *NotesHandler) enrichNotesWithSyncMetadata(notes []models.Note, conflicts []models.NoteConflict) []models.NoteResponse {
	var noteResponses []models.NoteResponse
	for _, note := range notes {
		tags := note.ExtractHashtags()
		noteResponse := note.ToResponse()
		noteResponse.Tags = tags
		noteResponse.SyncMetadata = map[string]interface{}{
			"sync_version":   note.Version,
			"conflict_status": h.getConflictStatus(note, conflicts),
			"last_synced":     time.Now().Format(time.RFC3339),
		}
		noteResponses = append(noteResponses, noteResponse)
	}
	return noteResponses
}

// buildSyncResponse constructs a comprehensive sync response with metadata
func (h *NotesHandler) buildSyncResponse(noteResponses []models.NoteResponse, total int, params *syncParams, conflicts []models.NoteConflict, syncToken string) models.SyncResponse {
	now := time.Now().Format(time.RFC3339)
	return models.SyncResponse{
		Notes:      noteResponses,
		Total:      total,
		Limit:      params.Limit,
		Offset:     params.Offset,
		HasMore:    params.Offset+params.Limit < total,
		SyncToken:  syncToken,
		ServerTime: now,
		Conflicts:  conflicts,
		Metadata: models.SyncMetadata{
			LastSyncAt:    now,
			ServerTime:    now,
			TotalNotes:    total,
			UpdatedNotes:  len(noteResponses),
			HasConflicts:  len(conflicts) > 0,
		},
	}
}

// SyncNotes handles GET /api/notes/sync
func (h *NotesHandler) SyncNotes(w http.ResponseWriter, r *http.Request) {
	// Get user from context (set by auth middleware)
	user, ok := r.Context().Value("user").(*models.User)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	// Parse sync parameters
	params, err := parseSyncParams(r)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, err.Error())
		return
	}

	// Validate sync token if provided (lenient validation - don't fail sync)
	if params.SyncToken != "" {
		if valid := h.validateSyncToken(params.SyncToken); !valid {
			log.Printf("SyncNotes: Invalid or expired sync token provided, will generate new token")
		}
	}

	// Get notes since timestamp with sync support
	notes, total, err := h.noteService.GetNotesForSync(user.ID.String(), params.Limit, params.Offset, &params.Timestamp, params.IncludeDeleted)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	// Check for potential conflicts
	conflicts, err := h.noteService.DetectConflicts(user.ID.String(), notes)
	if err != nil {
		// Log error but don't fail the sync
		conflicts = []models.NoteConflict{}
	}

	// Generate new sync token
	newSyncToken := h.generateSyncToken(user.ID.String(), time.Now())

	// Enrich notes with sync metadata
	noteResponses := h.enrichNotesWithSyncMetadata(notes, conflicts)

	// Build and send sync response
	response := h.buildSyncResponse(noteResponses, total, params, conflicts, newSyncToken)
	respondWithJSON(w, http.StatusOK, response)
}

// BatchCreateNotes handles POST /api/notes/batch
func (h *NotesHandler) BatchCreateNotes(w http.ResponseWriter, r *http.Request) {
	// Get user from context (set by auth middleware)
	user, ok := r.Context().Value("user").(*models.User)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	// Parse request body
	var requests []models.CreateNoteRequest
	decoder := json.NewDecoder(r.Body)
	if err := decoder.Decode(&requests); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}
	defer r.Body.Close()

	// Validate batch size
	if len(requests) == 0 {
		respondWithError(w, http.StatusBadRequest, "At least one note is required")
		return
	}
	if len(requests) > 50 {
		respondWithError(w, http.StatusBadRequest, "Maximum 50 notes allowed per batch")
		return
	}

	// Create notes in batch
	requestPointers := make([]*models.CreateNoteRequest, len(requests))
	for i := range requests {
		requestPointers[i] = &requests[i]
	}
	notes, err := h.noteService.BatchCreateNotes(user.ID.String(), requestPointers)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, err.Error())
		return
	}

	// Convert to response format with tags
	var noteResponses []models.NoteResponse
	for _, note := range notes {
		tags := note.ExtractHashtags()
		noteResponse := note.ToResponse()
		noteResponse.Tags = tags
		noteResponses = append(noteResponses, noteResponse)
	}

	respondWithJSON(w, http.StatusCreated, map[string]interface{}{
		"notes": noteResponses,
		"count": len(noteResponses),
	})
}

// BatchUpdateNotes handles PUT /api/notes/batch
func (h *NotesHandler) BatchUpdateNotes(w http.ResponseWriter, r *http.Request) {
	// Get user from context (set by auth middleware)
	user, ok := r.Context().Value("user").(*models.User)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	// Parse request body
	var batchRequest struct {
		Updates []struct {
			NoteID  string                 `json:"note_id"`
			Updates models.UpdateNoteRequest `json:"updates"`
		} `json:"updates"`
	}
	decoder := json.NewDecoder(r.Body)
	if err := decoder.Decode(&batchRequest); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}
	defer r.Body.Close()

	// Validate batch size
	if len(batchRequest.Updates) == 0 {
		respondWithError(w, http.StatusBadRequest, "At least one update is required")
		return
	}
	if len(batchRequest.Updates) > 50 {
		respondWithError(w, http.StatusBadRequest, "Maximum 50 updates allowed per batch")
		return
	}

	// Convert to service format
	updateRequests := make([]struct {
		NoteID  string
		Request *models.UpdateNoteRequest
	}, len(batchRequest.Updates))

	for i, update := range batchRequest.Updates {
		updateRequests[i].NoteID = update.NoteID
		updateRequests[i].Request = &update.Updates
	}

	// Update notes in batch
	notes, err := h.noteService.BatchUpdateNotes(user.ID.String(), updateRequests)
	if err != nil {
		if strings.Contains(err.Error(), "version mismatch") {
			respondWithError(w, http.StatusConflict, err.Error())
		} else {
			respondWithError(w, http.StatusBadRequest, err.Error())
		}
		return
	}

	// Convert to response format with tags
	var noteResponses []models.NoteResponse
	for _, note := range notes {
		tags := note.ExtractHashtags()
		noteResponse := note.ToResponse()
		noteResponse.Tags = tags
		noteResponses = append(noteResponses, noteResponse)
	}

	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"notes": noteResponses,
		"count": len(noteResponses),
	})
}

// GetNoteStats handles GET /api/notes/stats
func (h *NotesHandler) GetNoteStats(w http.ResponseWriter, r *http.Request) {
	// Get user from context (set by auth middleware)
	user, ok := r.Context().Value("user").(*models.User)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	// Get basic stats
	noteList, err := h.noteService.ListNotes(user.ID.String(), 1, 0, "created_at", "desc")
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	// For now, return basic stats
	// TODO: Implement more detailed stats in the service
	stats := map[string]interface{}{
		"total_notes": noteList.Total,
		"last_sync":   time.Now().Format(time.RFC3339),
	}

	respondWithJSON(w, http.StatusOK, stats)
}

// Helper methods for sync functionality

// validateSyncToken validates a sync token format and expiration.
// Returns true if valid, false otherwise. Logs warnings for invalid tokens.
// Lenient validation: sync is allowed to proceed even with invalid tokens.
func (h *NotesHandler) validateSyncToken(token string) bool {
	if token == "" {
		return false
	}

	// Check token format: sync_YYYYMMDD_XXXXXXXX
	// Expected format: sync_date_8char_hash
	parts := strings.Split(token, "_")
	if len(parts) != 3 || parts[0] != "sync" {
		log.Printf("Warning: Invalid sync token format: %s", token)
		return false
	}

	// Parse date from token (format: YYYYMMDD)
	tokenDate, err := time.Parse("20060102", parts[1])
	if err != nil {
		log.Printf("Warning: Invalid sync token date: %s", parts[1])
		return false
	}

	// Check if token is too old (more than 24 hours)
	tokenAge := time.Since(tokenDate)
	if tokenAge > 24*time.Hour {
		log.Printf("Warning: Sync token is too old: %s (age: %v)", token, tokenAge)
		return false
	}

	return true
}

// generateSyncToken generates a unique sync token for tracking sync sessions
func (h *NotesHandler) generateSyncToken(userID string, timestamp time.Time) string {
	// Create a token with user ID, timestamp, and random component
	data := fmt.Sprintf("%s:%d:%s", userID, timestamp.Unix(), "sync")
	hash := fmt.Sprintf("%x", md5.Sum([]byte(data)))
	return fmt.Sprintf("sync_%s_%s", timestamp.Format("20060102"), hash[:8])
}

// getConflictStatus determines the conflict status for a note
func (h *NotesHandler) getConflictStatus(note models.Note, conflicts []models.NoteConflict) string {
	for _, conflict := range conflicts {
		if conflict.NoteID == note.ID {
			return "conflict"
		}
	}

	// Check if note has potential version conflicts
	if note.Version > 1 {
		return "needs_review"
	}

	return "clean"
}

// PrettifyNote handles POST /api/notes/{id}/prettify
func (h *NotesHandler) PrettifyNote(w http.ResponseWriter, r *http.Request) {
	startTime := time.Now()
	log.Printf("[PrettifyNote] ========================================")
	log.Printf("[PrettifyNote] Starting prettify request at %v", startTime.Format(time.RFC3339))

	// Get user from context (set by auth middleware)
	user, ok := r.Context().Value("user").(*models.User)
	if !ok {
		log.Printf("[PrettifyNote] ERROR: User not authenticated")
		respondWithError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}
	log.Printf("[PrettifyNote] User authenticated: %s (ID: %s)", user.Email, user.ID)

	// Get note ID from URL
	vars := mux.Vars(r)
	noteID := vars["id"]
	if noteID == "" {
		log.Printf("[PrettifyNote] ERROR: Note ID is required")
		respondWithError(w, http.StatusBadRequest, "Note ID is required")
		return
	}
	log.Printf("[PrettifyNote] Note ID: %s", noteID)

	// Check if prettify service is available
	if h.prettifyService == nil {
		log.Printf("[PrettifyNote] ERROR: Prettify service is not available (nil)")
		respondWithError(w, http.StatusServiceUnavailable, "Prettify service not available - LLM may not be configured")
		return
	}
	log.Printf("[PrettifyNote] Prettify service is available")

	// Prettify the note
	ctx := r.Context()
	log.Printf("[PrettifyNote] Calling prettify service...")
	deadline, ok := ctx.Deadline()
	if ok {
		log.Printf("[PrettifyNote] Request context deadline: %v", deadline.Format(time.RFC3339))
		timeUntilDeadline := time.Until(deadline)
		log.Printf("[PrettifyNote] Time until deadline: %v", timeUntilDeadline)
	} else {
		log.Printf("[PrettifyNote] Request context has no deadline")
	}
	serviceStart := time.Now()

	result, err := h.prettifyService.PrettifyNote(ctx, user.ID.String(), noteID)

	serviceDuration := time.Since(serviceStart)
	totalDuration := time.Since(startTime)

	if err != nil {
		log.Printf("[PrettifyNote] ========================================")
		log.Printf("[PrettifyNote] ERROR: Prettify failed")
		log.Printf("[PrettifyNote]   Total duration: %v", totalDuration)
		log.Printf("[PrettifyNote]   Service call duration: %v", serviceDuration)
		log.Printf("[PrettifyNote]   Error type: %T", err)
		log.Printf("[PrettifyNote]   Error message: %v", err)
		log.Printf("[PrettifyNote]   Context error: %v", ctx.Err())
		log.Printf("[PrettifyNote]   Context deadline exceeded: %v", ctx.Err() == context.DeadlineExceeded)
		log.Printf("[PrettifyNote] ========================================")

		if strings.Contains(err.Error(), "too short") {
			respondWithError(w, http.StatusBadRequest, err.Error())
		} else {
			respondWithError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}

	log.Printf("[PrettifyNote] ========================================")
	log.Printf("[PrettifyNote] SUCCESS: Note prettified")
	log.Printf("[PrettifyNote]   Total duration: %v", totalDuration)
	log.Printf("[PrettifyNote]   Service call duration: %v", serviceDuration)
	log.Printf("[PrettifyNote]   Changes made: %v", result.ChangesMade)
	log.Printf("[PrettifyNote]   Suggested tags: %v", result.SuggestedTags)
	log.Printf("[PrettifyNote] ========================================")
	respondWithJSON(w, http.StatusOK, result)
}