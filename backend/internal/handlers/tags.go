package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gpd/my-notes/internal/models"
	"github.com/gpd/my-notes/internal/services"
	"github.com/gorilla/mux"
)

// TagsHandler handles tag-related HTTP requests
type TagsHandler struct {
	tagService services.TagServiceInterface
}

// NewTagsHandler creates a new TagsHandler instance
func NewTagsHandler(tagService services.TagServiceInterface) *TagsHandler {
	return &TagsHandler{
		tagService: tagService,
	}
}

// CreateTag handles POST /api/tags
func (h *TagsHandler) CreateTag(w http.ResponseWriter, r *http.Request) {
	// Get user from context (set by auth middleware)
	_, ok := r.Context().Value("user").(*models.User)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	// Parse request body
	var request models.CreateTagRequest
	decoder := json.NewDecoder(r.Body)
	if err := decoder.Decode(&request); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}
	defer r.Body.Close()

	// Create tag
	tag, err := h.tagService.CreateTag(&request)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondWithJSON(w, http.StatusCreated, tag.ToResponse())
}

// ListTags handles GET /api/tags
func (h *TagsHandler) ListTags(w http.ResponseWriter, r *http.Request) {
	// Get user from context (set by auth middleware)
	_, ok := r.Context().Value("user").(*models.User)
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
		orderBy = "name"
	}

	orderDir := r.URL.Query().Get("order_dir")
	if orderDir == "" {
		orderDir = "asc"
	}

	// Get tags
	tagList, err := h.tagService.ListTags(limit, offset, orderBy, orderDir)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, tagList)
}

// GetTag handles GET /api/tags/{id}
func (h *TagsHandler) GetTag(w http.ResponseWriter, r *http.Request) {
	// Get user from context (set by auth middleware)
	_, ok := r.Context().Value("user").(*models.User)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	// Get tag ID from URL
	vars := mux.Vars(r)
	tagID := vars["id"]
	if tagID == "" {
		respondWithError(w, http.StatusBadRequest, "Tag ID is required")
		return
	}

	// Get tag
	tag, err := h.tagService.GetTagByID(tagID)
	if err != nil {
		respondWithError(w, http.StatusNotFound, err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, tag.ToResponse())
}

// UpdateTag handles PUT /api/tags/{id}
func (h *TagsHandler) UpdateTag(w http.ResponseWriter, r *http.Request) {
	// Get user from context (set by auth middleware)
	_, ok := r.Context().Value("user").(*models.User)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	// Get tag ID from URL
	vars := mux.Vars(r)
	tagID := vars["id"]
	if tagID == "" {
		respondWithError(w, http.StatusBadRequest, "Tag ID is required")
		return
	}

	// Parse request body
	var request models.UpdateTagRequest
	decoder := json.NewDecoder(r.Body)
	if err := decoder.Decode(&request); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}
	defer r.Body.Close()

	// Update tag
	tag, err := h.tagService.UpdateTag(tagID, &request)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, tag.ToResponse())
}

// DeleteTag handles DELETE /api/tags/{id}
func (h *TagsHandler) DeleteTag(w http.ResponseWriter, r *http.Request) {
	// Get user from context (set by auth middleware)
	_, ok := r.Context().Value("user").(*models.User)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	// Get tag ID from URL
	vars := mux.Vars(r)
	tagID := vars["id"]
	if tagID == "" {
		respondWithError(w, http.StatusBadRequest, "Tag ID is required")
		return
	}

	// Delete tag
	err := h.tagService.DeleteTag(tagID)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{"message": "Tag deleted successfully"})
}

// GetTagSuggestions handles GET /api/tags/suggestions
func (h *TagsHandler) GetTagSuggestions(w http.ResponseWriter, r *http.Request) {
	// Get user from context (set by auth middleware)
	_, ok := r.Context().Value("user").(*models.User)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	// Parse query parameters
	partial := r.URL.Query().Get("q")
	if partial == "" {
		respondWithError(w, http.StatusBadRequest, "Query parameter 'q' is required")
		return
	}

	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 {
		limit = 10
	}
	if limit > 50 {
		limit = 50
	}

	// Get suggestions
	suggestions, err := h.tagService.GetTagSuggestions(partial, limit)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, map[string][]string{"suggestions": suggestions})
}

// GetPopularTags handles GET /api/tags/popular
func (h *TagsHandler) GetPopularTags(w http.ResponseWriter, r *http.Request) {
	// Get user from context (set by auth middleware)
	_, ok := r.Context().Value("user").(*models.User)
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

	// Get popular tags
	tags, err := h.tagService.GetPopularTags(limit)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, map[string][]models.TagResponse{"tags": tags})
}

// GetUnusedTags handles GET /api/tags/unused
func (h *TagsHandler) GetUnusedTags(w http.ResponseWriter, r *http.Request) {
	// Get user from context (set by auth middleware)
	_, ok := r.Context().Value("user").(*models.User)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	// Get unused tags
	tags, err := h.tagService.GetUnusedTags()
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, map[string][]models.TagResponse{"tags": tags})
}

// GetUserTags handles GET /api/tags/user
func (h *TagsHandler) GetUserTags(w http.ResponseWriter, r *http.Request) {
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

	// Get user tags
	tagList, err := h.tagService.GetTagsByUser(user.ID.String(), limit, offset)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, tagList)
}

// GetTagAnalytics handles GET /api/tags/{id}/analytics
func (h *TagsHandler) GetTagAnalytics(w http.ResponseWriter, r *http.Request) {
	// Get user from context (set by auth middleware)
	_, ok := r.Context().Value("user").(*models.User)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	// Get tag ID from URL
	vars := mux.Vars(r)
	tagID := vars["id"]
	if tagID == "" {
		respondWithError(w, http.StatusBadRequest, "Tag ID is required")
		return
	}

	// Get tag analytics
	analytics, err := h.tagService.GetTagAnalytics(tagID)
	if err != nil {
		respondWithError(w, http.StatusNotFound, err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, analytics)
}

// SearchTags handles GET /api/tags/search
func (h *TagsHandler) SearchTags(w http.ResponseWriter, r *http.Request) {
	// Get user from context (set by auth middleware)
	_, ok := r.Context().Value("user").(*models.User)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	// Parse query parameters
	query := r.URL.Query().Get("q")
	if query == "" {
		respondWithError(w, http.StatusBadRequest, "Query parameter 'q' is required")
		return
	}

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

	// Search tags
	tagList, err := h.tagService.SearchTags(query, limit, offset)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, tagList)
}

// CleanupUnusedTags handles POST /api/tags/cleanup
func (h *TagsHandler) CleanupUnusedTags(w http.ResponseWriter, r *http.Request) {
	// Get user from context (set by auth middleware)
	_, ok := r.Context().Value("user").(*models.User)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	// Cleanup unused tags
	deletedCount, err := h.tagService.CleanupUnusedTags()
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"message":      "Cleanup completed successfully",
		"deleted_count": deletedCount,
	})
}

// MergeTags handles POST /api/tags/merge
func (h *TagsHandler) MergeTags(w http.ResponseWriter, r *http.Request) {
	// Get user from context (set by auth middleware)
	_, ok := r.Context().Value("user").(*models.User)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	// Parse request body
	var request struct {
		SourceTagIDs []string `json:"source_tag_ids" validate:"required,min=1"`
		TargetTagID  string   `json:"target_tag_id" validate:"required"`
	}

	decoder := json.NewDecoder(r.Body)
	if err := decoder.Decode(&request); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}
	defer r.Body.Close()

	// Validate request
	if len(request.SourceTagIDs) == 0 {
		respondWithError(w, http.StatusBadRequest, "At least one source tag ID is required")
		return
	}

	if request.TargetTagID == "" {
		respondWithError(w, http.StatusBadRequest, "Target tag ID is required")
		return
	}

	// Merge tags
	err := h.tagService.MergeTags(request.SourceTagIDs, request.TargetTagID)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{
		"message": "Tags merged successfully",
	})
}

// GetRelatedTags handles GET /api/tags/{id}/related
func (h *TagsHandler) GetRelatedTags(w http.ResponseWriter, r *http.Request) {
	// Get user from context (set by auth middleware)
	_, ok := r.Context().Value("user").(*models.User)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	// Get tag ID from URL
	vars := mux.Vars(r)
	tagID := vars["id"]
	if tagID == "" {
		respondWithError(w, http.StatusBadRequest, "Tag ID is required")
		return
	}

	// Parse query parameters
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 {
		limit = 10
	}
	if limit > 50 {
		limit = 50
	}

	// Get related tags
	tags, err := h.tagService.GetRelatedTags(tagID, limit)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, map[string][]models.TagResponse{"tags": tags})
}