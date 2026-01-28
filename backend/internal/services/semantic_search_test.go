package services

import (
	"context"
	"testing"
)

func TestSemanticSearchService_Search(t *testing.T) {
	// This is a unit test for the search orchestration
	// Full integration tests would use a mock LLM

	service := &SemanticSearchService{}

	// Test with empty query
	ctx := context.Background()
	_, _, err := service.Search(ctx, "user-id", "")
	if err == nil {
		t.Error("Expected error for empty query")
	}
}
