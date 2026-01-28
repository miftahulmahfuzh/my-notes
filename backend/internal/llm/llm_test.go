package llm

import (
	"context"
	"testing"

	"github.com/gpd/my-notes/internal/config"
)

func TestNewResilientLLM(t *testing.T) {
	cfg := &config.Config{
		LLM: config.LLMConfig{
			Type:                   "DEEPSEEK_TENCENT",
			DeepseekTencentAPIKey:  "test-key",
			DeepseekTencentBaseURL: "https://api.lkeap.tencentcloud.com/v1",
			DeepseekTencentModel:   "deepseek-v3",
			RequestTimeout:         30,
		},
	}

	llm, err := NewResilientLLM(context.Background(), cfg, nil)
	if err != nil {
		t.Fatalf("NewResilientLLM failed: %v", err)
	}
	if llm == nil {
		t.Error("Expected non-nil LLM")
	}
}
