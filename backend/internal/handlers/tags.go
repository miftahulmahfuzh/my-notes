package handlers

import (
	"net/http"
	"strconv"

	"github.com/gpd/my-notes/internal/models"
	"github.com/gpd/my-notes/internal/services"
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

// GetTags handles GET /api/v1/tags
func (h *TagsHandler) GetTags(w http.ResponseWriter, r *http.Request) {
	// Get user from context (set by auth middleware)
	user, ok := r.Context().Value("user").(*models.User)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	// Parse query parameters
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 {
		limit = 100
	}
	if limit > 1000 {
		limit = 1000
	}

	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	if offset < 0 {
		offset = 0
	}

	// Get tags for user
	tagList, err := h.tagService.GetAllTags(user.ID.String(), limit, offset)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, tagList)
}
