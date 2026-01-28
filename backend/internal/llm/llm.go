package llm

import (
	"context"
	"fmt"
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
	result, err := r.breaker.Execute(func() (interface{}, error) {
		return llms.GenerateFromSinglePrompt(ctx, r.llm, prompt)
	})
	if err != nil {
		return "", err
	}
	return result.(string), nil
}
