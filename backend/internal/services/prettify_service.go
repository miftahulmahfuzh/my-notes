package services

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"regexp"
	"strings"
	"time"

	"github.com/gpd/my-notes/internal/llm"
	"github.com/gpd/my-notes/internal/models"
)

// PrettifyService handles AI-powered note prettification
type PrettifyService struct {
	llm         *llm.ResilientLLM
	noteService NoteServiceInterface
	tagService  TagServiceInterface
	db          *sql.DB
}

// NewPrettifyService creates a new prettify service
func NewPrettifyService(
	llmClient *llm.ResilientLLM,
	noteService NoteServiceInterface,
	tagService TagServiceInterface,
	db *sql.DB,
) *PrettifyService {
	return &PrettifyService{
		llm:         llmClient,
		noteService: noteService,
		tagService:  tagService,
		db:          db,
	}
}

// prettifyLLMResponse represents the expected LLM JSON response
type prettifyLLMResponse struct {
	DetectedLanguage  string   `json:"detected_language"`
	PrettifiedTitle   string   `json:"prettified_title"`
	PrettifiedContent string   `json:"prettified_content"`
	SuggestedTags     []string `json:"suggested_tags"`
	ChangesMade       []string `json:"changes_made"`
}

// PrettifyNote prettifies a note using LLM
func (s *PrettifyService) PrettifyNote(ctx context.Context, userID, noteID string) (*models.PrettifyNoteResponse, error) {
	startTime := time.Now()
	log.Printf("[PrettifyService] Starting PrettifyNote for note: %s, user: %s", noteID, userID)

	// 1. Get the note
	note, err := s.noteService.GetNoteByID(userID, noteID)
	if err != nil {
		log.Printf("[PrettifyService] ERROR: Failed to get note: %v", err)
		return nil, fmt.Errorf("failed to get note: %w", err)
	}
	log.Printf("[PrettifyService] Retrieved note: title='%v', content_length=%d", note.Title, len(note.Content))

	// 2. Validate minimum word count (excluding hashtags)
	contentWithoutTags := s.removeHashtags(note.Content)
	wordCount := s.countWords(contentWithoutTags)
	log.Printf("[PrettifyService] Word count (excluding hashtags): %d", wordCount)
	if wordCount < 5 {
		log.Printf("[PrettifyService] ERROR: Note too short (%d words, minimum 5)", wordCount)
		return nil, fmt.Errorf("note content too short (minimum 5 words excluding hashtags, got %d)", wordCount)
	}

	// 3. Check if already prettified and not manually edited
	if note.AIImproved && note.PrettifiedAt != nil {
		log.Printf("[PrettifyService] Note already prettified at %v, allowing re-prettification", note.PrettifiedAt)
		// Check if the content has changed since prettification
		// For now, we'll allow re-prettification but the UI should handle the restriction
	}

	// 4. Get user's existing tags for context
	tagList, err := s.tagService.GetAllTags(userID, 100, 0)
	if err != nil {
		// Log but don't fail - tag context is optional
		log.Printf("[PrettifyService] WARNING: Failed to get user tags: %v", err)
		tagList = &models.TagList{Tags: []models.TagResponse{}}
	}
	log.Printf("[PrettifyService] User has %d existing tags for context", len(tagList.Tags))

	// 5. Build the LLM prompt with user tags
	prompt := s.buildPrettifyPrompt(note, tagList.Tags)
	log.Printf("[PrettifyService] Built LLM prompt (length: %d chars)", len(prompt))

	// 6. Call LLM
	log.Printf("[PrettifyService] Calling LLM...")
	llmStart := time.Now()
	response, err := s.llm.GenerateFromSinglePrompt(ctx, prompt)
	llmDuration := time.Since(llmStart)
	log.Printf("[PrettifyService] LLM call duration: %v", llmDuration)

	if err != nil {
		log.Printf("[PrettifyService] ERROR: LLM prettification failed")
		log.Printf("[PrettifyService]   Error: %v", err)
		log.Printf("[PrettifyService]   Error type: %T", err)
		log.Printf("[PrettifyService]   Context error: %v", ctx.Err())
		return nil, fmt.Errorf("LLM prettification failed: %w", err)
	}
	log.Printf("[PrettifyService] LLM call successful, response length: %d chars", len(response))

	// 7. Parse LLM response
	var llmResult prettifyLLMResponse
	if err := s.parseLLMResponse(response, &llmResult); err != nil {
		return nil, fmt.Errorf("failed to parse LLM response: %w", err)
	}

	// 8. Handle tags - merge existing with suggested
	existingTags := note.ExtractHashtags()
	allTags := s.mergeTags(existingTags, llmResult.SuggestedTags)

	// NEW: Append tags to prettified content if not already present
	prettifiedContent := llmResult.PrettifiedContent
	if len(allTags) > 0 {
		// Check if tags are already in the content
		contentTags := models.ExtractTagsFromContent(prettifiedContent)
		missingTags := []string{}
		for _, tag := range allTags {
			found := false
			for _, contentTag := range contentTags {
				if strings.EqualFold(tag, contentTag) {
					found = true
					break
				}
			}
			if !found {
				missingTags = append(missingTags, tag)
			}
		}

		// Append missing tags to content
		if len(missingTags) > 0 {
			// Add double newline before tags if content doesn't end with one
			separator := "\n\n"
			prettifiedContent += separator + strings.Join(missingTags, " ")
		}
	}

	// 9. Update the note with prettified content (now including tags)
	now := time.Now()
	updateRequest := &models.UpdateNoteRequest{
		Title:   &llmResult.PrettifiedTitle,
		Content: &prettifiedContent,
		Version: &note.Version,
	}

	updatedNote, err := s.noteService.UpdateNote(userID, noteID, updateRequest)
	if err != nil {
		return nil, fmt.Errorf("failed to update note: %w", err)
	}

	// 10. Set prettify flags directly in database (after UpdateNote which clears them)
	if err := s.setPrettifyFlags(ctx, noteID, now); err != nil {
		return nil, fmt.Errorf("failed to set prettify flags: %w", err)
	}

	// 11. Update tags with suggested ones
	if err := s.tagService.UpdateTagsForNote(noteID, allTags); err != nil {
		// Log error but don't fail - the note content is already updated
		log.Printf("[PrettifyService] WARNING: Failed to update tags: %v", err)
	}

	// 12. Set prettification flags on the returned note
	updatedNote.PrettifiedAt = &now
	updatedNote.AIImproved = true

	// 13. Build response
	noteResponse := updatedNote.ToResponse()
	noteResponse.Tags = allTags

	totalDuration := time.Since(startTime)
	log.Printf("[PrettifyService] SUCCESS: PrettifyNote completed in %v", totalDuration)
	log.Printf("[PrettifyService]   Changes made: %v", llmResult.ChangesMade)
	log.Printf("[PrettifyService]   Suggested tags: %v", llmResult.SuggestedTags)
	log.Printf("[PrettifyService]   Final tags: %v", allTags)

	return &models.PrettifyNoteResponse{
		NoteResponse:  noteResponse,
		SuggestedTags: llmResult.SuggestedTags,
		ChangesMade:   llmResult.ChangesMade,
	}, nil
}

// buildPrettifyPrompt creates the LLM prompt for prettification
func (s *PrettifyService) buildPrettifyPrompt(note *models.Note, userTags []models.TagResponse) string {
	title := ""
	if note.Title != nil {
		title = *note.Title
	}

	// Build user tag list for prompt
	userTagList := ""
	if len(userTags) > 0 {
		tagNames := make([]string, len(userTags))
		for i, tag := range userTags {
			tagNames[i] = tag.Name
		}
		userTagList = strings.Join(tagNames, ", ")
	}

	prompt := fmt.Sprintf(`You are a note editing assistant. Prettify the following note according to these rules:

CURRENT NOTE:
Title: %s
Content: %s

YOUR EXISTING TAGS (prefer these when relevant):
%s

PRETTIFY RULES:
1. Detect the language of the content first
2. Fix all typos using language-specific corrections
3. Remove excess spacing, tabs, dots, commas
4. Detect content type and handle appropriately:
   a) If content contains JSON (with curly braces { } and "key": "value" format):
      - Keep it as valid JSON
      - Fix any broken JSON syntax (missing braces, quotes, commas)
      - Prettify with proper indentation (2 spaces per level)
      - Do NOT convert to bullet lists
   b) If content contains Go struct definitions (type X struct):
      - Keep it as valid Go code
      - Fix any broken struct syntax
      - Prettify with proper indentation (tabs or spaces)
      - Do NOT convert to bullet lists
   c) For regular text content:
      - Remove markdown headers and convert to bullets (use "-" for bullets)
      - Convert markdown tables to simple bullet lists
      - Simplify formatting - use bullet points only
5. Remove all emoticons
6. Preserve URLs exactly as they appear
7. If current title is empty, generate a title based on content (max 50 chars)
8. Suggest 2-3 relevant tags based on content (start with #, e.g., #tag1)
9. When suggesting tags, prefer using tags from "YOUR EXISTING TAGS" list if they are relevant to the content

IMPORTANT:
- Return valid JSON only
- Keep the content meaning but make it cleaner and more readable
- For JSON and Go structs: preserve the format, just fix and indent properly
- For regular text: convert to bullet lists
- Preserve hashtags in content
- Remove markdown table syntax (|, ---, +) entirely from non-code content

Response format (JSON):
{
  "detected_language": "en",
  "prettified_title": "Clean or Generated Title",
  "prettified_content": "Cleaned content with bullets only",
  "suggested_tags": ["#tag1", "#tag2", "#tag3"],
  "changes_made": ["fixed typos", "removed markdown tables", "suggested tags"]
}`, title, note.Content, userTagList)

	return prompt
}

// parseLLMResponse extracts and parses JSON from LLM response
func (s *PrettifyService) parseLLMResponse(response string, result *prettifyLLMResponse) error {
	// Extract JSON from response (LLM may add extra text or markdown code blocks)
	jsonStart := strings.Index(response, "{")
	jsonEnd := strings.LastIndex(response, "}")
	if jsonStart == -1 || jsonEnd == -1 {
		return fmt.Errorf("no valid JSON found in response")
	}
	jsonStr := response[jsonStart : jsonEnd+1]

	// First, unmarshal into a generic map to handle prettified_content being either string or object
	var rawResponse map[string]interface{}
	if err := json.Unmarshal([]byte(jsonStr), &rawResponse); err != nil {
		return fmt.Errorf("failed to unmarshal LLM response: %w", err)
	}

	// Extract fields with type handling
	if v, ok := rawResponse["detected_language"].(string); ok {
		result.DetectedLanguage = v
	}
	if v, ok := rawResponse["prettified_title"].(string); ok {
		result.PrettifiedTitle = v
	}

	// Handle prettified_content - convert object to JSON string if needed
	if v, ok := rawResponse["prettified_content"]; ok {
		switch val := v.(type) {
		case string:
			result.PrettifiedContent = val
		case map[string]interface{}, []interface{}:
			// It's an object or array, convert back to JSON string
			jsonBytes, err := json.Marshal(val)
			if err != nil {
				return fmt.Errorf("failed to convert prettified_content object to string: %w", err)
			}
			result.PrettifiedContent = string(jsonBytes)
		default:
			// Try to convert to string
			result.PrettifiedContent = fmt.Sprintf("%v", val)
		}
	}

	// Handle suggested_tags array
	if v, ok := rawResponse["suggested_tags"].([]interface{}); ok {
		result.SuggestedTags = make([]string, len(v))
		for i, tag := range v {
			if tagStr, ok := tag.(string); ok {
				result.SuggestedTags[i] = tagStr
			}
		}
	}

	// Handle changes_made array
	if v, ok := rawResponse["changes_made"].([]interface{}); ok {
		result.ChangesMade = make([]string, len(v))
		for i, change := range v {
			if changeStr, ok := change.(string); ok {
				result.ChangesMade[i] = changeStr
			}
		}
	}

	return nil
}

// removeHashtags removes hashtags from content
func (s *PrettifyService) removeHashtags(content string) string {
	hashtagRegex := regexp.MustCompile(`#\w+`)
	return hashtagRegex.ReplaceAllString(content, "")
}

// countWords counts words in content
func (s *PrettifyService) countWords(content string) int {
	words := strings.Fields(content)
	return len(words)
}

// mergeTags merges existing tags with suggested tags, removing duplicates
func (s *PrettifyService) mergeTags(existing, suggested []string) []string {
	tagMap := make(map[string]bool)
	for _, tag := range existing {
		tagMap[tag] = true
	}
	for _, tag := range suggested {
		// Ensure tag starts with #
		if !strings.HasPrefix(tag, "#") {
			tag = "#" + tag
		}
		tagMap[tag] = true
	}

	result := make([]string, 0, len(tagMap))
	for tag := range tagMap {
		result = append(result, tag)
	}
	return result
}

// setPrettifyFlags sets the prettification flags on a note
func (s *PrettifyService) setPrettifyFlags(ctx context.Context, noteID string, timestamp time.Time) error {
	query := `
		UPDATE notes
		SET prettified_at = $1, ai_improved = true
		WHERE id = $2
	`
	_, err := s.db.ExecContext(ctx, query, timestamp, noteID)
	return err
}
