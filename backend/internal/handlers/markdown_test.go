package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gpd/my-notes/internal/handlers/mocks"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestMarkdownHandler_PreviewMarkdown(t *testing.T) {
	handler := NewMarkdownHandler()

	tests := []struct {
		name           string
		requestBody    string
		expectedStatus int
		shouldError    bool
		expectedHTML   string
	}{
		{
			name:           "Valid markdown",
			requestBody:    `{"content": "# Test Heading\n\nThis is **bold** text."}`,
			expectedStatus: http.StatusOK,
			shouldError:    false,
			expectedHTML:   "<h1",
		},
		{
			name:           "Empty content",
			requestBody:    `{"content": ""}`,
			expectedStatus: http.StatusBadRequest,
			shouldError:    true,
		},
		{
			name:           "Invalid JSON",
			requestBody:    `{"content": "test",}`,
			expectedStatus: http.StatusBadRequest,
			shouldError:    true,
		},
		{
			name:           "Missing content field",
			requestBody:    `{}`,
			expectedStatus: http.StatusBadRequest,
			shouldError:    true,
		},
		{
			name:           "Content with hashtags",
			requestBody:    `{"content": "# Note with #work and #important tags"}`,
			expectedStatus: http.StatusOK,
			shouldError:    false,
			expectedHTML:   "<h1",
		},
		{
			name:           "Dangerous content",
			requestBody:    `{"content": "<script>alert('xss')</script>"}`,
			expectedStatus: http.StatusBadRequest,
			shouldError:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("POST", "/api/markdown/preview", bytes.NewBufferString(tt.requestBody))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			handler.PreviewMarkdown(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)

			var response map[string]interface{}
			err := json.NewDecoder(w.Body).Decode(&response)
			require.NoError(t, err)

			if tt.shouldError {
				assert.False(t, response["success"].(bool))
				assert.Contains(t, response, "message")
			} else {
				assert.True(t, response["success"].(bool))
				assert.Contains(t, response, "html")

				if tt.expectedHTML != "" {
					html := response["html"].(string)
					assert.Contains(t, html, tt.expectedHTML)
				}
			}
		})
	}
}

func TestMarkdownHandler_GetMarkdownHelp(t *testing.T) {
	handler := NewMarkdownHandler()

	req := httptest.NewRequest("GET", "/api/markdown/help", nil)
	w := httptest.NewRecorder()

	handler.GetMarkdownHelp(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response map[string]interface{}
	err := json.NewDecoder(w.Body).Decode(&response)
	require.NoError(t, err)

	assert.True(t, response["success"].(bool))
	assert.Contains(t, response, "data")

	data := response["data"].(map[string]interface{})
	assert.Contains(t, data, "basic_syntax")
	assert.Contains(t, data, "lists")
	assert.Contains(t, data, "links")
	assert.Contains(t, data, "tables")
	assert.Contains(t, data, "extensions")
}

func TestMarkdownHandler_ValidateMarkdown(t *testing.T) {
	handler := NewMarkdownHandler()

	tests := []struct {
		name           string
		requestBody    string
		expectedStatus int
		expectedValid  bool
	}{
		{
			name:           "Valid content",
			requestBody:    `{"content": "# Valid Content"}`,
			expectedStatus: http.StatusOK,
			expectedValid:  true,
		},
		{
			name:           "Dangerous content",
			requestBody:    `{"content": "<script>alert('xss')</script>"}`,
			expectedStatus: http.StatusOK,
			expectedValid:  false,
		},
		{
			name:           "JavaScript URL",
			requestBody:    `{"content": "[link](javascript:alert('xss'))"}`,
			expectedStatus: http.StatusOK,
			expectedValid:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("POST", "/api/markdown/validate", bytes.NewBufferString(tt.requestBody))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			handler.ValidateMarkdown(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)

			var response map[string]interface{}
			err := json.NewDecoder(w.Body).Decode(&response)
			require.NoError(t, err)

			assert.Equal(t, tt.expectedValid, response["valid"].(bool))
		})
	}
}

func TestMarkdownHandler_ExtractMetadata(t *testing.T) {
	handler := NewMarkdownHandler()

	tests := []struct {
		name           string
		requestBody    string
		expectedStatus int
		expectedTitle  string
	}{
		{
			name:           "Content with H1 title",
			requestBody:    `{"content": "# Document Title\n\nContent here..."}`,
			expectedStatus: http.StatusOK,
			expectedTitle:  "Document Title",
		},
		{
			name:           "Content without title",
			requestBody:    `{"content": "Just some content without a title."}`,
			expectedStatus: http.StatusOK,
			expectedTitle:  "Just some content without a title.",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("POST", "/api/markdown/metadata", bytes.NewBufferString(tt.requestBody))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			handler.ExtractMetadata(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)

			var response map[string]interface{}
			err := json.NewDecoder(w.Body).Decode(&response)
			require.NoError(t, err)

			assert.True(t, response["success"].(bool))
			assert.Contains(t, response, "metadata")

			metadata := response["metadata"].(map[string]interface{})
			if tt.expectedTitle != "" {
				assert.Equal(t, tt.expectedTitle, metadata["title"])
			}
		})
	}
}

func TestMarkdownHandler_ExtractTags(t *testing.T) {
	handler := NewMarkdownHandler()

	tests := []struct {
		name           string
		requestBody    string
		expectedStatus int
		expectedTags   []string
	}{
		{
			name:           "Content with hashtags",
			requestBody:    `{"content": "# Note with #work and #important tags"}`,
			expectedStatus: http.StatusOK,
			expectedTags:   []string{"#work", "#important"},
		},
		{
			name:           "Content without hashtags",
			requestBody:    `{"content": "Just some content without tags."}`,
			expectedStatus: http.StatusOK,
			expectedTags:   []string{},
		},
		{
			name:           "Multiple hashtags",
			requestBody:    `{"content": "# Development #work #urgent #backend #api"}`,
			expectedStatus: http.StatusOK,
			expectedTags:   []string{"#development", "#work", "#urgent", "#backend", "#api"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("POST", "/api/markdown/tags", bytes.NewBufferString(tt.requestBody))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			handler.ExtractTags(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)

			var response map[string]interface{}
			err := json.NewDecoder(w.Body).Decode(&response)
			require.NoError(t, err)

			assert.True(t, response["success"].(bool))
			assert.Contains(t, response, "tags")

			tags := response["tags"].([]interface{})
			assert.Equal(t, len(tt.expectedTags), len(tags))

			// Convert to string slice for comparison
			tagStrings := make([]string, len(tags))
			for i, tag := range tags {
				tagStrings[i] = tag.(string)
			}

			for _, expectedTag := range tt.expectedTags {
				assert.Contains(t, tagStrings, expectedTag)
			}
		})
	}
}

func TestMarkdownHandler_PreviewMarkdown_ComplexContent(t *testing.T) {
	handler := NewMarkdownHandler()

	complexContent := `# Complex Document

## Introduction

This is a complex document with **bold**, *italic*, and ~~strikethrough~~ text.

### Code Example

\`\`\`javascript
function complexFunction() {
    const message = "Hello, World!";
    console.log(message);
    return message;
}
\`\`\`

### Lists

- [ ] Incomplete task
- [x] Completed task
- [ ] Another task

### Blockquote

> This is a blockquote with multiple lines.
> It should be properly formatted.

### Table

| Feature | Status | Priority |
|---------|---------|----------|
| Markdown | ✅ Complete | High |
| Editor   | 🚧 In Progress | High |
| Export   | ⏳ Planned | Medium |

#final #documentation #complete`

	requestBody := map[string]interface{}{
		"content": complexContent,
	}
	bodyBytes, _ := json.Marshal(requestBody)

	req := httptest.NewRequest("POST", "/api/markdown/preview", bytes.NewBuffer(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handler.PreviewMarkdown(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response map[string]interface{}
	err := json.NewDecoder(w.Body).Decode(&response)
	require.NoError(t, err)

	assert.True(t, response["success"].(bool))
	assert.Contains(t, response, "html")
	assert.Contains(t, response, "toc")
	assert.Contains(t, response, "metadata")
	assert.Contains(t, response, "tags")

	html := response["html"].(string)
	assert.Contains(t, html, "<h1")
	assert.Contains(t, html, "<h2")
	assert.Contains(t, html, "<h3")
	assert.Contains(t, html, "<strong>")
	assert.Contains(t, html, "<em>")
	assert.Contains(t, html, "<del>")
	assert.Contains(t, html, "<pre")
	assert.Contains(t, html, "<code")
	assert.Contains(t, html, "<ul")
	assert.Contains(t, html, "<blockquote")
	assert.Contains(t, html, "<table")

	toc := response["toc"].([]interface{})
	assert.Greater(t, len(toc), 0)

	metadata := response["metadata"].(map[string]interface{})
	assert.Equal(t, "Complex Document", metadata["title"])

	tags := response["tags"].([]interface{})
	assert.Equal(t, 3, len(tags)) // #final, #documentation, #complete
}

func TestMarkdownHandler_RegisterMarkdownRoutes(t *testing.T) {
	// Test route registration - this is more of an integration test
	// but ensures the routes are properly set up
	router := mux.NewRouter()

	// Mock auth middleware
	mockAuthMiddleware := func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			next.ServeHTTP(w, r)
		})
	}

	RegisterMarkdownRoutes(router, mockAuthMiddleware)

	// Test that routes are registered by checking the router's routes
	routes := router.Walk()
	routePaths := make(map[string]bool)

	routes.Walk(func(route *mux.Route, router *mux.Router, ancestors []*mux.Route) error {
		path, _ := route.GetPathTemplate()
		methods, _ := route.GetMethods()
		if path != "" && len(methods) > 0 {
			for _, method := range methods {
				routePaths[method+":"+path] = true
			}
		}
		return nil
	})

	// Check that expected routes are registered
	expectedRoutes := []string{
		"POST:/api/markdown/preview",
		"GET:/api/markdown/help",
		"POST:/api/markdown/validate",
		"POST:/api/markdown/metadata",
		"POST:/api/markdown/tags",
	}

	for _, expectedRoute := range expectedRoutes {
		assert.True(t, routePaths[expectedRoute], "Expected route %s not found", expectedRoute)
	}
}

// Mock service tests can be added here if needed for more granular testing
// but since we're testing the handler with the actual service, this provides good coverage