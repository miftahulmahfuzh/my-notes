package llm

import (
	"testing"
)

func TestNewTokenizer(t *testing.T) {
	tokenizer, err := NewTokenizer()
	if err != nil {
		t.Fatalf("NewTokenizer failed: %v", err)
	}
	if tokenizer == nil {
		t.Error("Expected non-nil tokenizer")
	}
}

func TestCountTokens(t *testing.T) {
	tokenizer, err := NewTokenizer()
	if err != nil {
		t.Fatalf("NewTokenizer failed: %v", err)
	}

	tests := []struct {
		name     string
		text     string
		expected int
	}{
		{"empty", "", 0},
		{"simple", "Hello world", 2},
		{"longer", "This is a longer text with more tokens.", 8},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			count := tokenizer.CountTokens(tt.text)
			if count < tt.expected {
				t.Errorf("CountTokens(%q) = %d, expected >= %d", tt.text, count, tt.expected)
			}
		})
	}
}
