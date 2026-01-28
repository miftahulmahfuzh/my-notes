package config

import (
	"os"
	"testing"
)

func TestLLMConfigDefaults(t *testing.T) {
	os.Unsetenv("LLM_TYPE")
	os.Unsetenv("LLM_DEEPSEEK_TENCENT_API_KEY")
	os.Unsetenv("LLM_DEEPSEEK_TENCENT_BASE_URL")
	os.Unsetenv("LLM_DEEPSEEK_TENCENT_MODEL")
	os.Unsetenv("LLM_MAX_SEARCH_TOKEN_LENGTH")
	os.Unsetenv("LLM_REQUEST_TIMEOUT")

	cfg, err := LoadConfig("")
	if err != nil {
		t.Fatalf("LoadConfig failed: %v", err)
	}

	// Check defaults are set
	if cfg.LLM.Type == "" {
		t.Error("LLM.Type should have default value")
	}
	if cfg.LLM.MaxSearchTokenLength == 0 {
		t.Error("LLM.MaxSearchTokenLength should have default value")
	}
	if cfg.LLM.RequestTimeout == 0 {
		t.Error("LLM.RequestTimeout should have default value")
	}
}

func TestLLMConfigFromEnv(t *testing.T) {
	os.Setenv("LLM_TYPE", "DEEPSEEK_TENCENT")
	os.Setenv("LLM_DEEPSEEK_TENCENT_API_KEY", "test-key")
	os.Setenv("LLM_DEEPSEEK_TENCENT_BASE_URL", "https://test.example.com")
	os.Setenv("LLM_DEEPSEEK_TENCENT_MODEL", "test-model")
	os.Setenv("LLM_MAX_SEARCH_TOKEN_LENGTH", "50000")
	os.Setenv("LLM_REQUEST_TIMEOUT", "60")

	cfg, err := LoadConfig("")
	if err != nil {
		t.Fatalf("LoadConfig failed: %v", err)
	}

	if cfg.LLM.Type != "DEEPSEEK_TENCENT" {
		t.Errorf("Expected LLM.Type DEEPSEEK_TENCENT, got %s", cfg.LLM.Type)
	}
	if cfg.LLM.MaxSearchTokenLength != 50000 {
		t.Errorf("Expected LLM.MaxSearchTokenLength 50000, got %d", cfg.LLM.MaxSearchTokenLength)
	}
	if cfg.LLM.RequestTimeout != 60 {
		t.Errorf("Expected LLM.RequestTimeout 60, got %d", cfg.LLM.RequestTimeout)
	}
	if cfg.LLM.DeepseekTencentAPIKey != "test-key" {
		t.Errorf("Expected LLM.DeepseekTencentAPIKey test-key, got %s", cfg.LLM.DeepseekTencentAPIKey)
	}
	if cfg.LLM.DeepseekTencentBaseURL != "https://test.example.com" {
		t.Errorf("Expected LLM.DeepseekTencentBaseURL https://test.example.com, got %s", cfg.LLM.DeepseekTencentBaseURL)
	}
	if cfg.LLM.DeepseekTencentModel != "test-model" {
		t.Errorf("Expected LLM.DeepseekTencentModel test-model, got %s", cfg.LLM.DeepseekTencentModel)
	}
}
