package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

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

// RegisterTemplateRoutes registers template-related routes
func RegisterTemplateRoutes(router *mux.Router, authMiddleware mux.MiddlewareFunc) {
	handler := NewTemplateHandler(nil) // Will be initialized with dependencies

	// Apply authentication middleware to all template routes
	templateRouter := router.PathPrefix("/api/v1/templates").Subrouter()
	templateRouter.Use(authMiddleware)

	// Template CRUD operations
	templateRouter.HandleFunc("", handler.CreateTemplate).Methods("POST")
	templateRouter.HandleFunc("", handler.GetTemplates).Methods("GET")
	templateRouter.HandleFunc("/built-in", handler.GetBuiltInTemplates).Methods("GET")
	templateRouter.HandleFunc("/popular", handler.GetPopularTemplates).Methods("GET")
	templateRouter.HandleFunc("/search", handler.SearchTemplates).Methods("GET")
	templateRouter.HandleFunc("/stats", handler.GetTemplateStats).Methods("GET")
	templateRouter.HandleFunc("/{id}", handler.GetTemplate).Methods("GET")
	templateRouter.HandleFunc("/{id}", handler.UpdateTemplate).Methods("PUT")
	templateRouter.HandleFunc("/{id}", handler.DeleteTemplate).Methods("DELETE")

	// Template application
	templateRouter.HandleFunc("/{id}/apply", handler.ApplyTemplate).Methods("POST")
	templateRouter.HandleFunc("/apply", handler.ApplyTemplateByName).Methods("POST")
}

// CreateTemplate handles template creation
func (h *TemplateHandler) CreateTemplate(w http.ResponseWriter, r *http.Request) {
	// Get user ID from context (set by auth middleware)
	userID, ok := r.Context().Value("user_id").(uuid.UUID)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "User not authenticated", nil)
		return
	}

	var req TemplateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body", err)
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

	// Initialize template service (in production, this would be dependency injected)
	h.templateService = services.NewTemplateService(getDatabase(r))

	// Validate template
	if err := h.templateService.ValidateTemplate(template); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid template", err)
		return
	}

	// Create template
	if err := h.templateService.CreateTemplate(template); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to create template", err)
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
	// Get user ID from context
	userID, ok := r.Context().Value("user_id").(uuid.UUID)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "User not authenticated", nil)
		return
	}

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

	// Initialize template service
	h.templateService = services.NewTemplateService(getDatabase(r))

	// Get templates
	templates, err := h.templateService.GetTemplates(userID, category, limit, offset)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to retrieve templates", err)
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
	// Initialize template service
	h.templateService = services.NewTemplateService(getDatabase(r))

	// Get built-in templates
	templates, err := h.templateService.GetBuiltInTemplates()
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to retrieve built-in templates", err)
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
	// Get user ID from context
	userID, ok := r.Context().Value("user_id").(uuid.UUID)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "User not authenticated", nil)
		return
	}

	// Parse query parameters
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 {
		limit = 10
	}

	// Initialize template service
	h.templateService = services.NewTemplateService(getDatabase(r))

	// Get popular templates
	templates, err := h.templateService.GetPopularTemplates(userID, limit)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to retrieve popular templates", err)
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
	// Get user ID from context
	userID, ok := r.Context().Value("user_id").(uuid.UUID)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "User not authenticated", nil)
		return
	}

	// Parse query parameters
	query := r.URL.Query().Get("q")
	if query == "" {
		respondWithError(w, http.StatusBadRequest, "Search query is required", nil)
		return
	}

	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 {
		limit = 20
	}

	// Initialize template service
	h.templateService = services.NewTemplateService(getDatabase(r))

	// Search templates
	templates, err := h.templateService.SearchTemplates(userID, query, limit)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to search templates", err)
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
	// Get user ID from context
	userID, ok := r.Context().Value("user_id").(uuid.UUID)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "User not authenticated", nil)
		return
	}

	// Initialize template service
	h.templateService = services.NewTemplateService(getDatabase(r))

	// Get usage stats
	stats, err := h.templateService.GetTemplateUsageStats(userID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to retrieve template stats", err)
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
	// Get user ID from context
	userID, ok := r.Context().Value("user_id").(uuid.UUID)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "User not authenticated", nil)
		return
	}

	// Parse template ID from URL
	vars := mux.Vars(r)
	templateID, err := uuid.Parse(vars["id"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid template ID", err)
		return
	}

	// Initialize template service
	h.templateService = services.NewTemplateService(getDatabase(r))

	// Get template
	template, err := h.templateService.GetTemplate(templateID, userID)
	if err != nil {
		respondWithError(w, http.StatusNotFound, "Template not found", err)
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
	// Get user ID from context
	userID, ok := r.Context().Value("user_id").(uuid.UUID)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "User not authenticated", nil)
		return
	}

	// Parse template ID from URL
	vars := mux.Vars(r)
	templateID, err := uuid.Parse(vars["id"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid template ID", err)
		return
	}

	var req TemplateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	// Initialize template service
	h.templateService = services.NewTemplateService(getDatabase(r))

	// Get existing template
	template, err := h.templateService.GetTemplate(templateID, userID)
	if err != nil {
		respondWithError(w, http.StatusNotFound, "Template not found", err)
		return
	}

	// Check if user can update this template
	if template.UserID != userID && template.IsBuiltIn {
		respondWithError(w, http.StatusForbidden, "Cannot update built-in template", nil)
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
		respondWithError(w, http.StatusBadRequest, "Invalid template", err)
		return
	}

	// Update template
	if err := h.templateService.UpdateTemplate(template); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to update template", err)
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
	// Get user ID from context
	userID, ok := r.Context().Value("user_id").(uuid.UUID)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "User not authenticated", nil)
		return
	}

	// Parse template ID from URL
	vars := mux.Vars(r)
	templateID, err := uuid.Parse(vars["id"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid template ID", err)
		return
	}

	// Initialize template service
	h.templateService = services.NewTemplateService(getDatabase(r))

	// Get existing template to check permissions
	template, err := h.templateService.GetTemplate(templateID, userID)
	if err != nil {
		respondWithError(w, http.StatusNotFound, "Template not found", err)
		return
	}

	// Check if user can delete this template
	if template.UserID != userID && template.IsBuiltIn {
		respondWithError(w, http.StatusForbidden, "Cannot delete built-in template", nil)
		return
	}

	// Delete template
	if err := h.templateService.DeleteTemplate(templateID, userID); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to delete template", err)
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
	// Get user ID from context
	userID, ok := r.Context().Value("user_id").(uuid.UUID)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "User not authenticated", nil)
		return
	}

	// Parse template ID from URL
	vars := mux.Vars(r)
	templateID, err := uuid.Parse(vars["id"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid template ID", err)
		return
	}

	var req TemplateApplyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	// Initialize template service
	h.templateService = services.NewTemplateService(getDatabase(r))

	// Process template
	result, err := h.templateService.ProcessTemplate(templateID, userID, req.Variables)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to process template", err)
		return
	}

	response := TemplateResponse{
		Success: true,
		Message: "Template applied successfully",
		Results: result,
	}

	respondWithJSON(w, http.StatusOK, response)
}

// ApplyTemplateByName applies a template by name
func (h *TemplateHandler) ApplyTemplateByName(w http.ResponseWriter, r *http.Request) {
	// Get user ID from context
	userID, ok := r.Context().Value("user_id").(uuid.UUID)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "User not authenticated", nil)
		return
	}

	var req struct {
		TemplateName string            `json:"template_name" validate:"required"`
		Variables    map[string]string  `json:"variables"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	// Initialize template service
	h.templateService = services.NewTemplateService(getDatabase(r))

	// Search for template by name
	templates, err := h.templateService.SearchTemplates(userID, req.TemplateName, 1)
	if err != nil || len(templates) == 0 {
		respondWithError(w, http.StatusNotFound, "Template not found", err)
		return
	}

	// Process template
	result, err := h.templateService.ProcessTemplate(templates[0].ID, userID, req.Variables)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to process template", err)
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

func getDatabase(r *http.Request) interface{} {
	// In a real implementation, this would get the database instance from the request context
	// For now, return nil as placeholder
	return nil
}