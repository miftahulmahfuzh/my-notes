# Semantic Search Feature Design

**Date:** 2025-01-28
**Status:** Approved
**Related:** `20250128-164512-A7F3_code_analyzer.md`

---

## Overview

Add LLM-powered semantic search capability to Silence Notes Chrome extension. The feature uses DeepSeek Tencent API to perform semantic understanding and matching of search queries against notes, while preserving the existing fast client-side keyword search as a fallback.

## Architecture

### Hybrid Search Architecture

1. **Client-side keyword search** (existing) - Fast, instant filtering using `includes()` on note title+content
2. **Backend semantic search** (new) - LLM-powered semantic understanding via DeepSeek Tencent API

**Data Flow:**
- User types in search box → Client-side filters notes instantly (keyword mode by default)
- User enables semantic search → Frontend sends API request to backend with `?semantic=true`
- Backend receives all user notes, clusters them by token limits, calls LLM in parallel
- LLM returns relevant note IDs in JSON format
- Backend fetches full note details and returns to frontend
- Frontend displays results with search duration

**Key Design Decisions:**
- Preserve existing fast client-side search for keyword mode
- Add new backend API endpoint parameter `?semantic=true` to existing `GET /api/v1/search/notes`
- Toggle button switches between modes; shortcuts are non-toggle (Ctrl+Shift+F always enables semantic, Ctrl+F always enables keyword)
- Animated border spectrum indicates semantic search is active

---

## Backend Implementation

### Package Structure

```
backend/internal/
├── llm/
│   ├── llm.go           # LLM interface and ResilientLLM implementation
│   ├── tokenizer.go     # Token counting utilities (tiktoken wrapper)
│   └── clusters.go      # Clustering logic for notes
├── services/
│   ├── note_service.go  # Existing - add SemanticSearch method
│   └── semantic_search.go  # New - semantic search orchestration
├── models/
│   └── note.go          # Add SemanticSearchRequest/Response structs
└── config/
    └── config.go        # Add LLM configuration fields
```

### Configuration Updates

**`backend/internal/config/config.go`:**

```go
type LLMType string

const (
    DEEPSEEK_TENCENT LLMType = "DEEPSEEK_TENCENT"
    // ... other types for future expansion
)

type Config struct {
    // ... existing fields

    // LLM Configuration
    LLMType                LLMType `env:"LLM_TYPE" envDefault:"DEEPSEEK_TENCENT"`
    LLMRequestTimeout      int     `env:"LLM_REQUEST_TIMEOUT" envDefault:"30"` // seconds
    DeepseekTencentModel   string  `env:"DEEPSEEK_TENCENT_MODEL" envDefault:"deepseek-v3"`
    DeepseekTencentAPIKey  string  `env:"DEEPSEEK_TENCENT_API_KEY"`
    DeepseekTencentBaseURL string `env:"DEEPSEEK_TENCENT_BASE_URL" envDefault:"https://api.lkeap.tencentcloud.com/v1"`
    MaxSearchLLMTokenLength int    `env:"MAX_SEARCH_LLM_TOKEN_LENGTH" envDefault:"100000"`
}
```

### Data Models

**`backend/internal/models/note.go`:**

```go
// SimplifiedNote represents a note for LLM processing
type SimplifiedNote struct {
    ID      string `json:"id"`
    Content string `json:"content"` // title + " " + content
}

// SemanticSearchRequest extends SearchNotesRequest
type SemanticSearchRequest struct {
    SearchNotesRequest
    Semantic bool `form:"semantic"` // Enable semantic search mode
}

// LLMNoteResponse represents expected LLM JSON response
type LLMNoteResponse struct {
    RelevantItems []struct {
        NoteID string `json:"note_id"`
        Reason string `json:"reason"`
    } `json:"relevant_items"`
}
```

### Core LLM Components

**`internal/llm/llm.go`** - ResilientLLM wrapper with circuit breaker:
```go
type ResilientLLM struct {
    llm     llms.Model
    breaker *gobreaker.CircuitBreaker
}

func NewResilientLLM(ctx context.Context, cfg *Config, cb *gobreaker.CircuitBreaker) (*ResilientLLM, error)
func (r *ResilientLLM) GenerateFromSinglePrompt(ctx context.Context, prompt string) (string, error)
```

**`internal/llm/tokenizer.go`** - Token counting using tiktoken-go

**`internal/llm/clusters.go`** - Dynamic clustering based on token limits:
```go
func CreateDynamicClusters(notes []SimplifiedNote, tokenizer *tiktoken.Tiktoken, maxTokens int) [][]SimplifiedNote
```

### Semantic Search Service

**`internal/services/semantic_search.go`:**

```go
type SemanticSearchService struct {
    llm       *ResilientLLM
    tokenizer *tiktoken.Tiktoken
    noteRepo  NoteRepository
    maxTokens int
}

func (s *SemanticSearchService) Search(ctx context.Context, userID, query string) ([]Note, float64, error) {
    // 1. Fetch all user notes
    // 2. Convert to SimplifiedNote format
    // 3. Create dynamic clusters based on token limits
    // 4. Process clusters in parallel with LLM
    // 5. Aggregate unique note IDs
    // 6. Fetch full note details
    // 7. Return notes + duration
}
```

### Handler Updates

**`internal/handlers/notes.go`:** Modify existing `SearchNotes` handler to accept `?semantic=true` parameter and route to semantic search service when enabled.

---

## Frontend Implementation

### State Management

**`extension/src/popup/index.tsx`:**

```typescript
interface AppState {
  // ... existing fields
  semanticSearchEnabled: boolean;  // New: track semantic search mode
  searchDuration: string | null;   // New: display "Took 4.21s"
  isSemanticSearching: boolean;    // New: loading state for semantic search
}

const [state, setState] = useState<AppState>({
  // ... existing
  semanticSearchEnabled: false,
  searchDuration: null,
  isSemanticSearching: false,
});
```

### Search Bar UI Changes

1. **Replace X button with Brain icon toggle:**
   - Import `Brain` from lucide-react
   - Button toggles between keyword/semantic modes
   - Visual feedback: active state styling

2. **Animated border for semantic mode:**

```css
/* extension/src/popup/popup.css */
@keyframes spectrum-border {
  0% { border-color: #ff0000; }
  20% { border-color: #ffff00; }
  40% { border-color: #00ff00; }
  60% { border-color: #00ffff; }
  80% { border-color: #0000ff; }
  100% { border-color: #ff0000; }
}

.search-bar-container.semantic-mode {
  animation: spectrum-border 2s linear infinite;
  border-width: 2px;
  border-style: solid;
}
```

3. **Duration display:**
   - Shows "Took 4.21s" next to toggle button after semantic search completes
   - Hidden during keyword search

### Keyboard Shortcuts

```typescript
// Around line 712 in popup/index.tsx
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (!(e.ctrlKey || e.metaKey)) return;

    if (e.key === 'f' && state.showNotesList) {
      if (e.shiftKey) {
        // Ctrl+Shift+F - Enable semantic search
        e.preventDefault();
        enableSemanticSearch();
      } else {
        // Ctrl+F - Enable normal search
        e.preventDefault();
        enableKeywordSearch();
      }
      searchInputRef.current?.focus();
    }
    // ... other shortcuts
  };
  // ...
}, [state.showNotesList]);
```

### API Service

**`extension/src/api.ts`:**

```typescript
async semanticSearch(query: string): Promise<ApiResponse<SearchResult>> {
  const response = await fetch(
    `${CONFIG.API_BASE_URL}/api/v1/search/notes?semantic=true&query=${encodeURIComponent(query)}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${await this.getAccessToken()}`,
        'Content-Type': 'application/json',
      },
    }
  );
  // ... handle response
}
```

### Search Flow

- **Keyword mode (existing):** Client-side `useMemo` filters `state.notes` instantly
- **Semantic mode (new):** Debounced API call to backend, show loading state, display results with duration

---

## Search Logic & LLM Integration

### Clustering Strategy

Following the reference implementation pattern:

```go
func CreateDynamicClusters(notes []SimplifiedNote, tokenizer *tiktoken.Tiktoken, maxTokens int) [][]SimplifiedNote {
    avgTokensPerNote := 200 // Conservative estimate
    notesPerCluster := maxTokens / avgTokensPerNote
    if notesPerCluster < 1 {
        notesPerCluster = 1
    }

    numClusters := (len(notes) + notesPerCluster - 1) / notesPerCluster

    clusters := make([][]SimplifiedNote, numClusters)
    for i, note := range notes {
        clusterIdx := i % numClusters  // Round-robin distribution
        clusters[clusterIdx] = append(clusters[clusterIdx], note)
    }

    return clusters
}
```

### LLM Prompt Construction

```go
func CreateSemanticSearchPrompt(cluster []SimplifiedNote, query string) string {
    prompt := fmt.Sprintf(`Given the following notes, identify which ones are most relevant to the search query: "%s"

Available Notes:
`, query)

    for _, note := range cluster {
        content := note.Content
        if len(content) > 500 {
            content = content[:500] + "..."
        }
        prompt += fmt.Sprintf("ID: %s\nContent: %s\n\n", note.ID, content)
    }

    prompt += `Return a JSON response with this structure:
{
    "relevant_items": [
        {"note_id": "uuid-1", "reason": "brief explanation"},
        {"note_id": "uuid-2", "reason": "brief explanation"}
    ]
}

IMPORTANT:
- Only include notes that are truly relevant to the search query
- Return empty relevant_items array if none are relevant
- Match note IDs exactly as provided above`

    return prompt
}
```

### Parallel Processing

```go
func ProcessClustersInParallel(ctx context.Context, clusters [][]SimplifiedNote, query string, llm *ResilientLLM) []LLMNoteResponse {
    resultChan := make(chan LLMNoteResponse, len(clusters))
    var wg sync.WaitGroup

    for i, cluster := range clusters {
        if len(cluster) == 0 {
            continue
        }

        wg.Add(1)
        go func(clusterIdx int, clusterData []SimplifiedNote) {
            defer wg.Done()

            prompt := CreateSemanticSearchPrompt(clusterData, query)
            response, err := CallLLM(ctx, prompt, llm)

            if err != nil {
                // Return empty result on error
                resultChan <- LLMNoteResponse{RelevantItems: []struct{NoteID string; Reason string}{}}
                return
            }

            resultChan <- response
        }(i, cluster)
    }

    // Wait and collect results...
}
```

---

## Error Handling

### Backend: Graceful Degradation

```go
func (s *SemanticSearchService) Search(ctx context.Context, userID, query string) ([]Note, float64, error) {
    // Try semantic search
    notes, duration, err := s.performSemanticSearch(ctx, userID, query)

    if err != nil {
        log.Warn().Err(err).Msg("Semantic search failed, falling back to keyword search")

        // Fallback: use existing keyword search via database
        return s.fallbackKeywordSearch(ctx, userID, query)
    }

    return notes, duration, nil
}
```

### Frontend: User-Friendly Errors

```typescript
const handleSemanticSearch = async (query: string) => {
  try {
    setState(prev => ({ ...prev, isSemanticSearching: true }));
    const response = await apiService.semanticSearch(query);

    if (response.success) {
      setState(prev => ({
        ...prev,
        notes: response.data.notes,
        searchDuration: `Took ${response.data.duration.toFixed(2)}s`,
        isSemanticSearching: false
      }));
    } else {
      // Show error but allow fallback to keyword
      setState(prev => ({
        ...prev,
        error: 'Semantic search unavailable. Try keyword search.',
        semanticSearchEnabled: false,
        isSemanticSearching: false
      }));
    }
  } catch (error) {
    setState(prev => ({
      ...prev,
      error: 'Search failed. Please try again.',
      semanticSearchEnabled: false,
      isSemanticSearching: false
    }));
  }
};
```

---

## Testing Strategy

### Unit Tests

- `llm/tokenizer_test.go` - Token counting accuracy
- `llm/clusters_test.go` - Cluster creation logic
- `services/semantic_search_test.go` - Result aggregation

### Integration Tests

- `tests/integration/semantic_search_test.go` - Full flow with mock LLM
- Test timeout handling, circuit breaker, fallback

### Test Command

**`cmd/test_llm/deepseek/main.go`:**

```go
package main

import (
    "github.com/gpd/my-notes/internal/config"
    "github.com/gpd/my-notes/internal/llm"
)

func main() {
    // Load config
    cfg, _ := config.LoadConfig("")

    // Initialize LLM
    llmClient, _ := llm.NewResilientLLM(ctx, cfg, breaker)

    // Test prompt generation
    // Test semantic search with sample notes
}
```

---

## Go Dependencies

```go
// backend/go.mod
require (
    github.com/pkoukk/tiktoken-go v0.1.6        // Token counting
    github.com/tmc/langchaingo/llms v0.1.0      // LLM interface
    github.com/tmc/langchaingo/llms/openai v0.1.0 // OpenAI-compatible client
    github.com/sony/gobreaker v0.5.0            // Circuit breaker
)
```

---

## Environment Variables

```bash
# backend/.env
LLM_TYPE=DEEPSEEK_TENCENT
DEEPSEEK_TENCENT_API_KEY=sk-hCVhIRs2heP772IO98JRPxgEBQSgBE6YOZdP4ECOQw0cKrVW
DEEPSEEK_TENCENT_BASE_URL=https://api.lkeap.tencentcloud.com/v1
DEEPSEEK_TENCENT_MODEL=deepseek-v3
MAX_SEARCH_LLM_TOKEN_LENGTH=100000
LLM_REQUEST_TIMEOUT=30
```

---

## Implementation Plan

### Phase 1: Backend LLM Integration
1. Add LLM dependencies to go.mod
2. Create `internal/llm/` package (llm.go, tokenizer.go, clusters.go)
3. Update `internal/config/config.go` with LLM configuration
4. Create `cmd/test_llm/deepseek/main.go` test command
5. Run test to verify LLM integration works

### Phase 2: Backend Semantic Search Service
6. Create `internal/services/semantic_search.go`
7. Update `internal/models/note.go` with semantic search structs
8. Update `internal/handlers/notes.go` to handle `?semantic=true`
9. Add unit and integration tests

### Phase 3: Frontend UI Changes
10. Update `extension/src/popup/index.tsx` state and handlers
11. Add Brain icon toggle and duration display
12. Add animated border CSS to `extension/src/popup/popup.css`
13. Update keyboard shortcuts
14. Add semantic search API method to `extension/src/api.ts`

### Phase 4: Integration & Testing
15. Add LLM config to `backend/.env`
16. Test end-to-end flow
17. Update help documentation with new shortcuts

---

## UI/UX Specifications

### Visual Indicators

| State | Search Input Border | Toggle Button | Duration Display |
|-------|---------------------|---------------|------------------|
| Keyword mode | Black (existing) | Brain icon (inactive) | Hidden |
| Semantic mode | Animated spectrum | Brain icon (active) | "Took X.XXs" |
| Semantic loading | Animated spectrum + spinner | Brain icon (disabled) | "Searching..." |

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+F | Enable keyword search, focus input |
| Ctrl+Shift+F | Enable semantic search, focus input |
| Ctrl+N | Navigate to create note |
| Ctrl+B | Navigate back |
| Ctrl+C | Clear search / Copy note content |

---

## Success Criteria

1. ✅ UI/UX changes implemented (toggle button, shortcuts, animated border, duration display)
2. ✅ Backend LLM integration with DeepSeek Tencent
3. ✅ Semantic search returns relevant notes based on query meaning
4. ✅ Token limitation handled via parallel clustering
5. ✅ Graceful fallback to keyword search on LLM failure
6. ✅ Test command `go run cmd/test_llm/deepseek/main.go` works
7. ✅ Search duration displayed after semantic search completes
