package handlers

import (
	"crypto/md5"
	"encoding/json"
	"fmt"
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
	noteService services.NoteServiceInterface
}

// NewNotesHandler creates a new NotesHandler instance
func NewNotesHandler(noteService services.NoteServiceInterface) *NotesHandler {
	return &NotesHandler{
		noteService: noteService,
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
		respondWithError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

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

	// Get notes
	noteList, err := h.noteService.ListNotes(user.ID.String(), limit, offset, orderBy, orderDir)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

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
	request := &models.SearchNotesRequest{
		Query:   r.URL.Query().Get("query"),
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

// SyncNotes handles GET /api/notes/sync
func (h *NotesHandler) SyncNotes(w http.ResponseWriter, r *http.Request) {
	// Get user from context (set by auth middleware)
	user, ok := r.Context().Value("user").(*models.User)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	// Parse sync parameters
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	timestampParam := r.URL.Query().Get("since")
	syncToken := r.URL.Query().Get("sync_token")
	includeDeleted := r.URL.Query().Get("include_deleted") == "true"

	// Set defaults
	if limit <= 0 || limit > 1000 {
		limit = 1000 // Higher limit for sync operations
	}
	if offset < 0 {
		offset = 0
	}

	// Parse timestamp (assuming RFC3339 format)
	var timestamp time.Time
	var err error

	if timestampParam != "" {
		timestamp, err = time.Parse(time.RFC3339, timestampParam)
		if err != nil {
			respondWithError(w, http.StatusBadRequest, "Invalid timestamp format. Use RFC3339 format.")
			return
		}
	} else {
		// If no timestamp provided, use a default lookback period (24 hours)
		timestamp = time.Now().Add(-24 * time.Hour)
	}

	// Get notes since timestamp with sync support
	notes, total, err := h.noteService.GetNotesForSync(user.ID.String(), limit, offset, &timestamp, includeDeleted)
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

	// Convert to response format with tags and sync metadata
	var noteResponses []models.NoteResponse
	for _, note := range notes {
		tags := note.ExtractHashtags()
		noteResponse := note.ToResponse()
		noteResponse.Tags = tags
		noteResponse.SyncMetadata = map[string]interface{}{
			"sync_version": note.Version,
			"conflict_status": h.getConflictStatus(note, conflicts),
			"last_synced": time.Now().Format(time.RFC3339),
		}
		noteResponses = append(noteResponses, noteResponse)
	}

	// Prepare comprehensive sync response
	response := models.SyncResponse{
		Notes:      noteResponses,
		Total:      total,
		Limit:      limit,
		Offset:     offset,
		HasMore:    offset+limit < total,
		SyncToken:  newSyncToken,
		ServerTime: time.Now().Format(time.RFC3339),
		Conflicts:  conflicts,
		Metadata: models.SyncMetadata{
			LastSyncAt:    time.Now().Format(time.RFC3339),
			ServerTime:    time.Now().Format(time.RFC3339),
			TotalNotes:    total,
			UpdatedNotes:  len(notes),
			HasConflicts:  len(conflicts) > 0,
		},
	}

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