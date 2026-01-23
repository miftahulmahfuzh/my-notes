package services

import (
	"archive/zip"
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"path/filepath"
	"strings"
	"time"

	"github.com/gpd/my-notes/internal/models"
)

// ExportImportService handles export and import operations for notes and templates
type ExportImportService struct {
	db *sql.DB
}

// NewExportImportService creates a new export/import service instance
func NewExportImportService(db *sql.DB) *ExportImportService {
	return &ExportImportService{db: db}
}

// ExportFormat represents the supported export formats
type ExportFormat string

const (
	FormatJSON    ExportFormat = "json"
	FormatMarkdown ExportFormat = "markdown"
	FormatHTML     ExportFormat = "html"
	FormatZIP      ExportFormat = "zip"
)

// ExportData represents the structure for exported data
type ExportData struct {
	ExportInfo ExportInfo        `json:"export_info"`
	Notes      []models.Note     `json:"notes"`
	Tags       []models.Tag      `json:"tags,omitempty"`
	Templates  []models.Template `json:"templates,omitempty"`
}

// ExportInfo contains metadata about the export
type ExportInfo struct {
	Version       string    `json:"version"`
	ExportedAt    time.Time `json:"exported_at"`
	ExportedBy    string    `json:"exported_by"`
	Format        string    `json:"format"`
	TotalNotes    int       `json:"total_notes"`
	TotalTags     int       `json:"total_tags"`
	TotalTemplates int      `json:"total_templates"`
}

// ImportResult represents the result of an import operation
type ImportResult struct {
	Success       bool     `json:"success"`
	Message       string   `json:"message"`
	ImportedNotes int      `json:"imported_notes"`
	ImportedTags  int      `json:"imported_tags"`
	SkippedItems  []string `json:"skipped_items,omitempty"`
	Errors        []string `json:"errors,omitempty"`
}

// ExportUserData exports user data in the specified format
func (s *ExportImportService) ExportUserData(ctx context.Context, userID string, format ExportFormat, includeTemplates bool) ([]byte, error) {
	switch format {
	case FormatJSON:
		return s.exportAsJSON(ctx, userID, includeTemplates)
	case FormatMarkdown:
		return s.exportAsMarkdown(ctx, userID, includeTemplates)
	case FormatHTML:
		return s.exportAsHTML(ctx, userID, includeTemplates)
	case FormatZIP:
		return s.exportAsZIP(ctx, userID, includeTemplates)
	default:
		return nil, fmt.Errorf("unsupported export format: %s", format)
	}
}

// exportAsJSON exports data as JSON format
func (s *ExportImportService) exportAsJSON(ctx context.Context, userID string, includeTemplates bool) ([]byte, error) {
	// Get user's notes
	notes, err := s.getUserNotes(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get notes: %w", err)
	}

	// Get user's tags
	tags, err := s.getUserTags(ctx, userID)
	if err != nil {
		log.Printf("Warning: failed to get tags: %v", err)
		tags = []models.Tag{}
	}

	// Get user's templates if requested
	var templates []models.Template
	if includeTemplates {
		templates, err = s.getUserTemplates(ctx, userID)
		if err != nil {
			log.Printf("Warning: failed to get templates: %v", err)
			templates = []models.Template{}
		}
	}

	// Get user info for export metadata
	username, err := s.getUserName(ctx, userID)
	if err != nil {
		log.Printf("Warning: failed to get username: %v", err)
		username = "unknown"
	}

	// Create export data
	exportData := ExportData{
		ExportInfo: ExportInfo{
			Version:        "1.0",
			ExportedAt:     time.Now(),
			ExportedBy:     username,
			Format:         string(FormatJSON),
			TotalNotes:     len(notes),
			TotalTags:      len(tags),
			TotalTemplates: len(templates),
		},
		Notes:     notes,
		Tags:      tags,
		Templates: templates,
	}

	// Convert to JSON
	jsonData, err := json.MarshalIndent(exportData, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("failed to marshal export data: %w", err)
	}

	return jsonData, nil
}

// exportAsMarkdown exports notes as individual markdown files (zipped)
func (s *ExportImportService) exportAsMarkdown(ctx context.Context, userID string, includeTemplates bool) ([]byte, error) {
	notes, err := s.getUserNotes(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get notes: %w", err)
	}

	// Create zip file in memory
	var buf bytes.Buffer
	zipWriter := zip.NewWriter(&buf)

	// Add each note as a markdown file
	for _, note := range notes {
		var titleStr string
		if note.Title != nil {
			titleStr = *note.Title
		}
		filename := s.sanitizeFilename(titleStr) + ".md"
		if filename == ".md" {
			filename = fmt.Sprintf("note_%s.md", note.ID)
		}

		fileWriter, err := zipWriter.Create(filename)
		if err != nil {
			return nil, fmt.Errorf("failed to create file in zip: %w", err)
		}

		// Write markdown content
		content := fmt.Sprintf("# %s\n\n", note.Title)
		content += note.Content
		content += fmt.Sprintf("\n\n---\nCreated: %s\nUpdated: %s",
			note.CreatedAt.Format("2006-01-02 15:04:05"),
			note.UpdatedAt.Format("2006-01-02 15:04:05"))

		_, err = fileWriter.Write([]byte(content))
		if err != nil {
			return nil, fmt.Errorf("failed to write content to zip: %w", err)
		}
	}

	// Add templates if requested
	if includeTemplates {
		templates, err := s.getUserTemplates(ctx, userID)
		if err == nil {
			for _, template := range templates {
				filename := "templates/" + s.sanitizeFilename(template.Name) + ".md"
				if filename == "templates/.md" {
					filename = fmt.Sprintf("templates/template_%s.md", template.ID)
				}

				fileWriter, err := zipWriter.Create(filename)
				if err != nil {
					continue
				}

				content := fmt.Sprintf("# %s\n\n", template.Name)
				content += template.Description
				content += fmt.Sprintf("\n\n---\nCategory: %s\nVariables: %v",
					template.Category, template.Variables)

				_, err = fileWriter.Write([]byte(content))
				if err != nil {
					continue
				}
			}
		}
	}

	// Close zip writer
	err = zipWriter.Close()
	if err != nil {
		return nil, fmt.Errorf("failed to close zip writer: %w", err)
	}

	return buf.Bytes(), nil
}

// exportAsHTML exports notes as HTML file
func (s *ExportImportService) exportAsHTML(ctx context.Context, userID string, includeTemplates bool) ([]byte, error) {
	notes, err := s.getUserNotes(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get notes: %w", err)
	}

	// Generate HTML content
	html := `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Silence Notes Export</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; }
        .note { border-bottom: 1px solid #eee; padding: 20px 0; }
        .note-title { font-size: 24px; font-weight: bold; margin: 0 0 10px 0; color: #333; }
        .note-content { white-space: pre-wrap; margin: 10px 0; }
        .note-meta { font-size: 12px; color: #666; margin-top: 10px; }
        .export-info { background: #f5f5f5; padding: 20px; border-radius: 5px; margin-bottom: 30px; }
    </style>
</head>
<body>
    <div class="export-info">
        <h1>Silence Notes Export</h1>
        <p>Exported on: ` + time.Now().Format("2006-01-02 15:04:05") + `</p>
        <p>Total notes: ` + fmt.Sprintf("%d", len(notes)) + `</p>
    </div>
`

	for _, note := range notes {
		html += fmt.Sprintf(`
    <div class="note">
        <h2 class="note-title">%s</h2>
        <div class="note-content">%s</div>
        <div class="note-meta">
            Created: %s | Updated: %s
        </div>
    </div>`,
			note.Title,
			note.Content,
			note.CreatedAt.Format("2006-01-02 15:04:05"),
			note.UpdatedAt.Format("2006-01-02 15:04:05"))
	}

	html += `
</body>
</html>`

	return []byte(html), nil
}

// exportAsZIP exports data as a comprehensive ZIP archive
func (s *ExportImportService) exportAsZIP(ctx context.Context, userID string, includeTemplates bool) ([]byte, error) {
	var buf bytes.Buffer
	zipWriter := zip.NewWriter(&buf)

	// Add JSON export
	jsonData, err := s.exportAsJSON(ctx, userID, includeTemplates)
	if err == nil {
		fileWriter, _ := zipWriter.Create("export.json")
		fileWriter.Write(jsonData)
	}

	// Add HTML export
	htmlData, err := s.exportAsHTML(ctx, userID, includeTemplates)
	if err == nil {
		fileWriter, _ := zipWriter.Create("notes.html")
		fileWriter.Write(htmlData)
	}

	// Add individual markdown files
	mdData, err := s.exportAsMarkdown(ctx, userID, includeTemplates)
	if err == nil {
		fileWriter, _ := zipWriter.Create("markdown.zip")
		fileWriter.Write(mdData)
	}

	// Add README
	readmeContent := fmt.Sprintf(`Silence Notes Export
==================

Exported on: %s
Export Format: ZIP Archive
Total Notes: %d

This archive contains your notes in multiple formats:
- export.json: Complete data export in JSON format
- notes.html: Notes formatted as HTML
- markdown.zip: Individual markdown files for each note

For more information about Silence Notes, visit the project documentation.
`, time.Now().Format("2006-01-02 15:04:05"), s.getNoteCount(ctx, userID))

	fileWriter, _ := zipWriter.Create("README.txt")
	fileWriter.Write([]byte(readmeContent))

	// Close zip writer
	err = zipWriter.Close()
	if err != nil {
		return nil, fmt.Errorf("failed to close zip writer: %w", err)
	}

	return buf.Bytes(), nil
}

// ImportUserData imports user data from uploaded file
func (s *ExportImportService) ImportUserData(ctx context.Context, userID string, file multipart.File, header *multipart.FileHeader) (*ImportResult, error) {
	defer file.Close()

	// Check file extension to determine format
	ext := strings.ToLower(strings.TrimPrefix(filepath.Ext(header.Filename), "."))

	switch ext {
	case "json":
		return s.importFromJSON(ctx, userID, file)
	case "zip":
		return s.importFromZIP(ctx, userID, file)
	default:
		return &ImportResult{
			Success: false,
			Message: fmt.Sprintf("Unsupported file format: %s. Supported formats: JSON, ZIP", ext),
		}, nil
	}
}

// importFromJSON imports data from JSON file
func (s *ExportImportService) importFromJSON(ctx context.Context, userID string, file io.Reader) (*ImportResult, error) {
	// Read file content
	content, err := io.ReadAll(file)
	if err != nil {
		return nil, fmt.Errorf("failed to read file: %w", err)
	}

	// Parse JSON
	var exportData ExportData
	err = json.Unmarshal(content, &exportData)
	if err != nil {
		return &ImportResult{
			Success: false,
			Message: "Invalid JSON format",
			Errors:  []string{err.Error()},
		}, nil
	}

	result := &ImportResult{
		Success: true,
		Message: "Import completed successfully",
	}

	// Import tags first
	if len(exportData.Tags) > 0 {
		importedTags, skippedTags, tagErrors := s.importTags(ctx, userID, exportData.Tags)
		result.ImportedTags = importedTags
		result.SkippedItems = append(result.SkippedItems, skippedTags...)
		result.Errors = append(result.Errors, tagErrors...)
	}

	// Import notes
	if len(exportData.Notes) > 0 {
		importedNotes, skippedNotes, noteErrors := s.importNotes(ctx, userID, exportData.Notes)
		result.ImportedNotes = importedNotes
		result.SkippedItems = append(result.SkippedItems, skippedNotes...)
		result.Errors = append(result.Errors, noteErrors...)
	}

	// Import templates if available
	if len(exportData.Templates) > 0 {
		_, skippedTemplates, templateErrors := s.importTemplates(ctx, userID, exportData.Templates)
		result.SkippedItems = append(result.SkippedItems, skippedTemplates...)
		result.Errors = append(result.Errors, templateErrors...)
	}

	if len(result.Errors) > 0 {
		result.Message = fmt.Sprintf("Import completed with %d warnings", len(result.Errors))
	}

	return result, nil
}

// importFromZIP imports data from ZIP file
func (s *ExportImportService) importFromZIP(ctx context.Context, userID string, file io.Reader) (*ImportResult, error) {
	// Read the entire file content first
	data, err := io.ReadAll(file)
	if err != nil {
		return nil, fmt.Errorf("failed to read ZIP file: %w", err)
	}

	// Create a reader from the bytes
	zipReader, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return nil, fmt.Errorf("failed to read ZIP file: %w", err)
	}

	// Look for JSON file first
	for _, zipFile := range zipReader.File {
		if strings.HasSuffix(zipFile.Name, ".json") && zipFile.Name != "README.txt" {
			fileReader, err := zipFile.Open()
			if err != nil {
				continue
			}
			defer fileReader.Close()

			return s.importFromJSON(ctx, userID, fileReader)
		}
	}

	return &ImportResult{
		Success: false,
		Message: "No valid JSON export file found in ZIP archive",
	}, nil
}

// Helper methods

func (s *ExportImportService) getUserNotes(ctx context.Context, userID string) ([]models.Note, error) {
	query := `SELECT id, user_id, title, content, created_at, updated_at, version
			  FROM notes WHERE user_id = $1 ORDER BY created_at DESC`

	rows, err := s.db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var notes []models.Note
	for rows.Next() {
		var note models.Note
		err := rows.Scan(&note.ID, &note.UserID, &note.Title, &note.Content,
			&note.CreatedAt, &note.UpdatedAt, &note.Version)
		if err != nil {
			continue
		}
		notes = append(notes, note)
	}

	return notes, nil
}

func (s *ExportImportService) getUserTags(ctx context.Context, userID string) ([]models.Tag, error) {
	query := `SELECT DISTINCT t.id, t.name, t.created_at
			  FROM tags t
			  JOIN note_tags nt ON t.id = nt.tag_id
			  JOIN notes n ON nt.note_id = n.id
			  WHERE n.user_id = $1 ORDER BY t.name`

	rows, err := s.db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tags []models.Tag
	for rows.Next() {
		var tag models.Tag
		err := rows.Scan(&tag.ID, &tag.Name, &tag.CreatedAt)
		if err != nil {
			continue
		}
		tags = append(tags, tag)
	}

	return tags, nil
}

func (s *ExportImportService) getUserTemplates(ctx context.Context, userID string) ([]models.Template, error) {
	query := `SELECT id, user_id, name, description, content, category, variables,
			  is_public, icon, tags, usage_count, created_at, updated_at
			  FROM templates WHERE user_id = $1 ORDER BY name`

	rows, err := s.db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var templates []models.Template
	for rows.Next() {
		var template models.Template
		var tagsJSON sql.NullString
		err := rows.Scan(&template.ID, &template.UserID, &template.Name,
			&template.Description, &template.Content, &template.Category,
			&template.Variables, &template.IsPublic, &template.Icon,
			&tagsJSON, &template.UsageCount, &template.CreatedAt, &template.UpdatedAt)
		if err != nil {
			continue
		}

		// Parse tags JSON
		if tagsJSON.Valid {
			json.Unmarshal([]byte(tagsJSON.String), &template.Tags)
		}

		templates = append(templates, template)
	}

	return templates, nil
}

func (s *ExportImportService) getUserName(ctx context.Context, userID string) (string, error) {
	query := `SELECT name FROM users WHERE id = $1`
	var name string
	err := s.db.QueryRowContext(ctx, query, userID).Scan(&name)
	return name, err
}

func (s *ExportImportService) getNoteCount(ctx context.Context, userID string) int {
	query := `SELECT COUNT(*) FROM notes WHERE user_id = $1`
	var count int
	s.db.QueryRowContext(ctx, query, userID).Scan(&count)
	return count
}

func (s *ExportImportService) sanitizeFilename(filename string) string {
	// Remove or replace invalid characters
	filename = strings.ReplaceAll(filename, "/", "_")
	filename = strings.ReplaceAll(filename, "\\", "_")
	filename = strings.ReplaceAll(filename, ":", "_")
	filename = strings.ReplaceAll(filename, "*", "_")
	filename = strings.ReplaceAll(filename, "?", "_")
	filename = strings.ReplaceAll(filename, "\"", "_")
	filename = strings.ReplaceAll(filename, "<", "_")
	filename = strings.ReplaceAll(filename, ">", "_")
	filename = strings.ReplaceAll(filename, "|", "_")

	// Remove leading/trailing spaces and dots
	filename = strings.TrimSpace(filename)
	filename = strings.Trim(filename, ".")

	if filename == "" {
		filename = "untitled"
	}

	return filename
}

func (s *ExportImportService) importTags(ctx context.Context, userID string, tags []models.Tag) (int, []string, []string) {
	var imported, skipped int
	var errors []string

	for _, tag := range tags {
		// Check if tag already exists
		var exists bool
		checkQuery := `SELECT EXISTS(SELECT 1 FROM tags WHERE name = $1 AND user_id = $2)`
		s.db.QueryRowContext(ctx, checkQuery, tag.Name, userID).Scan(&exists)

		if exists {
			skipped++
			continue
		}

		// Insert new tag
		insertQuery := `INSERT INTO tags (name, user_id, created_at) VALUES ($1, $2, $3)`
		_, err := s.db.ExecContext(ctx, insertQuery, tag.Name, userID, time.Now())
		if err != nil {
			errors = append(errors, fmt.Sprintf("Failed to import tag '%s': %v", tag.Name, err))
			continue
		}

		imported++
	}

	return imported, []string{fmt.Sprintf("Skipped %d existing tags", skipped)}, errors
}

func (s *ExportImportService) importNotes(ctx context.Context, userID string, notes []models.Note) (int, []string, []string) {
	var imported, skipped int
	var skippedItems, errors []string

	for _, note := range notes {
		// Check if note already exists
		var exists bool
		checkQuery := `SELECT EXISTS(SELECT 1 FROM notes WHERE id = $1 AND user_id = $2)`
		s.db.QueryRowContext(ctx, checkQuery, note.ID, userID).Scan(&exists)

		if exists {
			skipped++
			skippedItems = append(skippedItems, fmt.Sprintf("Note '%s' already exists", note.Title))
			continue
		}

		// Insert new note
		insertQuery := `INSERT INTO notes (id, user_id, title, content, created_at, updated_at, version)
						VALUES ($1, $2, $3, $4, $5, $6, $7)`
		_, err := s.db.ExecContext(ctx, insertQuery,
			note.ID, userID, note.Title, note.Content,
			note.CreatedAt, note.UpdatedAt, note.Version)
		if err != nil {
			errors = append(errors, fmt.Sprintf("Failed to import note '%s': %v", note.Title, err))
			continue
		}

		imported++
	}

	return imported, skippedItems, errors
}

func (s *ExportImportService) importTemplates(ctx context.Context, userID string, templates []models.Template) (int, []string, []string) {
	var imported, skipped int
	var skippedItems, errors []string

	for _, template := range templates {
		// Skip built-in templates
		if template.IsBuiltIn {
			skipped++
			skippedItems = append(skippedItems, fmt.Sprintf("Built-in template '%s' skipped", template.Name))
			continue
		}

		// Check if template already exists
		var exists bool
		checkQuery := `SELECT EXISTS(SELECT 1 FROM templates WHERE name = $1 AND user_id = $2)`
		s.db.QueryRowContext(ctx, checkQuery, template.Name, userID).Scan(&exists)

		if exists {
			skipped++
			skippedItems = append(skippedItems, fmt.Sprintf("Template '%s' already exists", template.Name))
			continue
		}

		// Serialize tags to JSON
		tagsJSON, _ := json.Marshal(template.Tags)

		// Insert new template
		insertQuery := `INSERT INTO templates (id, user_id, name, description, content, category,
						variables, is_public, icon, tags, usage_count, created_at, updated_at)
						VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`
		_, err := s.db.ExecContext(ctx, insertQuery,
			template.ID, userID, template.Name, template.Description, template.Content,
			template.Category, template.Variables, template.IsPublic, template.Icon,
			tagsJSON, template.UsageCount, template.CreatedAt, template.UpdatedAt)
		if err != nil {
			errors = append(errors, fmt.Sprintf("Failed to import template '%s': %v", template.Name, err))
			continue
		}

		imported++
	}

	return imported, skippedItems, errors
}