package services

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/gpd/my-notes/internal/llm"
	"github.com/gpd/my-notes/internal/models"
	"github.com/google/uuid"
)

// SemanticSearchService handles LLM-powered semantic search
type SemanticSearchService struct {
	llm       *llm.ResilientLLM
	tokenizer *llm.Tiktoken
	noteService NoteServiceInterface
	maxTokens int
}

// NewSemanticSearchService creates a new semantic search service
func NewSemanticSearchService(
	llmClient *llm.ResilientLLM,
	tokenizer *llm.Tiktoken,
	noteService NoteServiceInterface,
	maxTokens int,
) *SemanticSearchService {
	return &SemanticSearchService{
		llm:       llmClient,
		tokenizer: tokenizer,
		noteService: noteService,
		maxTokens: maxTokens,
	}
}

// Search performs semantic search using LLM
func (s *SemanticSearchService) Search(ctx context.Context, userID, query string) ([]models.Note, float64, error) {
	if query == "" {
		return nil, 0, fmt.Errorf("search query cannot be empty")
	}

	startTime := time.Now()

	// 1. Fetch all user notes (use high limit to get all)
	noteList, err := s.noteService.ListNotes(userID, 10000, 0, "created_at", "desc")
	if err != nil {
		return nil, 0, fmt.Errorf("failed to fetch notes: %w", err)
	}

	if len(noteList.Notes) == 0 {
		return []models.Note{}, 0, nil
	}

	// 2. Convert NoteResponse to Note models for internal processing
	// We need to convert back to Note for the clustering logic
	allNotes := s.convertNotesResponseToNotes(noteList.Notes, userID)

	if len(allNotes) == 0 {
		return []models.Note{}, 0, nil
	}

	// 3. Convert to SimplifiedNote format
	simplifiedNotes := make([]models.SimplifiedNote, len(allNotes))
	for i, note := range allNotes {
		content := note.Content
		if note.Title != nil && *note.Title != "" {
			content = *note.Title + " " + content
		}
		simplifiedNotes[i] = models.SimplifiedNote{
			ID:      note.ID.String(),
			Content: content,
		}
	}

	// 4. Create dynamic clusters based on token limits
	clusters := llm.CreateDynamicClusters(simplifiedNotes, s.tokenizer, s.maxTokens)

	// 5. Process clusters in parallel with LLM
	responses := s.processClustersInParallel(ctx, clusters, query)

	// 6. Aggregate unique note IDs
	noteIDs := s.aggregateRelevantNoteIDs(responses)

	// 7. Fetch full note details
	resultNotes := make([]models.Note, 0, len(noteIDs))
	for _, idStr := range noteIDs {
		noteID, err := uuid.Parse(idStr)
		if err != nil {
			continue
		}
		// Use GetNoteByID to get individual notes
		note, err := s.noteService.GetNoteByID(userID, noteID.String())
		if err == nil && note != nil {
			resultNotes = append(resultNotes, *note)
		}
	}

	duration := time.Since(startTime).Seconds()

	return resultNotes, duration, nil
}

// convertNotesResponseToNotes converts NoteResponse slice to Note slice
func (s *SemanticSearchService) convertNotesResponseToNotes(noteResponses []models.NoteResponse, userID string) []models.Note {
	notes := make([]models.Note, 0, len(noteResponses))
	for _, resp := range noteResponses {
		note := s.convertNoteResponseToNote(&resp, userID)
		notes = append(notes, *note)
	}
	return notes
}

// convertNoteResponseToNote converts NoteResponse to Note
func (s *SemanticSearchService) convertNoteResponseToNote(resp *models.NoteResponse, userID string) *models.Note {
	return &models.Note{
		ID:        resp.ID,
		UserID:    resp.UserID,
		Title:     resp.Title,
		Content:   resp.Content,
		CreatedAt: resp.CreatedAt,
		UpdatedAt: resp.UpdatedAt,
		Version:   resp.Version,
	}
}

// processClustersInParallel processes all clusters concurrently
func (s *SemanticSearchService) processClustersInParallel(ctx context.Context, clusters [][]models.SimplifiedNote, query string) []models.LLMNoteResponse {
	resultChan := make(chan models.LLMNoteResponse, len(clusters))
	var wg sync.WaitGroup

	for _, cluster := range clusters {
		if len(cluster) == 0 {
			continue
		}

		wg.Add(1)
		go func(clusterData []models.SimplifiedNote) {
			defer wg.Done()

			prompt := s.createSemanticSearchPrompt(clusterData, query)
			response, err := s.callLLM(ctx, prompt)

			if err != nil {
				// Return empty result on error
				resultChan <- models.LLMNoteResponse{RelevantItems: []struct {
					NoteID string `json:"note_id"`
					Reason string `json:"reason"`
				}{}}
				return
			}

			resultChan <- response
		}(cluster)
	}

	// Wait for all goroutines and close channel
	go func() {
		wg.Wait()
		close(resultChan)
	}()

	// Collect results
	var responses []models.LLMNoteResponse
	for response := range resultChan {
		responses = append(responses, response)
	}

	return responses
}

// createSemanticSearchPrompt builds the LLM prompt for semantic search
func (s *SemanticSearchService) createSemanticSearchPrompt(cluster []models.SimplifiedNote, query string) string {
	prompt := fmt.Sprintf(`Given the following notes, identify which ones are most relevant to the search query: "%s"

Available Notes:
`, query)

	for _, note := range cluster {
		content := note.Content
		if len(content) > 500 {
			content = content[:500] + "..."
		}
		prompt += fmt.Sprintf("ID: %s\nContent: %s\n\n", note.ID, content)
	}

	prompt += `Return a JSON response with this structure:
{
    "relevant_items": [
        {"note_id": "uuid-1", "reason": "brief explanation"},
        {"note_id": "uuid-2", "reason": "brief explanation"}
    ]
}

IMPORTANT:
- Only include notes that are truly relevant to the search query
- Return empty relevant_items array if none are relevant
- Match note IDs exactly as provided above`

	return prompt
}

// callLLM calls the LLM and parses the response
func (s *SemanticSearchService) callLLM(ctx context.Context, prompt string) (models.LLMNoteResponse, error) {
	response, err := s.llm.GenerateFromSinglePrompt(ctx, prompt)
	if err != nil {
		return models.LLMNoteResponse{}, err
	}

	// Extract JSON from response (LLM may add extra text)
	jsonStart := strings.Index(response, "{")
	jsonEnd := strings.LastIndex(response, "}")
	if jsonStart == -1 || jsonEnd == -1 {
		return models.LLMNoteResponse{}, fmt.Errorf("no valid JSON found in response")
	}
	jsonStr := response[jsonStart : jsonEnd+1]

	var result models.LLMNoteResponse
	err = json.Unmarshal([]byte(jsonStr), &result)
	if err != nil {
		return models.LLMNoteResponse{}, fmt.Errorf("failed to parse LLM response: %w", err)
	}

	return result, nil
}

// aggregateRelevantNoteIDs extracts unique note IDs from LLM responses
func (s *SemanticSearchService) aggregateRelevantNoteIDs(responses []models.LLMNoteResponse) []string {
	seen := make(map[string]bool)
	var ids []string

	for _, response := range responses {
		for _, item := range response.RelevantItems {
			if !seen[item.NoteID] {
				seen[item.NoteID] = true
				ids = append(ids, item.NoteID)
			}
		}
	}

	return ids
}
