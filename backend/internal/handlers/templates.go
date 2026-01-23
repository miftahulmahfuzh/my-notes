package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"github.com/gpd/my-notes/internal/services"
	"github.com/gpd/my-notes/internal/models"
)

// TemplateHandler handles template-related requests
type TemplateHandler struct {
	templateService *services.TemplateService
}

// NewTemplateHandler creates a new template handler
func NewTemplateHandler(templateService *services.TemplateService) *TemplateHandler {
	return &TemplateHandler{
		templateService: templateService,
	}
}

// TemplateRequest represents a template creation/update request
type TemplateRequest struct {
	Name        string   `json:"name" validate:"required"`
	Description string   `json:"description"`
	Content     string   `json:"content" validate:"required"`
	Category    string   `json:"category"`
	Variables   []string `json:"variables"`
	IsPublic    bool     `json:"is_public"`
	Icon        string   `json:"icon"`
	Tags        []string `json:"tags"`
}

// TemplateApplyRequest represents a template application request
type TemplateApplyRequest struct {
	TemplateID uuid.UUID              `json:"template_id" validate:"required"`
	Variables  map[string]string      `json:"variables"`
}

// TemplateResponse represents a template response
type TemplateResponse struct {
	Success bool                 `json:"success"`
	Message string                `json:"message,omitempty"`
	Data    *models.Template      `json:"data,omitempty"`
	Results *services.TemplateProcessingResult `json:"results,omitempty"`
}

// TemplatesResponse represents a templates list response
type TemplatesResponse struct {
	Success bool                  `json:"success"`
	Message string                `json:"message,omitempty"`
	Data    []*models.Template    `json:"data"`
	Total   int                   `json:"total,omitempty"`
}

// Note: Template routes are registered in server.go setupRoutes() function
// This ensures proper dependency injection and middleware configuration

// CreateTemplate handles template creation
func (h *TemplateHandler) CreateTemplate(w http.ResponseWriter, r *http.Request) {
	// Ensure template service is initialized
	if h.templateService == nil {
		respondWithError(w, http.StatusInternalServerError, "Template service not initialized")
		return
	}

	// Get user from context (set by auth middleware) - same as notes handler
	user, ok := r.Context().Value("user").(*models.User)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}
	userID := user.ID

	var req TemplateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Create template
	template := &models.Template{
		ID:          uuid.New(),
		UserID:      userID,
		Name:        req.Name,
		Description: req.Description,
		Content:     req.Content,
		Category:    req.Category,
		Variables:   req.Variables,
		IsBuiltIn:   false,
		UsageCount:  0,
		IsPublic:    req.IsPublic,
		Icon:        req.Icon,
		Tags:        req.Tags,
		CreatedAt:   getCurrentTime(),
		UpdatedAt:   getCurrentTime(),
	}

	// Validate template
	if err := h.templateService.ValidateTemplate(template); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid template: "+err.Error())
		return
	}

	// Create template
	if err := h.templateService.CreateTemplate(template); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to create template: "+err.Error())
		return
	}

	response := TemplateResponse{
		Success: true,
		Message: "Template created successfully",
		Data:    template,
	}

	respondWithJSON(w, http.StatusCreated, response)
}

// GetTemplates retrieves templates for the authenticated user
func (h *TemplateHandler) GetTemplates(w http.ResponseWriter, r *http.Request) {
	// Ensure template service is initialized
	if h.templateService == nil {
		respondWithError(w, http.StatusInternalServerError, "Template service not initialized")
		return
	}

	// Get user ID from context
	user, ok := r.Context().Value("user").(*models.User)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}
	userID := user.ID

	// Parse query parameters
	category := r.URL.Query().Get("category")
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))

	if limit <= 0 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}

	// Get templates
	templates, err := h.templateService.GetTemplates(userID, category, limit, offset)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to retrieve templates: "+err.Error())
		return
	}

	response := TemplatesResponse{
		Success: true,
		Data:    templates,
		Total:   len(templates),
	}

	respondWithJSON(w, http.StatusOK, response)
}

// GetBuiltInTemplates retrieves all built-in templates
func (h *TemplateHandler) GetBuiltInTemplates(w http.ResponseWriter, r *http.Request) {
	// Ensure template service is initialized
	if h.templateService == nil {
		respondWithError(w, http.StatusInternalServerError, "Template service not initialized")
		return
	}

	// Get built-in templates
	templates, err := h.templateService.GetBuiltInTemplates()
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to retrieve built-in templates: "+err.Error())
		return
	}

	response := TemplatesResponse{
		Success: true,
		Data:    templates,
		Total:   len(templates),
	}

	respondWithJSON(w, http.StatusOK, response)
}

// GetPopularTemplates retrieves popular templates
func (h *TemplateHandler) GetPopularTemplates(w http.ResponseWriter, r *http.Request) {
	// Ensure template service is initialized
	if h.templateService == nil {
		respondWithError(w, http.StatusInternalServerError, "Template service not initialized")
		return
	}

	// Get user ID from context
	user, ok := r.Context().Value("user").(*models.User)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}
	userID := user.ID

	// Parse query parameters
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 {
		limit = 10
	}

	// Get popular templates
	templates, err := h.templateService.GetPopularTemplates(userID, limit)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to retrieve popular templates: "+err.Error())
		return
	}

	response := TemplatesResponse{
		Success: true,
		Data:    templates,
		Total:   len(templates),
	}

	respondWithJSON(w, http.StatusOK, response)
}

// SearchTemplates searches templates
func (h *TemplateHandler) SearchTemplates(w http.ResponseWriter, r *http.Request) {
	// Ensure template service is initialized
	if h.templateService == nil {
		respondWithError(w, http.StatusInternalServerError, "Template service not initialized")
		return
	}

	// Get user ID from context
	user, ok := r.Context().Value("user").(*models.User)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}
	userID := user.ID

	// Parse query parameters
	query := r.URL.Query().Get("q")
	if query == "" {
		respondWithError(w, http.StatusBadRequest, "Search query is required")
		return
	}

	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 {
		limit = 20
	}

	// Search templates
	templates, err := h.templateService.SearchTemplates(userID, query, limit)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to search templates: "+err.Error())
		return
	}

	response := TemplatesResponse{
		Success: true,
		Data:    templates,
		Total:   len(templates),
	}

	respondWithJSON(w, http.StatusOK, response)
}

// GetTemplateStats retrieves template usage statistics
func (h *TemplateHandler) GetTemplateStats(w http.ResponseWriter, r *http.Request) {
	// Ensure template service is initialized
	if h.templateService == nil {
		respondWithError(w, http.StatusInternalServerError, "Template service not initialized")
		return
	}

	// Get user ID from context
	user, ok := r.Context().Value("user").(*models.User)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}
	userID := user.ID

	// Get usage stats
	stats, err := h.templateService.GetTemplateUsageStats(userID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to retrieve template stats: "+err.Error())
		return
	}

	response := map[string]interface{}{
		"success": true,
		"stats":   stats,
	}

	respondWithJSON(w, http.StatusOK, response)
}

// GetTemplate retrieves a specific template
func (h *TemplateHandler) GetTemplate(w http.ResponseWriter, r *http.Request) {
	// Ensure template service is initialized
	if h.templateService == nil {
		respondWithError(w, http.StatusInternalServerError, "Template service not initialized")
		return
	}

	// Get user ID from context
	user, ok := r.Context().Value("user").(*models.User)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}
	userID := user.ID

	// Parse template ID from URL
	vars := mux.Vars(r)
	templateID, err := uuid.Parse(vars["id"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid template ID")
		return
	}

	// Get template
	template, err := h.templateService.GetTemplate(templateID, userID)
	if err != nil {
		respondWithError(w, http.StatusNotFound, "Template not found: "+err.Error())
		return
	}

	response := TemplateResponse{
		Success: true,
		Data:    template,
	}

	respondWithJSON(w, http.StatusOK, response)
}

// UpdateTemplate updates an existing template
func (h *TemplateHandler) UpdateTemplate(w http.ResponseWriter, r *http.Request) {
	// Ensure template service is initialized
	if h.templateService == nil {
		respondWithError(w, http.StatusInternalServerError, "Template service not initialized")
		return
	}

	// Get user ID from context
	user, ok := r.Context().Value("user").(*models.User)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}
	userID := user.ID

	// Parse template ID from URL
	vars := mux.Vars(r)
	templateID, err := uuid.Parse(vars["id"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid template ID")
		return
	}

	var req TemplateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Get existing template
	template, err := h.templateService.GetTemplate(templateID, userID)
	if err != nil {
		respondWithError(w, http.StatusNotFound, "Template not found: "+err.Error())
		return
	}

	// Check if user can update this template
	if template.UserID != userID && template.IsBuiltIn {
		respondWithError(w, http.StatusForbidden, "Cannot update built-in template")
		return
	}

	// Update template fields
	template.Name = req.Name
	template.Description = req.Description
	template.Content = req.Content
	template.Category = req.Category
	template.Variables = req.Variables
	template.IsPublic = req.IsPublic
	template.Icon = req.Icon
	template.Tags = req.Tags
	template.UpdatedAt = getCurrentTime()

	// Validate template
	if err := h.templateService.ValidateTemplate(template); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid template: "+err.Error())
		return
	}

	// Update template
	if err := h.templateService.UpdateTemplate(template); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to update template: "+err.Error())
		return
	}

	response := TemplateResponse{
		Success: true,
		Message: "Template updated successfully",
		Data:    template,
	}

	respondWithJSON(w, http.StatusOK, response)
}

// DeleteTemplate deletes a template
func (h *TemplateHandler) DeleteTemplate(w http.ResponseWriter, r *http.Request) {
	// Ensure template service is initialized
	if h.templateService == nil {
		respondWithError(w, http.StatusInternalServerError, "Template service not initialized")
		return
	}

	// Get user ID from context
	user, ok := r.Context().Value("user").(*models.User)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}
	userID := user.ID

	// Parse template ID from URL
	vars := mux.Vars(r)
	templateID, err := uuid.Parse(vars["id"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid template ID")
		return
	}

	// Get existing template to check permissions
	template, err := h.templateService.GetTemplate(templateID, userID)
	if err != nil {
		respondWithError(w, http.StatusNotFound, "Template not found: "+err.Error())
		return
	}

	// Check if user can delete this template
	if template.UserID != userID && template.IsBuiltIn {
		respondWithError(w, http.StatusForbidden, "Cannot delete built-in template")
		return
	}

	// Delete template
	if err := h.templateService.DeleteTemplate(templateID, userID); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to delete template: "+err.Error())
		return
	}

	response := map[string]interface{}{
		"success": true,
		"message": "Template deleted successfully",
	}

	respondWithJSON(w, http.StatusOK, response)
}

// ApplyTemplate applies a template to create note content
func (h *TemplateHandler) ApplyTemplate(w http.ResponseWriter, r *http.Request) {
	// Ensure template service is initialized
	if h.templateService == nil {
		respondWithError(w, http.StatusInternalServerError, "Template service not initialized")
		return
	}

	// Get user ID from context
	user, ok := r.Context().Value("user").(*models.User)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}
	userID := user.ID

	// Parse template ID from URL
	vars := mux.Vars(r)
	templateID, err := uuid.Parse(vars["id"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid template ID")
		return
	}

	var req TemplateApplyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Process template
	result, err := h.templateService.ProcessTemplate(templateID, userID, req.Variables)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to process template: "+err.Error())
		return
	}

	response := TemplateResponse{
		Success: true,
		Message: "Template applied successfully",
		Results: result,
	}

	respondWithJSON(w, http.StatusOK, response)
}

// Helper functions
func getCurrentTime() time.Time {
	return time.Now().UTC()
}