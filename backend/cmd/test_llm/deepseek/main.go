package main

import (
	"context"
	"fmt"
	"os"

	"github.com/gpd/my-notes/internal/config"
	"github.com/gpd/my-notes/internal/llm"
)

func main() {
	fmt.Println("DeepSeek LLM Test Command")
	fmt.Println("========================")

	// Load config
	cfg, err := config.LoadConfig("")
	if err != nil {
		fmt.Printf("Failed to load config: %v\n", err)
		os.Exit(1)
	}

	// Create tokenizer
	tokenizer, err := llm.NewTokenizer()
	if err != nil {
		fmt.Printf("Failed to create tokenizer: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("✓ Tokenizer created\n")

	// Count tokens in test prompt
	testPrompt := "Given the following notes, identify which ones are most relevant to the search query."
	tokens := tokenizer.CountTokens(testPrompt)
	fmt.Printf("✓ Test prompt has %d tokens\n", tokens)

	// Create LLM client
	_, err = llm.NewResilientLLM(context.Background(), cfg, nil)
	if err != nil {
		fmt.Printf("Failed to create LLM client: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("✓ LLM client created (type: %s)\n", cfg.LLM.Type)

	// Test prompt generation
	fmt.Println("\n✓ All LLM components initialized successfully!")
	fmt.Printf("  - Model: %s\n", cfg.LLM.DeepseekTencentModel)
	fmt.Printf("  - Base URL: %s\n", cfg.LLM.DeepseekTencentBaseURL)
	fmt.Printf("  - Max tokens: %d\n", cfg.LLM.MaxSearchTokenLength)
	fmt.Printf("  - Timeout: %ds\n", cfg.LLM.RequestTimeout)
}
