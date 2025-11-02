package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"github.com/gpd/my-notes/internal/services"
)

// ExportImportHandler handles export and import operations
type ExportImportHandler struct {
	service *services.ExportImportService
}

// NewExportImportHandler creates a new export/import handler
func NewExportImportHandler(service *services.ExportImportService) *ExportImportHandler {
	return &ExportImportHandler{service: service}
}

// ExportData handles data export requests
func (h *ExportImportHandler) ExportData(w http.ResponseWriter, r *http.Request) {
	// Get user ID from context (set by auth middleware)
	userID, ok := r.Context().Value("user_id").(string)
	if !ok {
		http.Error(w, "User not authenticated", http.StatusUnauthorized)
		return
	}

	// Parse query parameters
	format := services.ExportFormat(r.URL.Query().Get("format"))
	if format == "" {
		format = services.FormatJSON
	}

	includeTemplates := r.URL.Query().Get("include_templates") == "true"

	// Validate format
	validFormats := map[services.ExportFormat]bool{
		services.FormatJSON:    true,
		services.FormatMarkdown: true,
		services.FormatHTML:     true,
		services.FormatZIP:      true,
	}

	if !validFormats[format] {
		http.Error(w, "Invalid export format. Supported formats: json, markdown, html, zip", http.StatusBadRequest)
		return
	}

	// Set timeout for export operation
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	// Export data
	data, err := h.service.ExportUserData(ctx, userID, format, includeTemplates)
	if err != nil {
		log.Printf("Export failed for user %s: %v", userID, err)
		http.Error(w, fmt.Sprintf("Export failed: %s", err.Error()), http.StatusInternalServerError)
		return
	}

	// Set appropriate content type and filename
	var contentType, filename string
	switch format {
	case services.FormatJSON:
		contentType = "application/json"
		filename = fmt.Sprintf("silence-notes-export-%s.json", time.Now().Format("2006-01-02"))
	case services.FormatMarkdown:
		contentType = "application/zip"
		filename = fmt.Sprintf("silence-notes-export-%s.zip", time.Now().Format("2006-01-02"))
	case services.FormatHTML:
		contentType = "text/html; charset=utf-8"
		filename = fmt.Sprintf("silence-notes-export-%s.html", time.Now().Format("2006-01-02"))
	case services.FormatZIP:
		contentType = "application/zip"
		filename = fmt.Sprintf("silence-notes-export-%s.zip", time.Now().Format("2006-01-02"))
	}

	// Set headers
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))
	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	w.Header().Set("Pragma", "no-cache")
	w.Header().Set("Expires", "0")

	// Write data
	w.Write(data)
}

// ImportData handles data import requests
func (h *ExportImportHandler) ImportData(w http.ResponseWriter, r *http.Request) {
	// Get user ID from context
	userID, ok := r.Context().Value("user_id").(string)
	if !ok {
		http.Error(w, "User not authenticated", http.StatusUnauthorized)
		return
	}

	// Limit file size (10MB)
	r.Body = http.MaxBytesReader(w, r.Body, 10*1024*1024)

	// Parse multipart form
	err := r.ParseMultipartForm(10 * 1024 * 1024) // 10MB
	if err != nil {
		http.Error(w, "Failed to parse form data or file too large", http.StatusBadRequest)
		return
	}

	// Get uploaded file
	file, header, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "No file provided or invalid file format", http.StatusBadRequest)
		return
	}

	// Validate file type
	allowedExtensions := map[string]bool{
		".json": true,
		".zip":  true,
	}
	ext := strings.ToLower(filepath.Ext(header.Filename))
	if !allowedExtensions[ext] {
		http.Error(w, "Invalid file type. Only JSON and ZIP files are supported", http.StatusBadRequest)
		return
	}

	// Set timeout for import operation
	ctx, cancel := context.WithTimeout(r.Context(), 60*time.Second)
	defer cancel()

	// Import data
	result, err := h.service.ImportUserData(ctx, userID, file, header)
	if err != nil {
		log.Printf("Import failed for user %s: %v", userID, err)
		http.Error(w, fmt.Sprintf("Import failed: %s", err.Error()), http.StatusInternalServerError)
		return
	}

	// Return import result
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// GetExportFormats returns supported export formats
func (h *ExportImportHandler) GetExportFormats(w http.ResponseWriter, r *http.Request) {
	formats := []map[string]interface{}{
		{
			"format":          "json",
			"name":            "JSON",
			"description":     "Complete data export in JSON format",
			"content_type":    "application/json",
			"file_extension":  ".json",
			"supports_templates": true,
		},
		{
			"format":          "markdown",
			"name":            "Markdown",
			"description":     "Individual markdown files for each note (zipped)",
			"content_type":    "application/zip",
			"file_extension":  ".zip",
			"supports_templates": true,
		},
		{
			"format":          "html",
			"name":            "HTML",
			"description":     "Notes formatted as HTML for viewing in browser",
			"content_type":    "text/html",
			"file_extension":  ".html",
			"supports_templates": false,
		},
		{
			"format":          "zip",
			"name":            "ZIP Archive",
			"description":     "Complete export in multiple formats (JSON, HTML, Markdown)",
			"content_type":    "application/zip",
			"file_extension":  ".zip",
			"supports_templates": true,
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"formats": formats,
	})
}

// GetImportInfo returns information about import capabilities and requirements
func (h *ExportImportHandler) GetImportInfo(w http.ResponseWriter, r *http.Request) {
	info := map[string]interface{}{
		"supported_formats": []string{
			"JSON files (.json)",
			"ZIP archives (.zip) containing JSON export",
		},
		"max_file_size":    "10MB",
		"requirements": []string{
			"Files must be exported from Silence Notes version 1.0 or later",
			"JSON files must contain export_info, notes, and optionally tags and templates",
			"ZIP files should contain a valid JSON export file",
		},
		"import_process": []string{
			"Existing notes with the same ID will be skipped",
			"New notes and tags will be created",
			"Built-in templates are not imported",
			"User templates with the same name will be skipped",
		},
		"security_notes": []string{
			"All imported data will be associated with your account",
			"Import operations cannot be undone",
			"Review your data before importing",
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(info)
}

// GetExportHistory returns user's export history (if we want to track this)
func (h *ExportImportHandler) GetExportHistory(w http.ResponseWriter, r *http.Request) {
	// This could be implemented to track export history
	// For now, return empty history
	history := []map[string]interface{}{}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"history": history,
		"total":   0,
	})
}

// ValidateImportFile validates an import file without actually importing
func (h *ExportImportHandler) ValidateImportFile(w http.ResponseWriter, r *http.Request) {
	// Just verify user is authenticated
	_, ok := r.Context().Value("user_id").(string)
	if !ok {
		http.Error(w, "User not authenticated", http.StatusUnauthorized)
		return
	}

	// Limit file size
	r.Body = http.MaxBytesReader(w, r.Body, 10*1024*1024)

	// Parse multipart form
	err := r.ParseMultipartForm(10 * 1024 * 1024)
	if err != nil {
		http.Error(w, "Failed to parse form data or file too large", http.StatusBadRequest)
		return
	}

	// Get uploaded file
	file, header, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "No file provided", http.StatusBadRequest)
		return
	}
	defer file.Close()

	// Read file content
	content, err := io.ReadAll(file)
	if err != nil {
		http.Error(w, "Failed to read file", http.StatusBadRequest)
		return
	}

	// Basic validation
	ext := strings.ToLower(filepath.Ext(header.Filename))
	validation := map[string]interface{}{
		"valid": false,
		"errors": []string{},
		"warnings": []string{},
		"preview": map[string]interface{}{},
	}

	switch ext {
	case ".json":
		validation = h.validateJSONFile(content)
	case ".zip":
		validation = h.validateZIPFile(content)
	default:
		validation["errors"] = append(validation["errors"].([]string), "Unsupported file format")
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(validation)
}

// validateJSONFile validates JSON import file
func (h *ExportImportHandler) validateJSONFile(content []byte) map[string]interface{} {
	validation := map[string]interface{}{
		"valid": true,
		"errors": []string{},
		"warnings": []string{},
		"preview": map[string]interface{}{},
	}

	var exportData map[string]interface{}
	err := json.Unmarshal(content, &exportData)
	if err != nil {
		validation["valid"] = false
		validation["errors"] = append(validation["errors"].([]string), "Invalid JSON format")
		return validation
	}

	// Check required fields
	if _, ok := exportData["export_info"]; !ok {
		validation["valid"] = false
		validation["errors"] = append(validation["errors"].([]string), "Missing export_info")
	}

	if _, ok := exportData["notes"]; !ok {
		validation["valid"] = false
		validation["errors"] = append(validation["errors"].([]string), "Missing notes data")
	}

	// Extract preview information
	if notes, ok := exportData["notes"].([]interface{}); ok {
		validation["preview"].(map[string]interface{})["note_count"] = len(notes)
	}

	if exportInfo, ok := exportData["export_info"].(map[string]interface{}); ok {
		if version, ok := exportInfo["version"]; ok {
			validation["preview"].(map[string]interface{})["version"] = version
		}
		if exportedAt, ok := exportInfo["exported_at"]; ok {
			validation["preview"].(map[string]interface{})["exported_at"] = exportedAt
		}
	}

	return validation
}

// validateZIPFile validates ZIP import file
func (h *ExportImportHandler) validateZIPFile(content []byte) map[string]interface{} {
	validation := map[string]interface{}{
		"valid": false,
		"errors": []string{},
		"warnings": []string{},
		"preview": map[string]interface{}{},
	}

	// For now, we can't easily validate ZIP without extra dependencies
	// This is a placeholder that would require implementing ZIP parsing
	validation["warnings"] = append(validation["warnings"].([]string), "ZIP file validation not fully implemented")
	validation["preview"].(map[string]interface{})["file_size"] = len(content)

	return validation
}

// Helper functions

// getUserIDFromContext extracts user ID from request context
func getUserIDFromContext(r *http.Request) (string, bool) {
	userID, ok := r.Context().Value("user_id").(string)
	return userID, ok
}

// sendJSONResponse sends a JSON response
func sendJSONResponse(w http.ResponseWriter, data interface{}, statusCode int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(data)
}

// sendErrorResponse sends an error response
func sendErrorResponse(w http.ResponseWriter, message string, statusCode int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"error": message,
		"status": statusCode,
	})
}

// LogExport logs export operations for monitoring
func LogExport(userID, format string, includeTemplates bool, success bool) {
	log.Printf("EXPORT: user=%s format=%s templates=%t success=%t",
		userID, format, includeTemplates, success)
}

// LogImport logs import operations for monitoring
func LogImport(userID, filename string, result *services.ImportResult) {
	log.Printf("IMPORT: user=%s file=%s notes=%d tags=%d success=%t errors=%d",
		userID, filename, result.ImportedNotes, result.ImportedTags,
		result.Success, len(result.Errors))
}