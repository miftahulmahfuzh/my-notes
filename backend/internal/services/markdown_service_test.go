package services

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewMarkdownService(t *testing.T) {
	service := NewMarkdownService()
	assert.NotNil(t, service)
}

func TestMarkdownService_ProcessMarkdown(t *testing.T) {
	service := NewMarkdownService()

	tests := []struct {
		name     string
		content  string
		expected struct {
			HTMLContains []string
			TagCount     int
			HasTOC       bool
		}
	}{
		{
			name:    "Basic markdown",
			content: "# Hello World\n\nThis is **bold** text.",
			expected: struct {
				HTMLContains []string
				TagCount     int
				HasTOC       bool
			}{
				HTMLContains: []string{"<h1", "Hello World", "<strong", "bold"},
				TagCount:     0,
				HasTOC:       true,
			},
		},
		{
			name:    "Markdown with hashtags",
			content: "# Note with #work and #important tags",
			expected: struct {
				HTMLContains []string
				TagCount     int
				HasTOC       bool
			}{
				HTMLContains: []string{"<h1", "Note with"},
				TagCount:     2,
				HasTOC:       true,
			},
		},
		{
			name:    "Complex markdown",
			content: `# Document Title

## Section 1

This is a paragraph with **bold** and *italic* text.

### Code Example

\`\`\`javascript
function hello() {
    console.log("Hello, world!");
}
\`\`\`

- [ ] Task 1
- [x] Task 2

> This is a quote

| Column 1 | Column 2 |
|----------|----------|
| Cell 1   | Cell 2   |

#tag1 #tag2`,
			expected: struct {
				HTMLContains []string
				TagCount     int
				HasTOC       bool
			}{
				HTMLContains: []string{"<h1", "Document Title", "<h2", "Section 1", "<strong>", "<em>", "<pre>", "<code>", "<blockquote>", "<table>"},
				TagCount:     2,
				HasTOC:       true,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := service.ProcessMarkdown(tt.content)
			require.NoError(t, err)
			assert.NotNil(t, result)

			// Check HTML content
			for _, expected := range tt.expected.HTMLContains {
				assert.Contains(t, result.HTML, expected)
			}

			// Check tags
			assert.Equal(t, tt.expected.TagCount, len(result.Tags))

			// Check TOC
			if tt.expected.HasTOC {
				assert.Greater(t, len(result.TOC), 0)
			}
		})
	}
}

func TestMarkdownService_PreviewMarkdown(t *testing.T) {
	service := NewMarkdownService()
	content := "# Test\n\nThis is **test** content."

	html, err := service.PreviewMarkdown(content)
	require.NoError(t, err)
	assert.Contains(t, html, "<h1")
	assert.Contains(t, html, "Test")
	assert.Contains(t, html, "<strong>")
	assert.Contains(t, html, "test")
}

func TestMarkdownService_ValidateMarkdown(t *testing.T) {
	service := NewMarkdownService()

	tests := []struct {
		name    string
		content string
		wantErr bool
	}{
		{
			name:    "Valid content",
			content: "# Valid\n\nThis is valid content.",
			wantErr: false,
		},
		{
			name:    "Content too large",
			content: string(make([]byte, 1000001)), // 1MB + 1
			wantErr: true,
		},
		{
			name:    "Script tag",
			content: "<script>alert('xss')</script>",
			wantErr: true,
		},
		{
			name:    "JavaScript URL",
			content: "[link](javascript:alert('xss'))",
			wantErr: true,
		},
		{
			name:    "Event handler",
			content: "<div onclick=\"alert('xss')\">Click me</div>",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := service.ValidateMarkdown(tt.content)
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestMarkdownService_ExtractMetadata(t *testing.T) {
	service := NewMarkdownService()

	tests := []struct {
		name     string
		content  string
		expected string
	}{
		{
			name:     "Title from H1",
			content:  "# My Document Title\n\nContent here...",
			expected: "My Document Title",
		},
		{
			name:     "Title from first line",
			content:  "Document Title\n\nContent here...",
			expected: "Document Title",
		},
		{
			name:     "No title found",
			content:  "\n\nContent here...",
			expected: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := service.ProcessMarkdown(tt.content)
			require.NoError(t, err)
			assert.Equal(t, tt.expected, result.Metadata["title"])
		})
	}
}

func TestMarkdownService_ExtractTags(t *testing.T) {
	service := NewMarkdownService()

	content := "# Document with #work, #important, and #development tags"
	result, err := service.ProcessMarkdown(content)
	require.NoError(t, err)

	expectedTags := []string{"#work", "#important", "#development"}
	assert.Equal(t, len(expectedTags), len(result.Tags))

	for _, tag := range expectedTags {
		assert.Contains(t, result.Tags, tag)
	}
}

func TestMarkdownService_ExtractTOC(t *testing.T) {
	service := NewMarkdownService()

	content := `# Main Title

## Section 1

Content here...

### Subsection 1.1

More content...

## Section 2

Final content...`

	result, err := service.ProcessMarkdown(content)
	require.NoError(t, err)

	assert.Greater(t, len(result.TOC), 0)

	// Check main title
	foundMain := false
	for _, item := range result.TOC {
		if item.Level == 1 && item.Title == "Main Title" {
			foundMain = true
			break
		}
	}
	assert.True(t, foundMain)

	// Check sections
	var sections []TOCItem
	for _, item := range result.TOC {
		if item.Level == 2 {
			sections = append(sections, item)
		}
	}
	assert.Equal(t, 2, len(sections))
	assert.Equal(t, "Section 1", sections[0].Title)
	assert.Equal(t, "Section 2", sections[1].Title)
}

func TestMarkdownService_GenerateAnchor(t *testing.T) {
	service := NewMarkdownService()

	tests := []struct {
		input    string
		expected string
	}{
		{"Hello World", "hello-world"},
		{"Hello, World!", "hello-world"},
		{"Multiple   Spaces", "multiple-spaces"},
		{"Special @#$% Characters", "special-characters"},
		{"---Already---Formatted---", "already-formatted"},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			result := service.generateAnchor(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestMarkdownService_MarkdownHelp(t *testing.T) {
	service := NewMarkdownService()
	help := service.MarkdownHelp()

	// Check that help contains expected sections
	assert.Contains(t, help, "basic_syntax")
	assert.Contains(t, help, "lists")
	assert.Contains(t, help, "links")
	assert.Contains(t, help, "tables")
	assert.Contains(t, help, "extensions")

	// Check basic syntax
	basic := help["basic_syntax"].(map[string]string)
	assert.Equal(t, "# Heading 1", basic["heading"])
	assert.Equal(t, "**bold text**", basic["bold"])
	assert.Equal(t, "*italic text*", basic["italic"])
}

func TestMarkdownService_SanitizeHTML(t *testing.T) {
	service := NewMarkdownService()

	// Test dangerous HTML is sanitized
	dangerousContent := `<script>alert('xss')</script><div onclick="alert('xss')">Click</div>`
	result, err := service.ProcessMarkdown(dangerousContent)
	require.NoError(t, err)
	assert.NotContains(t, result.HTML, "<script>")
	assert.NotContains(t, result.HTML, "onclick")

	// Test safe HTML is preserved
	safeContent := "## Safe Header\n\nThis is **safe** content."
	result, err = service.ProcessMarkdown(safeContent)
	require.NoError(t, err)
	assert.Contains(t, result.HTML, "<h2")
	assert.Contains(t, result.HTML, "Safe Header")
	assert.Contains(t, result.HTML, "<strong>")
	assert.Contains(t, result.HTML, "safe")
}

func TestMarkdownService_TaskLists(t *testing.T) {
	service := NewMarkdownService()

	content := `- [ ] Incomplete task
- [x] Completed task
- [ ] Another incomplete task`

	result, err := service.ProcessMarkdown(content)
	require.NoError(t, err)
	assert.Contains(t, result.HTML, "<ul")
	assert.Contains(t, result.HTML, "checkbox") // Check if checkbox is present
}

func TestMarkdownService_CodeBlocks(t *testing.T) {
	service := NewMarkdownService()

	content := `Here's some code:

\`\`\`javascript
function test() {
    return "Hello, World!";
}
\`\`\`

Inline code: \`console.log("test")\``

	result, err := service.ProcessMarkdown(content)
	require.NoError(t, err)
	assert.Contains(t, result.HTML, "<pre")
	assert.Contains(t, result.HTML, "<code")
	assert.Contains(t, result.HTML, "function test")
	assert.Contains(t, result.HTML, "console.log")
}

func TestMarkdownService_Tables(t *testing.T) {
	service := NewMarkdownService()

	content := `| Name  | Age  |
|-------|------|
| John  | 25   |
| Alice | 30   |`

	result, err := service.ProcessMarkdown(content)
	require.NoError(t, err)
	assert.Contains(t, result.HTML, "<table")
	assert.Contains(t, result.HTML, "<thead")
	assert.Contains(t, result.HTML, "<tbody")
	assert.Contains(t, result.HTML, "John")
	assert.Contains(t, result.HTML, "Alice")
}