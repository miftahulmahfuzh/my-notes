package services

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
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
	// 1. Get the note
	note, err := s.noteService.GetNoteByID(userID, noteID)
	if err != nil {
		return nil, fmt.Errorf("failed to get note: %w", err)
	}

	// 2. Validate minimum word count (excluding hashtags)
	contentWithoutTags := s.removeHashtags(note.Content)
	wordCount := s.countWords(contentWithoutTags)
	if wordCount < 5 {
		return nil, fmt.Errorf("note content too short (minimum 5 words excluding hashtags, got %d)", wordCount)
	}

	// 3. Check if already prettified and not manually edited
	if note.AIImproved && note.PrettifiedAt != nil {
		// Check if the content has changed since prettification
		// For now, we'll allow re-prettification but the UI should handle the restriction
	}

	// 4. Get user's existing tags for context
	tagList, err := s.tagService.GetAllTags(userID, 100, 0)
	if err != nil {
		// Log but don't fail - tag context is optional
		fmt.Printf("Warning: failed to get user tags: %v\n", err)
		tagList = &models.TagList{Tags: []models.TagResponse{}}
	}

	// 5. Build the LLM prompt with user tags
	prompt := s.buildPrettifyPrompt(note, tagList.Tags)

	// 6. Call LLM
	response, err := s.llm.GenerateFromSinglePrompt(ctx, prompt)
	if err != nil {
		return nil, fmt.Errorf("LLM prettification failed: %w", err)
	}

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
		fmt.Printf("Warning: failed to update tags: %v\n", err)
	}

	// 12. Set prettification flags on the returned note
	updatedNote.PrettifiedAt = &now
	updatedNote.AIImproved = true

	// 13. Build response
	noteResponse := updatedNote.ToResponse()
	noteResponse.Tags = allTags

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
4. Prettify JSON (fix broken parentheses/formatting)
5. Fix indentation if deemed broken
6. Remove all emoticons
7. Convert markdown tables to simple bullet lists
8. Remove markdown headers and convert to bullets (use "-" for bullets)
9. Simplify formatting - use bullet points only, no complex markdown
10. If current title is empty, generate a title based on content (max 50 chars)
11. Suggest 2-3 relevant tags based on content (start with #, e.g., #tag1)
12. When suggesting tags, prefer using tags from "YOUR EXISTING TAGS" list if they are relevant to the content

IMPORTANT:
- Return valid JSON only
- Keep the content meaning but make it cleaner and more readable
- Convert table structures to simple bullet lists
- Remove markdown table syntax (|, ---, +) entirely
- For empty titles, create a descriptive title from the content

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
	// Extract JSON from response (LLM may add extra text)
	jsonStart := strings.Index(response, "{")
	jsonEnd := strings.LastIndex(response, "}")
	if jsonStart == -1 || jsonEnd == -1 {
		return fmt.Errorf("no valid JSON found in response")
	}
	jsonStr := response[jsonStart : jsonEnd+1]

	return json.Unmarshal([]byte(jsonStr), result)
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
