package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/gpd/my-notes/internal/services"
	"github.com/gorilla/mux"
)

// MarkdownHandler handles markdown-related requests
type MarkdownHandler struct {
	markdownService *services.MarkdownService
}

// NewMarkdownHandler creates a new markdown handler
func NewMarkdownHandler() *MarkdownHandler {
	return &MarkdownHandler{
		markdownService: services.NewMarkdownService(),
	}
}

// PreviewRequest represents a markdown preview request
type PreviewRequest struct {
	Content string `json:"content" validate:"required"`
}

// PreviewResponse represents a markdown preview response
type PreviewResponse struct {
	HTML     string                 `json:"html"`
	TOC      []services.TOCItem     `json:"toc"`
	Metadata map[string]string      `json:"metadata"`
	Tags     []string               `json:"tags"`
	Success  bool                   `json:"success"`
	Message  string                 `json:"message,omitempty"`
}

// RegisterMarkdownRoutes registers markdown-related routes
func RegisterMarkdownRoutes(router *mux.Router, authMiddleware mux.MiddlewareFunc) {
	handler := NewMarkdownHandler()

	// Apply authentication middleware to all markdown routes
	markdownRouter := router.PathPrefix("/api/markdown").Subrouter()
	markdownRouter.Use(authMiddleware)

	// Markdown preview endpoint
	markdownRouter.HandleFunc("/preview", handler.PreviewMarkdown).Methods("POST")

	// Markdown help endpoint
	markdownRouter.HandleFunc("/help", handler.GetMarkdownHelp).Methods("GET")

	// Markdown validation endpoint
	markdownRouter.HandleFunc("/validate", handler.ValidateMarkdown).Methods("POST")

	// Markdown metadata extraction endpoint
	markdownRouter.HandleFunc("/metadata", handler.ExtractMetadata).Methods("POST")

	// Markdown tag extraction endpoint
	markdownRouter.HandleFunc("/tags", handler.ExtractTags).Methods("POST")
}

// PreviewMarkdown handles markdown preview requests
func (h *MarkdownHandler) PreviewMarkdown(w http.ResponseWriter, r *http.Request) {
	// Decode request body
	var req PreviewRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	// Validate content
	if strings.TrimSpace(req.Content) == "" {
		respondWithError(w, http.StatusBadRequest, "Content cannot be empty", nil)
		return
	}

	// Validate markdown for security
	if err := h.markdownService.ValidateMarkdown(req.Content); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid markdown content", err)
		return
	}

	// Process markdown
	result, err := h.markdownService.ProcessMarkdown(req.Content)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to process markdown", err)
		return
	}

	// Prepare response
	response := PreviewResponse{
		HTML:     result.HTML,
		TOC:      result.TOC,
		Metadata: result.Metadata,
		Tags:     result.Tags,
		Success:  true,
	}

	respondWithJSON(w, http.StatusOK, response)
}

// GetMarkdownHelp returns markdown syntax help
func (h *MarkdownHandler) GetMarkdownHelp(w http.ResponseWriter, r *http.Request) {
	help := h.markdownService.MarkdownHelp()

	response := map[string]interface{}{
		"success": true,
		"data":    help,
	}

	respondWithJSON(w, http.StatusOK, response)
}

// ValidateMarkdown validates markdown content
func (h *MarkdownHandler) ValidateMarkdown(w http.ResponseWriter, r *http.Request) {
	var req PreviewRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	err := h.markdownService.ValidateMarkdown(req.Content)
	if err != nil {
		response := map[string]interface{}{
			"success": false,
			"valid":   false,
			"message": err.Error(),
		}
		respondWithJSON(w, http.StatusOK, response)
		return
	}

	response := map[string]interface{}{
		"success": true,
		"valid":   true,
		"message": "Markdown content is valid",
	}
	respondWithJSON(w, http.StatusOK, response)
}

// ExtractMetadata extracts metadata from markdown content
func (h *MarkdownHandler) ExtractMetadata(w http.ResponseWriter, r *http.Request) {
	var req PreviewRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	result, err := h.markdownService.ProcessMarkdown(req.Content)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to extract metadata", err)
		return
	}

	response := map[string]interface{}{
		"success":  true,
		"metadata": result.Metadata,
	}
	respondWithJSON(w, http.StatusOK, response)
}

// ExtractTags extracts tags from markdown content
func (h *MarkdownHandler) ExtractTags(w http.ResponseWriter, r *http.Request) {
	var req PreviewRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	result, err := h.markdownService.ProcessMarkdown(req.Content)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to extract tags", err)
		return
	}

	response := map[string]interface{}{
		"success": true,
		"tags":    result.Tags,
	}
	respondWithJSON(w, http.StatusOK, response)
}