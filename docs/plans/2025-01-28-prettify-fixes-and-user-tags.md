# Prettify Feature Fixes and User Tag Support

**Date:** 2025-01-28

**Status:** Design Approved

---

## Problem Statement

The prettify feature has three critical issues:

1. **Frontend Redirect Bug**: After clicking prettify, the user is automatically redirected to the notes list page instead of staying on the note detail view.

2. **Tags Being Removed**: The prettify process removes all existing hashtags from the note content. Users expect prettify to preserve existing tags and optionally add new ones (if LLM deems necessary).

3. **Missing User Tag Context**: The LLM has no context about what tags the user has previously used, so it cannot intelligently suggest from the user's existing tag vocabulary.

---

## Design Decisions

### User Choices Made

1. **Tag Behavior**: "Both preserve and append" - Keep tags in database AND append them to the content so user sees them in the note body

2. **Schema Change**: "No change needed" - The current `GetAllTags` query already filters by `user_id` through `note_tags` join. No new table needed.

3. **Test Scope**: "Hashtag preservation only" - Test should verify that hashtags in input are not removed from output.

4. **LLM Approach**: "Re-add after LLM" - Programmatically add tags back to content after LLM processing, rather than relying on prompt instructions.

---

## Solution Design

### Fix 1: Frontend Redirect Bug

**File**: `extension/src/popup/index.tsx`

**Current Behavior**:
```typescript
const handleNoteChange = (updatedNote: Note): void => {
  setState(prev => ({
    ...prev,
    currentNote: { ...updatedNote, tags: updatedNote.tags ?? [] }
  }));
  loadNotes(); // This causes the redirect
};
```

**Solution**: Modify `handleNoteChange` to:
1. Update `currentNote` in state
2. Update the note in the `notes` array (find and replace by ID)
3. NOT call `loadNotes()` which triggers full reload and causes redirect

**Implementation**:
```typescript
const handleNoteChange = (updatedNote: Note): void => {
  setState(prev => {
    // Update the note in the notes array
    const updatedNotes = prev.notes.map(note =>
      note.id === updatedNote.id ? updatedNote : note
    );

    return {
      ...prev,
      notes: updatedNotes,
      currentNote: {
        ...updatedNote,
        tags: updatedNote.tags ?? []
      }
      // NOTE: Don't call loadNotes() - it causes redirect to list view
    };
  });
};
```

---

### Fix 2: Tags Being Removed

**File**: `backend/internal/services/prettify_service.go`

**Current Flow** (BUGGY):
1. Extract existing tags from original content
2. Call LLM to get prettified content
3. Merge existing tags + LLM suggested tags
4. Update note with LLM's prettified content (tags may not be in content)
5. Update tags in database

**Problem**: After step 4, the note content may not contain hashtags. The database has the tags, but the frontend extracts tags from content using regex, so they appear missing.

**Solution**: After merging tags, append them to the prettified content before saving.

**Implementation**:
```go
// In PrettifyNote function, after merging tags:

// 8. Handle tags - merge existing with suggested
existingTags := note.ExtractHashtags()
allTags := s.mergeTags(existingTags, llmResult.SuggestedTags)

// NEW: Append tags to prettified content if not empty
if len(allTags) > 0 {
    // Check if tags are already in the content
    contentTags := models.ExtractTagsFromContent(llmResult.PrettifiedContent)
    missingTags := []string{}
    for _, tag := range allTags {
        found := false
        for _, contentTag := range contentTags {
            if strings.EqualFold(tag, contentTag) {
                found = true
                break
            }
        }
        if !found {
            missingTags = append(missingTags, tag)
        }
    }

    // Append missing tags to content
    if len(missingTags) > 0 {
        // Add double newline before tags if content doesn't end with one
        separator := "\n\n"
        llmResult.PrettifiedContent += separator + strings.Join(missingTags, " ")
    }
}

// Now update with content that includes tags
updateRequest := &models.UpdateNoteRequest{
    Title:   &llmResult.PrettifiedTitle,
    Content: &llmResult.PrettifiedContent,  // Now includes tags
    Version: &note.Version,
}
```

---

### Fix 3: User Tags in LLM Prompt

**Files**: `backend/internal/services/prettify_service.go`

**Current Behavior**: `buildPrettifyPrompt` only includes the note's current tags in the content, not the user's full tag history.

**Solution**:
1. Get user's existing tags using `tagService.GetAllTags(userID, limit, offset)`
2. Pass them to `buildPrettifyPrompt`
3. Include user's tag list in the prompt

**Implementation**:

```go
// In PrettifyNote function:

// Get user's existing tags for context
tagList, err := s.tagService.GetAllTags(userID, 100, 0)
if err != nil {
    // Log but don't fail - tag context is optional
    fmt.Printf("Warning: failed to get user tags: %v\n", err)
    tagList = &models.TagList{Tags: []models.TagResponse{}}
}

// Build the LLM prompt with user tags
prompt := s.buildPrettifyPrompt(note, tagList.Tags)
```

```go
// Update buildPrettifyPrompt signature:
func (s *PrettifyService) buildPrettifyPrompt(note *models.Note, userTags []models.TagResponse) string {
    title := ""
    if note.Title != nil {
        title = *note.Title
    }

    // Build user tag list for prompt
    userTagList := ""
    if len(userTags) > 0 {
        tagNames := make([]string, len(userTags))
        for i, tag := range userTags {
            tagNames[i] = tag.Name
        }
        userTagList = strings.Join(tagNames, ", ")
    }

    prompt := fmt.Sprintf(`You are a note editing assistant. Prettify the following note according to these rules:

CURRENT NOTE:
Title: %s
Content: %s

YOUR EXISTING TAGS (prefer these when relevant):
%s

PRETTIFY RULES:
1. Detect the language of the content first
2. Fix all typos using language-specific corrections
3. Remove excess spacing, tabs, dots, commas
4. Prettify JSON (fix broken parentheses/formatting)
5. Fix indentation if deemed broken
6. Remove all emoticons
7. Convert markdown tables to simple bullet lists
8. Remove markdown headers and convert to bullets (use "-" for bullets)
9. Simplify formatting - use bullet points only, no complex markdown
10. If current title is empty, generate a title based on content (max 50 chars)
11. Suggest 2-3 relevant tags based on content (start with #, e.g., #tag1)
12. When suggesting tags, prefer using tags from "YOUR EXISTING TAGS" list if they are relevant to the content

IMPORTANT:
- Return valid JSON only
- Keep the content meaning but make it cleaner and more readable
- Convert table structures to simple bullet lists
- Remove markdown table syntax (|, ---, +) entirely
- For empty titles, create a descriptive title from the content

Response format (JSON):
{
  "detected_language": "en",
  "prettified_title": "Clean or Generated Title",
  "prettified_content": "Cleaned content with bullets only",
  "suggested_tags": ["#tag1", "#tag2", "#tag3"],
  "changes_made": ["fixed typos", "removed markdown tables", "suggested tags"]
}`, title, note.Content, userTagList)

    return prompt
}
```

---

### Fix 4: Integration Test

**New File**: `backend/internal/services/prettify_test.go`

**Test Requirements**:
- Input content with hashtag like `#todos`
- Verify hashtag is NOT removed from output
- Config flag: `USE_LLM_DURING_TEST=false` to skip the test

**Implementation**:
```go
package services

import (
    "context"
    "strings"
    "testing"

    "github.com/gpd/my-notes/internal/config"
    "github.com/gpd/my-notes/internal/llm"
    "github.com/gpd/my-notes/internal/models"
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"
)

// TestPrettifyOnContentWithHashtag verifies that hashtags in content are preserved
func TestPrettifyOnContentWithHashtag(t *testing.T) {
    if !config.UseLLMDuringTest() {
        t.Skip("LLM tests are disabled. Set USE_LLM_DURING_TEST=true to enable.")
    }

    // Setup test DB
    db := SetupTestDB(t)
    defer CleanupTestDB(t, db)

    // Create test user
    userID := CreateTestUser(t, db, "prettify@example.com")

    // Create note with content containing #todos hashtag
    inputContent := `- update run_migration.sh and its dependencies to migrate all these:
chat_logs
portfolio_access_permission
research_report
sessions
#todos
`

    noteID := CreateTestNote(t, db, userID, "Test Note", inputContent)

    // Setup services
    cfg := GetTestConfig()
    llmClient := llm.NewResilientLLM(&cfg.LLM)
    noteService := NewNoteService(db)
    tagService := NewTagService(db)
    prettifyService := NewPrettifyService(llmClient, noteService, tagService, db)

    // Call PrettifyNote
    response, err := prettifyService.PrettifyNote(context.Background(), userID, noteID)
    require.NoError(t, err)
    require.NotNil(t, response)

    // Verify #todos hashtag is preserved in the content
    outputContent := response.NoteResponse.Content
    assert.True(t, strings.Contains(outputContent, "#todos"),
        "Output content should contain #todos hashtag.\nInput: %s\nOutput: %s", inputContent, outputContent)

    // Also verify tags are in the database
    assert.Contains(t, response.NoteResponse.Tags, "#todos",
        "Response tags should contain #todos")
}
```

**Config Changes Needed**:

1. **File**: `backend/tests/tests.go`
   Add `USE_LLM_DURING_TEST` flag (similar to `USE_POSTGRE_DURING_TEST`):

```go
// USE_LLM_DURING_TEST controls whether LLM-dependent tests should run
// Usage: USE_LLM_DURING_TEST=true go test ./...
var USE_LLM_DURING_TEST = getEnvBool("USE_LLM_DURING_TEST", false)
```

2. **File**: `backend/internal/config/config.go`
   Add helper function for test config:

```go
// UseLLMDuringTest returns true if LLM tests should run
func UseLLMDuringTest() bool {
    return getEnvBool("USE_LLM_DURING_TEST", false)
}
```

---

## Summary of Files to Modify

### Frontend
| File | Change |
|------|--------|
| `extension/src/popup/index.tsx` | Fix `handleNoteChange` to not call `loadNotes()` |

### Backend Services
| File | Change |
|------|--------|
| `backend/internal/services/prettify_service.go` | 1. Append merged tags to prettified content<br>2. Get user tags and pass to prompt<br>3. Update `buildPrettifyPrompt` signature |

### Backend Tests
| File | Change |
|------|--------|
| `backend/internal/services/prettify_test.go` | **NEW FILE** - Add `TestPrettifyOnContentWithHashtag` |
| `backend/tests/tests.go` | Add `USE_LLM_DURING_TEST` flag |
| `backend/internal/config/config.go` | Add `UseLLMDuringTest()` helper |

---

## Success Criteria

1. **Frontend**: User stays on note detail page after clicking prettify
2. **Tags**: Existing hashtags are preserved in both database and content
3. **Tags**: New LLM-suggested tags are added
4. **LLM Context**: User's existing tags are included in prompt
5. **Test**: `TestPrettifyOnContentWithHashtag` passes when `USE_LLM_DURING_TEST=true`

---

## Testing Plan

### Manual Testing
1. Create a note with content containing `#todos`
2. Click prettify button
3. Verify: User stays on note detail page
4. Verify: `#todos` is still in the content
5. Verify: Any new tags suggested by LLM are also present

### Automated Testing
```bash
# Run prettify test with LLM
USE_LLM_DURING_TEST=true USE_POSTGRE_DURING_TEST=true go test ./backend/internal/services/... -run TestPrettifyOnContentWithHashtag -v

# Run all prettify tests
go test ./backend/internal/services/... -run Prettify -v
```

---

## Future Considerations

1. **Tag extraction improvement**: Current regex `#\w+` doesn't match hashtags with underscores or hyphens. Consider using the same regex as models: `#\s*\w+` (allows spaces after #)

2. **Performance**: `GetAllTags` is called on every prettify. Consider caching user's tags in session or memory if prettify becomes high-frequency.

3. **LLM cost**: Each prettify call consumes LLM tokens. Consider adding rate limiting or user quotas.
