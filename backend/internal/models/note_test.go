package models

import (
	"encoding/json"
	"testing"
)

func TestLLMNoteResponse(t *testing.T) {
	jsonData := `{
		"relevant_items": [
			{"note_id": "uuid-1", "reason": "Contains relevant info"},
			{"note_id": "uuid-2", "reason": "Matches search intent"}
		]
	}`

	var response LLMNoteResponse
	err := json.Unmarshal([]byte(jsonData), &response)
	if err != nil {
		t.Fatalf("Failed to unmarshal: %v", err)
	}

	if len(response.RelevantItems) != 2 {
		t.Errorf("Expected 2 items, got %d", len(response.RelevantItems))
	}
}

func TestSemanticSearchRequest(t *testing.T) {
	req := SemanticSearchRequest{
		SearchNotesRequest: SearchNotesRequest{
			Query: "test query",
		},
		Semantic: true,
	}

	if !req.Semantic {
		t.Error("Expected Semantic to be true")
	}
	if req.Query != "test query" {
		t.Errorf("Expected query 'test query', got '%s'", req.Query)
	}
}
