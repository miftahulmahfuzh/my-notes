package llm

import (
	"github.com/pkoukk/tiktoken-go"
)

// Tiktoken is the tokenizer interface
type Tiktoken struct {
	encoding *tiktoken.Tiktoken
}

// NewTokenizer creates a new tokenizer using cl100k_base encoding
func NewTokenizer() (*Tiktoken, error) {
	encoding, err := tiktoken.GetEncoding("cl100k_base")
	if err != nil {
		return nil, err
	}
	return &Tiktoken{encoding: encoding}, nil
}

// CountTokens returns the number of tokens in the given text
func (t *Tiktoken) CountTokens(text string) int {
	if text == "" {
		return 0
	}
	tokens := t.encoding.Encode(text, nil, nil)
	return len(tokens)
}
