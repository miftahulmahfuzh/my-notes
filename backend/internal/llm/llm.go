package llm

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/gpd/my-notes/internal/config"
	"github.com/sony/gobreaker"
	"github.com/tmc/langchaingo/llms"
	"github.com/tmc/langchaingo/llms/openai"
)

// ResilientLLM wraps an LLM with circuit breaker for resilience
type ResilientLLM struct {
	llm     llms.Model
	breaker *gobreaker.CircuitBreaker
}

// NewResilientLLM creates a new resilient LLM client based on configuration
func NewResilientLLM(ctx context.Context, cfg *config.Config, breaker *gobreaker.CircuitBreaker) (*ResilientLLM, error) {
	var llmClient llms.Model
	var err error

	switch cfg.LLM.Type {
	case "DEEPSEEK_TENCENT":
		if cfg.LLM.DeepseekTencentAPIKey == "" {
			return nil, fmt.Errorf("DEEPSEEK_TENCENT_API_KEY is required")
		}
		llmClient, err = openai.New(
			openai.WithToken(cfg.LLM.DeepseekTencentAPIKey),
			openai.WithBaseURL(cfg.LLM.DeepseekTencentBaseURL),
			openai.WithModel(cfg.LLM.DeepseekTencentModel),
		)
		if err != nil {
			return nil, fmt.Errorf("failed to create DeepSeek Tencent client: %w", err)
		}
	default:
		return nil, fmt.Errorf("unsupported LLM type: %s", cfg.LLM.Type)
	}

	// Create circuit breaker if not provided
	if breaker == nil {
		breaker = gobreaker.NewCircuitBreaker(gobreaker.Settings{
			Name:        "llm",
			MaxRequests: 3,
			Interval:    60 * time.Second,
			Timeout:     30 * time.Second,
			ReadyToTrip: func(counts gobreaker.Counts) bool {
				return counts.ConsecutiveFailures > 2
			},
		})
	}

	return &ResilientLLM{
		llm:     llmClient,
		breaker: breaker,
	}, nil
}

// GenerateFromSinglePrompt generates a completion from a single prompt
func (r *ResilientLLM) GenerateFromSinglePrompt(ctx context.Context, prompt string) (string, error) {
	startTime := time.Now()
	promptLen := len(prompt)
	log.Printf("[LLM] Starting GenerateFromSinglePrompt")
	log.Printf("[LLM]   Prompt length: %d chars", promptLen)
	log.Printf("[LLM]   Prompt preview (first 200 chars): %s", truncateString(prompt, 200))

	// Check context deadline
	deadline, hasDeadline := ctx.Deadline()
	if hasDeadline {
		log.Printf("[LLM]   Context has deadline: %v (time until deadline: %v)", deadline.Format(time.RFC3339), time.Until(deadline))
	} else {
		log.Printf("[LLM]   Context has NO deadline")
	}

	// Check context before making the call
	select {
	case <-ctx.Done():
		elapsed := time.Since(startTime)
		log.Printf("[LLM] ERROR: Context cancelled before API call (elapsed: %v)", elapsed)
		log.Printf("[LLM]   Context error: %v", ctx.Err())
		return "", fmt.Errorf("context cancelled before API call: %w", ctx.Err())
	default:
		// Context is valid, proceed
	}

	log.Printf("[LLM] Calling LLM API via circuit breaker...")
	log.Printf("[LLM]   Circuit breaker state: %v", r.breaker.State())

	result, err := r.breaker.Execute(func() (interface{}, error) {
		log.Printf("[LLM]   Inside circuit breaker Execute function")

		// Check context again before calling API
		select {
		case <-ctx.Done():
			log.Printf("[LLM]   ERROR: Context cancelled inside circuit breaker (before API call)")
			log.Printf("[LLM]   Context error: %v", ctx.Err())
			return nil, ctx.Err()
		default:
		}

		log.Printf("[LLM]   Calling llms.GenerateFromSinglePrompt...")
		apiStart := time.Now()

		// Monitor context during the API call
		resultChan := make(chan interface{}, 1)
		errChan := make(chan error, 1)

		go func() {
			result, err := llms.GenerateFromSinglePrompt(ctx, r.llm, prompt)
			resultChan <- result
			errChan <- err
		}()

		// Wait for result or context cancellation
		select {
		case <-ctx.Done():
			apiDuration := time.Since(apiStart)
			log.Printf("[LLM]   ERROR: Context cancelled during API call!")
			log.Printf("[LLM]   API call duration before cancellation: %v", apiDuration)
			log.Printf("[LLM]   Context error: %v", ctx.Err())
			return nil, fmt.Errorf("context cancelled during LLM API call after %v: %w", apiDuration, ctx.Err())
		case result := <-resultChan:
			apiDuration := time.Since(apiStart)
			log.Printf("[LLM]   LLM API call completed in %v", apiDuration)
			return result, <-errChan
		}
	})

	elapsed := time.Since(startTime)
	log.Printf("[LLM] Total GenerateFromSinglePrompt duration: %v", elapsed)

	if err != nil {
		log.Printf("[LLM] ERROR: LLM call failed")
		log.Printf("[LLM]   Error type: %T", err)
		log.Printf("[LLM]   Error message: %v", err)
		log.Printf("[LLM]   Context error after failure: %v", ctx.Err())
		log.Printf("[LLM]   Context deadline exceeded: %v", ctx.Err() == context.DeadlineExceeded)
		log.Printf("[LLM]   Circuit breaker state after failure: %v", r.breaker.State())
		return "", fmt.Errorf("LLM API call failed: %w", err)
	}

	response, ok := result.(string)
	if !ok {
		log.Printf("[LLM] ERROR: Type assertion failed, expected string but got %T", result)
		return "", fmt.Errorf("unexpected response type from LLM: %T", result)
	}

	log.Printf("[LLM] SUCCESS: Got response from LLM")
	log.Printf("[LLM]   Response length: %d chars", len(response))
	log.Printf("[LLM]   Response preview (first 200 chars): %s", truncateString(response, 200))

	return response, nil
}

// truncateString truncates a string to maxLen characters
func truncateString(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "..."
}

// GenerateContent generates a completion from message content
func (r *ResilientLLM) GenerateContent(ctx context.Context, messages []llms.MessageContent) (*llms.ContentResponse, error) {
	result, err := r.breaker.Execute(func() (interface{}, error) {
		return r.llm.GenerateContent(ctx, messages)
	})
	if err != nil {
		return nil, err
	}
	return result.(*llms.ContentResponse), nil
}

// Stream generates a streaming completion from a single prompt
func (r *ResilientLLM) Stream(ctx context.Context, prompt string, streamingFunc func(context.Context, []byte) error) error {
	_, err := r.breaker.Execute(func() (interface{}, error) {
		response, err := llms.GenerateFromSinglePrompt(ctx, r.llm, prompt, llms.WithStreamingFunc(streamingFunc))
		return response, err
	})
	return err
}
