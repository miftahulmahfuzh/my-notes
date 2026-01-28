package llm

import (
	"testing"

	"github.com/gpd/my-notes/internal/models"
)

func TestCreateDynamicClusters(t *testing.T) {
	tokenizer, _ := NewTokenizer()

	notes := []models.SimplifiedNote{
		{ID: "1", Content: "First note"},
		{ID: "2", Content: "Second note"},
		{ID: "3", Content: "Third note"},
	}

	clusters := CreateDynamicClusters(notes, tokenizer, 1000)

	if len(clusters) == 0 {
		t.Error("Expected at least one cluster")
	}

	// All notes should be distributed
	totalNotes := 0
	for _, cluster := range clusters {
		totalNotes += len(cluster)
	}
	if totalNotes != len(notes) {
		t.Errorf("Expected %d notes total, got %d", len(notes), totalNotes)
	}
}
