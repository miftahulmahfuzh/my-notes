package llm

import (
	"github.com/gpd/my-notes/internal/models"
)

// CreateDynamicClusters distributes notes into clusters based on token limits
// Uses round-robin distribution for even load across parallel LLM calls
func CreateDynamicClusters(notes []models.SimplifiedNote, tokenizer *Tiktoken, maxTokens int) [][]models.SimplifiedNote {
	if len(notes) == 0 {
		return [][]models.SimplifiedNote{}
	}

	// Estimate tokens per note (conservative: ~200 tokens per note)
	avgTokensPerNote := 200
	notesPerCluster := maxTokens / avgTokensPerNote
	if notesPerCluster < 1 {
		notesPerCluster = 1
	}

	// Calculate number of clusters needed
	numClusters := (len(notes) + notesPerCluster - 1) / notesPerCluster

	// Create clusters
	clusters := make([][]models.SimplifiedNote, numClusters)
	for i, note := range notes {
		clusterIdx := i % numClusters // Round-robin distribution
		clusters[clusterIdx] = append(clusters[clusterIdx], note)
	}

	return clusters
}
