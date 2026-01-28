package main

import (
	"context"
	"fmt"
	"os"

	"github.com/gpd/my-notes/internal/config"
	"github.com/gpd/my-notes/internal/llm"
	"github.com/tmc/langchaingo/llms"
)

const (
	ColorRed    = "\033[31m"
	ColorGreen  = "\033[32m"
	ColorYellow = "\033[33m"
	ColorBlue   = "\033[34m"
	ColorReset  = "\033[0m"
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
	llmClient, err := llm.NewResilientLLM(context.Background(), cfg, nil)
	if err != nil {
		fmt.Printf("Failed to create LLM client: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("✓ LLM client created (type: %s)\n", cfg.LLM.Type)

	fmt.Println("\n✓ All LLM components initialized successfully!")
	fmt.Printf("  - Model: %s\n", cfg.LLM.DeepseekTencentModel)
	fmt.Printf("  - Base URL: %s\n", cfg.LLM.DeepseekTencentBaseURL)
	fmt.Printf("  - Max tokens: %d\n", cfg.LLM.MaxSearchTokenLength)
	fmt.Printf("  - Timeout: %ds\n", cfg.LLM.RequestTimeout)

	// Run actual LLM tests
	ctx := context.Background()

	// Test 1: GenerateContent
	fmt.Printf("\n%s--- Test 1: GenerateContent ---%s\n", ColorBlue, ColorReset)
	messages := []llms.MessageContent{
		llms.TextParts(llms.ChatMessageTypeSystem, "You are a helpful assistant."),
		llms.TextParts(llms.ChatMessageTypeHuman, "What is the capital of Indonesia? Answer in one sentence."),
	}
	response, err := llmClient.GenerateContent(ctx, messages)
	if err != nil {
		fmt.Printf("%s[ERROR]%s GenerateContent failed: %v\n", ColorRed, ColorReset, err)
	} else if len(response.Choices) > 0 {
		fmt.Printf("%s[SUCCESS]%s GenerateContent completed\n", ColorGreen, ColorReset)
		fmt.Printf("  - Response: %s\n", response.Choices[0].Content)
	}

	// Test 2: GenerateFromSinglePrompt
	fmt.Printf("\n%s--- Test 2: GenerateFromSinglePrompt ---%s\n", ColorBlue, ColorReset)
	simplePrompt := "Count from 1 to 5. Just the numbers, separated by commas."
	simpleResponse, err := llmClient.GenerateFromSinglePrompt(ctx, simplePrompt)
	if err != nil {
		fmt.Printf("%s[ERROR]%s GenerateFromSinglePrompt failed: %v\n", ColorRed, ColorReset, err)
	} else {
		fmt.Printf("%s[SUCCESS]%s GenerateFromSinglePrompt completed\n", ColorGreen, ColorReset)
		fmt.Printf("  - Response: %s\n", simpleResponse)
	}

	// Test 3: Stream
	fmt.Printf("\n%s--- Test 3: Stream ---%s\n", ColorBlue, ColorReset)
	streamPrompt := "Say 'Hello, DeepSeek streaming works!' exactly like that."
	fmt.Printf("%s[STREAM OUTPUT]%s ", ColorBlue, ColorReset)
	streamingFunc := func(ctx context.Context, chunk []byte) error {
		fmt.Printf(string(chunk))
		return nil
	}
	err = llmClient.Stream(ctx, streamPrompt, streamingFunc)
	fmt.Printf("\n")
	if err != nil {
		fmt.Printf("%s[ERROR]%s Stream failed: %v\n", ColorRed, ColorReset, err)
	} else {
		fmt.Printf("%s[SUCCESS]%s Stream completed\n", ColorGreen, ColorReset)
	}

	fmt.Printf("\n%s=== All Tests Complete ===%s\n", ColorBlue, ColorReset)
}
