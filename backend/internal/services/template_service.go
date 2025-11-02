package services

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/gpd/my-notes/internal/models"
)

// TemplateService handles template operations
type TemplateService struct {
	db *sql.DB
}

// NewTemplateService creates a new template service instance
func NewTemplateService(db *sql.DB) *TemplateService {
	return &TemplateService{db: db}
}

// TemplateProcessingResult represents the result of processing a template
type TemplateProcessingResult struct {
	Content     string            `json:"content"`
	Variables   map[string]string `json:"variables"`
	Unfilled    []string          `json:"unfilled"`
	Metadata    map[string]string `json:"metadata"`
	UsedAt      time.Time         `json:"used_at"`
}

// CreateTemplate creates a new template
func (s *TemplateService) CreateTemplate(template *models.Template) error {
	query := `
		INSERT INTO templates (id, user_id, name, description, content, category, variables, is_built_in, usage_count, is_public, icon, tags, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
	`

	tagsJSON, _ := json.Marshal(template.Tags)

	_, err := s.db.Exec(query,
		template.ID,
		template.UserID,
		template.Name,
		template.Description,
		template.Content,
		template.Category,
		template.Variables,
		template.IsBuiltIn,
		template.UsageCount,
		template.IsPublic,
		template.Icon,
		tagsJSON,
		template.CreatedAt,
		template.UpdatedAt,
	)

	return err
}

// GetTemplate retrieves a template by ID
func (s *TemplateService) GetTemplate(templateID uuid.UUID, userID uuid.UUID) (*models.Template, error) {
	query := `
		SELECT id, user_id, name, description, content, category, variables, is_built_in, usage_count, is_public, icon, tags, created_at, updated_at
		FROM templates
		WHERE id = $1 AND (user_id = $2 OR is_public = true OR is_built_in = true)
	`

	var template models.Template
	var tagsJSON string

	err := s.db.QueryRow(query, templateID, userID).Scan(
		&template.ID,
		&template.UserID,
		&template.Name,
		&template.Description,
		&template.Content,
		&template.Category,
		&template.Variables,
		&template.IsBuiltIn,
		&template.UsageCount,
		&template.IsPublic,
		&template.Icon,
		&tagsJSON,
		&template.CreatedAt,
		&template.UpdatedAt,
	)

	if err != nil {
		return nil, err
	}

	json.Unmarshal([]byte(tagsJSON), &template.Tags)

	return &template, nil
}

// GetTemplates retrieves templates for a user
func (s *TemplateService) GetTemplates(userID uuid.UUID, category string, limit, offset int) ([]*models.Template, error) {
	query := `
		SELECT id, user_id, name, description, content, category, variables, is_built_in, usage_count, is_public, icon, tags, created_at, updated_at
		FROM templates
		WHERE (user_id = $1 OR is_public = true OR is_built_in = true)
	`

	args := []interface{}{userID}
	argIndex := 2

	if category != "" {
		query += fmt.Sprintf(" AND category = $%d", argIndex)
		args = append(args, category)
		argIndex++
	}

	query += fmt.Sprintf(" ORDER BY usage_count DESC, created_at DESC LIMIT $%d OFFSET $%d", argIndex, argIndex+1)
	args = append(args, limit, offset)

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var templates []*models.Template
	for rows.Next() {
		var template models.Template
		var tagsJSON string

		err := rows.Scan(
			&template.ID,
			&template.UserID,
			&template.Name,
			&template.Description,
			&template.Content,
			&template.Category,
			&template.Variables,
			&template.IsBuiltIn,
			&template.UsageCount,
			&template.IsPublic,
			&template.Icon,
			&tagsJSON,
			&template.CreatedAt,
			&template.UpdatedAt,
		)

		if err != nil {
			return nil, err
		}

		json.Unmarshal([]byte(tagsJSON), &template.Tags)
		templates = append(templates, &template)
	}

	return templates, nil
}

// GetBuiltInTemplates retrieves all built-in templates
func (s *TemplateService) GetBuiltInTemplates() ([]*models.Template, error) {
	query := `
		SELECT id, user_id, name, description, content, category, variables, is_built_in, usage_count, is_public, icon, tags, created_at, updated_at
		FROM templates
		WHERE is_built_in = true
		ORDER BY category, name
	`

	rows, err := s.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var templates []*models.Template
	for rows.Next() {
		var template models.Template
		var tagsJSON string

		err := rows.Scan(
			&template.ID,
			&template.UserID,
			&template.Name,
			&template.Description,
			&template.Content,
			&template.Category,
			&template.Variables,
			&template.IsBuiltIn,
			&template.UsageCount,
			&template.IsPublic,
			&template.Icon,
			&tagsJSON,
			&template.CreatedAt,
			&template.UpdatedAt,
		)

		if err != nil {
			return nil, err
		}

		json.Unmarshal([]byte(tagsJSON), &template.Tags)
		templates = append(templates, &template)
	}

	return templates, nil
}

// UpdateTemplate updates an existing template
func (s *TemplateService) UpdateTemplate(template *models.Template) error {
	query := `
		UPDATE templates
		SET name = $2, description = $3, content = $4, category = $5, variables = $6, is_public = $7, icon = $8, tags = $9, updated_at = $10
		WHERE id = $1 AND user_id = $11
	`

	tagsJSON, _ := json.Marshal(template.Tags)

	_, err := s.db.Exec(query,
		template.ID,
		template.Name,
		template.Description,
		template.Content,
		template.Category,
		template.Variables,
		template.IsPublic,
		template.Icon,
		tagsJSON,
		template.UpdatedAt,
		template.UserID,
	)

	return err
}

// DeleteTemplate deletes a template
func (s *TemplateService) DeleteTemplate(templateID uuid.UUID, userID uuid.UUID) error {
	query := `DELETE FROM templates WHERE id = $1 AND user_id = $2 AND is_built_in = false`
	_, err := s.db.Exec(query, templateID, userID)
	return err
}

// ProcessTemplate processes a template with variables
func (s *TemplateService) ProcessTemplate(templateID uuid.UUID, userID uuid.UUID, variables map[string]string) (*TemplateProcessingResult, error) {
	template, err := s.GetTemplate(templateID, userID)
	if err != nil {
		return nil, err
	}

	// Increment usage count
	s.incrementUsageCount(templateID)

	// Get built-in variables
	builtInVars := s.getBuiltInVariables()

	// Merge user variables with built-in variables
	allVars := make(map[string]string)
	for k, v := range builtInVars {
		allVars[k] = v
	}
	for k, v := range variables {
		allVars[k] = v
	}

	// Process the template content
	content := s.processTemplateContent(template.Content, allVars)

	// Find unfilled variables
	unfilled := s.findUnfilledVariables(content)

	// Extract metadata
	metadata := s.extractMetadataFromContent(content)

	// Record template usage
	s.recordTemplateUsage(templateID, userID, variables)

	result := &TemplateProcessingResult{
		Content:  content,
		Variables: allVars,
		Unfilled: unfilled,
		Metadata: metadata,
		UsedAt:   time.Now(),
	}

	return result, nil
}

// processTemplateContent processes template content by replacing variables
func (s *TemplateService) processTemplateContent(content string, variables map[string]string) string {
	// Replace {{variable}} patterns
	variablePattern := regexp.MustCompile(`\{\{([^}]+)\}\}`)

	result := variablePattern.ReplaceAllStringFunc(content, func(match string) string {
		varName := strings.TrimSpace(match[2 : len(match)-2])
		if value, exists := variables[varName]; exists {
			return value
		}
		return match // Keep original if variable not found
	})

	return result
}

// findUnfilledVariables finds variables that weren't filled
func (s *TemplateService) findUnfilledVariables(content string) []string {
	variablePattern := regexp.MustCompile(`\{\{([^}]+)\}\}`)
	matches := variablePattern.FindAllStringSubmatch(content, -1)

	var unfilled []string
	seen := make(map[string]bool)

	for _, match := range matches {
		varName := strings.TrimSpace(match[1])
		if !seen[varName] {
			unfilled = append(unfilled, varName)
			seen[varName] = true
		}
	}

	return unfilled
}

// getBuiltInVariables generates values for built-in variables
func (s *TemplateService) getBuiltInVariables() map[string]string {
	now := time.Now()
	vars := make(map[string]string)

	// Date variables
	vars["date"] = now.Format("2006-01-02")
	vars["time"] = now.Format("15:04:05")
	vars["timestamp"] = now.Format(time.RFC3339)
	vars["datetime"] = now.Format("2006-01-02 15:04:05")
	vars["today"] = vars["date"]
	vars["tomorrow"] = now.AddDate(0, 0, 1).Format("2006-01-02")
	vars["yesterday"] = now.AddDate(0, 0, -1).Format("2006-01-02")

	// Week calculations
	weekday := int(now.Weekday())
	if weekday == 0 { // Sunday
		weekday = 7
	}
	weekStart := now.AddDate(0, 0, -weekday+1)
	weekEnd := weekStart.AddDate(0, 0, 6)
	vars["week_start"] = weekStart.Format("2006-01-02")
	vars["week_end"] = weekEnd.Format("2006-01-02")

	// Month calculations
	monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	monthEnd := monthStart.AddDate(0, 1, -1)
	vars["month_start"] = monthStart.Format("2006-01-02")
	vars["month_end"] = monthEnd.Format("2006-01-02")

	// Year and month
	vars["year"] = strconv.Itoa(now.Year())
	vars["month"] = now.Month().String()
	vars["day_of_week"] = now.Weekday().String()

	// UUID
	vars["uuid"] = uuid.New().String()

	// Random number
	vars["random_number"] = strconv.Itoa(1 + now.Nanosecond()%1000)

	return vars
}

// extractMetadataFromContent extracts metadata from processed content
func (s *TemplateService) extractMetadataFromContent(content string) map[string]string {
	metadata := make(map[string]string)

	// Extract title from first H1
	titlePattern := regexp.MustCompile(`^#\s+(.+)$`)
	lines := strings.Split(content, "\n")
	for _, line := range lines {
		if matches := titlePattern.FindStringSubmatch(line); matches != nil {
			metadata["title"] = strings.TrimSpace(matches[1])
			break
		}
	}

	// Extract word count
	wordCount := len(strings.Fields(content))
	metadata["word_count"] = strconv.Itoa(wordCount)

	// Extract hashtags
	hashtagPattern := regexp.MustCompile(`#([a-zA-Z0-9_]+)`)
	hashtags := hashtagPattern.FindAllString(content, -1)
	metadata["hashtags"] = strings.Join(hashtags, ", ")

	return metadata
}

// incrementUsageCount increments the usage count of a template
func (s *TemplateService) incrementUsageCount(templateID uuid.UUID) error {
	query := `UPDATE templates SET usage_count = usage_count + 1 WHERE id = $1`
	_, err := s.db.Exec(query, templateID)
	return err
}

// recordTemplateUsage records template usage for analytics
func (s *TemplateService) recordTemplateUsage(templateID uuid.UUID, userID uuid.UUID, variables map[string]string) error {
	query := `
		INSERT INTO template_usages (id, template_id, user_id, variables, used_at)
		VALUES ($1, $2, $3, $4, $5)
	`

	variablesJSON, _ := json.Marshal(variables)

	_, err := s.db.Exec(query,
		uuid.New(),
		templateID,
		userID,
		variablesJSON,
		time.Now(),
	)

	return err
}

// GetTemplateUsageStats retrieves usage statistics for templates
func (s *TemplateService) GetTemplateUsageStats(userID uuid.UUID) (map[uuid.UUID]int, error) {
	query := `
		SELECT template_id, COUNT(*) as usage_count
		FROM template_usages
		WHERE user_id = $1 AND used_at >= $2
		GROUP BY template_id
	`

	thirtyDaysAgo := time.Now().AddDate(0, 0, -30)

	rows, err := s.db.Query(query, userID, thirtyDaysAgo)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	stats := make(map[uuid.UUID]int)
	for rows.Next() {
		var templateID uuid.UUID
		var count int
		err := rows.Scan(&templateID, &count)
		if err != nil {
			return nil, err
		}
		stats[templateID] = count
	}

	return stats, nil
}

// GetPopularTemplates retrieves popular templates for a user
func (s *TemplateService) GetPopularTemplates(userID uuid.UUID, limit int) ([]*models.Template, error) {
	query := `
		SELECT t.id, t.user_id, t.name, t.description, t.content, t.category, t.variables, t.is_built_in, t.usage_count, t.is_public, t.icon, t.tags, t.created_at, t.updated_at
		FROM templates t
		WHERE (t.user_id = $1 OR t.is_public = true OR t.is_built_in = true)
		ORDER BY t.usage_count DESC, t.updated_at DESC
		LIMIT $2
	`

	rows, err := s.db.Query(query, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var templates []*models.Template
	for rows.Next() {
		var template models.Template
		var tagsJSON string

		err := rows.Scan(
			&template.ID,
			&template.UserID,
			&template.Name,
			&template.Description,
			&template.Content,
			&template.Category,
			&template.Variables,
			&template.IsBuiltIn,
			&template.UsageCount,
			&template.IsPublic,
			&template.Icon,
			&tagsJSON,
			&template.CreatedAt,
			&template.UpdatedAt,
		)

		if err != nil {
			return nil, err
		}

		json.Unmarshal([]byte(tagsJSON), &template.Tags)
		templates = append(templates, &template)
	}

	return templates, nil
}

// SearchTemplates searches templates by name, description, or content
func (s *TemplateService) SearchTemplates(userID uuid.UUID, query string, limit int) ([]*models.Template, error) {
	searchQuery := "%" + query + "%"
	sqlQuery := `
		SELECT id, user_id, name, description, content, category, variables, is_built_in, usage_count, is_public, icon, tags, created_at, updated_at
		FROM templates
		WHERE (user_id = $1 OR is_public = true OR is_built_in = true)
		AND (name ILIKE $2 OR description ILIKE $2 OR content ILIKE $2)
		ORDER BY usage_count DESC, name ASC
		LIMIT $3
	`

	rows, err := s.db.Query(sqlQuery, userID, searchQuery, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var templates []*models.Template
	for rows.Next() {
		var template models.Template
		var tagsJSON string

		err := rows.Scan(
			&template.ID,
			&template.UserID,
			&template.Name,
			&template.Description,
			&template.Content,
			&template.Category,
			&template.Variables,
			&template.IsBuiltIn,
			&template.UsageCount,
			&template.IsPublic,
			&template.Icon,
			&tagsJSON,
			&template.CreatedAt,
			&template.UpdatedAt,
		)

		if err != nil {
			return nil, err
		}

		json.Unmarshal([]byte(tagsJSON), &template.Tags)
		templates = append(templates, &template)
	}

	return templates, nil
}

// ValidateTemplate validates template content
func (s *TemplateService) ValidateTemplate(template *models.Template) error {
	// Check required fields
	if template.Name == "" {
		return fmt.Errorf("template name is required")
	}
	if template.Content == "" {
		return fmt.Errorf("template content is required")
	}

	// Check content length
	if len(template.Content) > 50000 {
		return fmt.Errorf("template content too long (max 50,000 characters)")
	}

	// Validate template syntax
	variablePattern := regexp.MustCompile(`\{\{([^}]+)\}\}`)
	matches := variablePattern.FindAllStringSubmatch(template.Content, -1)

	for _, match := range matches {
		varName := strings.TrimSpace(match[1])
		if varName == "" {
			return fmt.Errorf("invalid variable syntax in template")
		}
	}

	return nil
}