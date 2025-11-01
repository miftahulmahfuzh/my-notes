# Phase 4 Plan: Hashtag System & Filtering

## Overview

Phase 4 focuses on implementing a comprehensive hashtag system with advanced filtering capabilities. This phase builds upon the solid note CRUD foundation established in Phase 3 and introduces powerful organization, search, and discovery features that will make the note-taking system truly efficient and user-friendly.

## Week 4 Objectives

- Implement complete hashtag extraction and storage system
- Create advanced filtering interface with brutalist design
- Develop multi-tag filtering logic with Boolean operations
- Add search functionality with hashtag combinations
- Implement tag management features (suggestions, autocomplete, renaming)
- Create visual tag indicators in note listings
- Add tag-based navigation and organization

## Current Status from Phase 3

✅ **Completed:**
- Complete note CRUD operations with optimistic locking
- Note service layer with business logic
- REST API endpoints for notes
- Frontend React components (NoteList, NoteEditor, NoteView)
- Local storage and offline capability
- Sync mechanism with conflict resolution
- Comprehensive test coverage

🔧 **Tag Model Ready:**
- Complete Tag model with validation and sanitization
- NoteTag relationship model
- Tag extraction utilities from content
- Tag validation and suggestion functions

🔧 **Ready for Phase 4:**
- Tag service layer and handlers
- Tag API endpoints
- Frontend tag components and filtering UI
- Advanced search with tag combinations
- Tag management interface

## Day-by-Day Implementation Plan

### Day 1: Tag Service Layer & Business Logic

**Backend Focus:**
- Create `internal/services/tag_service.go`
- Implement tag management business logic
- Add tag extraction and auto-creation from notes
- Implement tag statistics and analytics
- Create tag suggestion algorithms

**Tasks:**
1. Create tag service interface and implementation
2. Implement CreateTag method with deduplication
3. Implement GetTagByID, GetTagByName methods
4. Implement ListTags with pagination and sorting
5. Implement GetTagsByUser with usage statistics
6. Add tag extraction from note content with auto-creation
7. Implement tag suggestion algorithm based on usage
8. Add tag statistics (note count, usage frequency)
9. Implement tag cleanup and optimization

**Files to Create:**
- `backend/internal/services/tag_service.go`
- `backend/internal/services/tag_service_test.go`

**Acceptance Criteria:**
- Tag operations prevent duplicates
- Tag extraction works automatically from note content
- Tag suggestions are relevant and sorted by usage
- Tag statistics provide useful insights
- Test coverage > 90% for service layer

### Day 2: Tag Handlers & API Endpoints

**Backend Focus:**
- Create `internal/handlers/tags.go`
- Implement REST API endpoints for tags
- Add tag filtering and search endpoints
- Implement batch operations for tags
- Add tag analytics endpoints

**Tasks:**
1. Create TagsHandler with tag service dependency
2. Implement GET /api/tags (list tags with pagination)
3. Implement GET /api/tags/:id (get single tag)
4. Implement POST /api/tags (create new tag)
5. Implement PUT /api/tags/:id (update tag name)
6. Implement DELETE /api/tags/:id (delete tag)
7. Implement GET /api/tags/suggestions (autocomplete)
8. Implement GET /api/tags/popular (most used tags)
9. Implement GET /api/tags/unused (tags with no notes)
10. Add tag validation and error handling

**Files to Create:**
- `backend/internal/handlers/tags.go`
- `backend/internal/handlers/tags_test.go`
- Update `backend/internal/handlers/handlers.go` to include TagsHandler

**Acceptance Criteria:**
- All tag CRUD endpoints working with proper authentication
- Tag suggestions return relevant results
- Popular tags sorted by usage frequency
- Proper error handling for duplicate tag names
- API documentation with examples
- Integration tests pass

### Day 3: Enhanced Note-Tag Integration

**Backend Focus:**
- Enhance note service with tag integration
- Implement note-tag relationship management
- Add tag filtering to note operations
- Create batch tag operations
- Implement tag-based search optimization

**Tasks:**
1. Enhance note service to automatically extract and create tags
2. Implement AddTagsToNote, RemoveTagsFromNote methods
3. Add GetNotesByTags method with multiple tag filtering
4. Implement GetNotesByAnyTag (OR logic) and GetNotesByAllTags (AND logic)
5. Add tag-based sorting to note listing
6. Implement tag count updates on note modifications
7. Add tag cleanup when notes are deleted
8. Create batch tag operations for multiple notes
9. Optimize database queries for tag filtering

**Files to Update:**
- `backend/internal/services/note_service.go` (enhance with tag operations)
- `backend/internal/services/note_service_test.go` (add tag tests)
- `backend/internal/handlers/notes.go` (add tag filtering endpoints)

**New API Endpoints:**
- GET /api/notes/by-tags?tags=tag1,tag2&operator=and|or
- POST /api/notes/:id/tags (add tags to note)
- DELETE /api/notes/:id/tags/:tagId (remove tag from note)
- GET /api/search/notes?tags=tag1,tag2&query=text

**Acceptance Criteria:**
- Notes automatically extract tags on creation/update
- Tag filtering works with both AND and OR logic
- Tag relationships stay consistent when notes change
- Database queries are optimized for tag filtering
- Tag counts update accurately

### Day 4: Frontend Tag Components & Basic Filtering

**Frontend Focus:**
- Create tag display and management components
- Implement basic tag filtering interface
- Add tag autocomplete functionality
- Create tag input components with validation
- Implement visual tag indicators

**Tasks:**
1. Create TagList component with brutalist design
2. Create TagItem component with note count display
3. Create TagInput component with autocomplete
4. Create TagSelector component for filtering
5. Add TagPill component for displaying tags in notes
6. Implement tag color coding or visual hierarchy
7. Create TagCloud component for popular tags
8. Add tag validation and formatting in inputs
9. Implement tag suggestions dropdown

**Files to Create:**
- `extension/src/components/TagList.tsx`
- `extension/src/components/TagItem.tsx`
- `extension/src/components/TagInput.tsx`
- `extension/src/components/TagSelector.tsx`
- `extension/src/components/TagPill.tsx`
- `extension/src/components/TagCloud.tsx`
- `extension/src/hooks/useTags.ts`
- `extension/src/types/tag.ts`
- `extension/src/utils/tag.ts`

**Acceptance Criteria:**
- Tags display correctly in lists and individual notes
- Tag input provides relevant autocomplete suggestions
- Tag validation prevents invalid tag formats
- Visual design follows brutalist principles
- Components are responsive and accessible

### Day 5: Advanced Filtering Interface

**Frontend Focus:**
- Create comprehensive filtering interface
- Implement multi-tag filtering with Boolean logic
- Add filter persistence and management
- Create filter state management
- Implement filter combination with search

**Tasks:**
1. Create FilterPanel component with brutalist design
2. Implement multi-tag selector with AND/OR logic
3. Create FilterBuilder component for complex filters
4. Add ActiveFilters component showing current filters
5. Create SavedFilters component for filter presets
6. Implement filter persistence in user preferences
7. Add filter combinations (tags + date + text search)
8. Create FilterStats component showing result counts
9. Add clear filters and reset functionality

**Files to Create:**
- `extension/src/components/FilterPanel.tsx`
- `extension/src/components/FilterBuilder.tsx`
- `extension/src/components/ActiveFilters.tsx`
- `extension/src/components/SavedFilters.tsx`
- `extension/src/components/FilterStats.tsx`
- `extension/src/hooks/useFilters.ts`
- `extension/src/types/filter.ts`
- `extension/src/utils/filter.ts`

**Filter Logic Implementation:**
- Single tag filtering: `#work`
- Multiple tags AND: `#work AND #urgent`
- Multiple tags OR: `#work OR #personal`
- Complex combinations: `(#work OR #project) AND #urgent`
- Tag exclusion: `#work AND -#archived`
- Date + tag combinations: `#work AND created_after:2024-01-01`

**Acceptance Criteria:**
- Users can create complex filter combinations
- Filter state persists across sessions
- Interface is intuitive despite powerful functionality
- Performance remains good with complex filters
- Visual design maintains brutalist simplicity

### Day 6: Search Enhancement & Tag Discovery

**Full Stack Focus:**
- Implement advanced search with hashtag integration
- Create tag discovery and recommendation system
- Add search result highlighting
- Implement related tags suggestions
- Create tag-based navigation

**Tasks:**
1. Enhance search service to include tag filtering
2. Implement search result highlighting for tags
3. Create related tags algorithm (tags that appear together)
4. Add tag recommendations based on user behavior
5. Implement tag trend analysis
6. Create tag navigation breadcrumbs
7. Add tag-based note suggestions
8. Implement search autocomplete with tag suggestions
9. Create tag-based quick filters

**Backend Enhancements:**
- `backend/internal/services/search_service.go` (enhance)
- Add GET /api/search/suggestions endpoint
- Add GET /api/tags/related/:tagId endpoint
- Add GET /api/tags/trending endpoint

**Frontend Components:**
- `extension/src/components/SearchBox.tsx` (enhance)
- `extension/src/components/SearchResults.tsx` (enhance)
- `extension/src/components/RelatedTags.tsx`
- `extension/src/components/TagBreadcrumbs.tsx`
- `extension/src/components/TrendingTags.tsx`

**Acceptance Criteria:**
- Search integrates seamlessly with tag filtering
- Tag suggestions are relevant and helpful
- Related tags provide useful discovery options
- Search results clearly highlight matching tags
- Tag navigation is intuitive and efficient

### Day 7: Tag Management Features & Polish

**Full Stack Focus:**
- Implement advanced tag management features
- Add tag analytics and insights
- Create tag organization tools
- Implement tag bulk operations
- Add comprehensive testing and optimization

**Tasks:**
1. Create TagManager component for bulk operations
2. Implement tag merge functionality (combine duplicate tags)
3. Add tag rename functionality with note updates
4. Create tag analytics dashboard
5. Implement tag export/import functionality
6. Add tag archiving and cleanup tools
7. Create tag usage statistics and trends
8. Implement tag permissions and sharing preparation
9. Add comprehensive error handling and user feedback

**Backend Additions:**
- POST /api/tags/merge (merge multiple tags)
- PUT /api/tags/:id/rename (rename tag)
- GET /api/tags/analytics (usage statistics)
- POST /api/tags/bulk (bulk operations)
- GET /api/tags/export (export tags)

**Frontend Components:**
- `extension/src/components/TagManager.tsx`
- `extension/src/components/TagAnalytics.tsx`
- `extension/src/components/TagMerge.tsx`
- `extension/src/components/TagExport.tsx`
- `extension/src/pages/TagSettings.tsx`

**Performance Optimizations:**
- Implement tag caching for frequent operations
- Optimize tag filtering queries with proper indexing
- Add pagination for large tag collections
- Implement lazy loading for tag clouds
- Cache tag suggestions and popular tags

**Testing & Polish:**
- Comprehensive unit tests for all tag operations
- Integration tests for tag-note relationships
- E2E tests for complex filtering scenarios
- Performance tests for large tag datasets
- Accessibility testing for tag components
- Error handling and edge case testing

**Acceptance Criteria:**
- Tag management tools are powerful yet intuitive
- Bulk operations work efficiently
- Tag analytics provide useful insights
- Performance remains excellent with large tag sets
- All edge cases handled gracefully
- Test coverage > 90% for new functionality

## Technical Implementation Details

### Enhanced API Endpoints

```go
// Tag Management
GET    /api/tags                    // List tags with pagination
GET    /api/tags/:id                // Get single tag
POST   /api/tags                    // Create tag
PUT    /api/tags/:id                // Update tag
DELETE /api/tags/:id                // Delete tag
GET    /api/tags/suggestions        // Autocomplete suggestions
GET    /api/tags/popular            // Most used tags
GET    /api/tags/unused             // Unused tags

// Tag Analytics
GET    /api/tags/analytics          // Usage statistics
GET    /api/tags/related/:tagId     // Related tags
GET    /api/tags/trending            // Trending tags
POST   /api/tags/merge              // Merge multiple tags
PUT    /api/tags/:id/rename         // Rename tag

// Enhanced Note Operations
GET    /api/notes/by-tags           // Filter notes by tags
POST   /api/notes/:id/tags          // Add tags to note
DELETE /api/notes/:id/tags/:tagId   // Remove tag from note

// Enhanced Search
GET    /api/search/notes            // Search with tag filtering
GET    /api/search/suggestions      // Search suggestions
```

### Frontend Component Architecture

```
components/
├── tags/
│   ├── TagList.tsx               // List of all tags
│   ├── TagItem.tsx               // Single tag with stats
│   ├── TagInput.tsx              // Tag input with autocomplete
│   ├── TagSelector.tsx           // Tag selection for filtering
│   ├── TagPill.tsx               // Tag display in notes
│   ├── TagCloud.tsx              // Popular tags visualization
│   └── TagManager.tsx            // Bulk tag operations
├── filters/
│   ├── FilterPanel.tsx           // Main filtering interface
│   ├── FilterBuilder.tsx         // Complex filter creation
│   ├── ActiveFilters.tsx         // Current filter display
│   ├── SavedFilters.tsx          // Filter presets
│   └── FilterStats.tsx           // Filter results info
├── search/
│   ├── SearchBox.tsx             // Enhanced search input
│   ├── SearchResults.tsx         // Results with highlighting
│   └── RelatedTags.tsx           // Related tag suggestions
└── analytics/
    ├── TagAnalytics.tsx          // Tag usage statistics
    ├── TrendingTags.tsx          // Trending tags display
    └── TagBreadcrumbs.tsx        // Navigation breadcrumbs
```

### Data Models

```typescript
// Tag Models
interface Tag {
  id: string;
  name: string;
  noteCount: number;
  createdAt: string;
  usageFrequency: number;
  lastUsed: string;
}

interface TagStats {
  totalNotes: number;
  usageCount: number;
  avgNotesPerDay: number;
  trending: boolean;
  relatedTags: string[];
}

// Filter Models
interface FilterCondition {
  field: 'tags' | 'content' | 'title' | 'created_at' | 'updated_at';
  operator: 'equals' | 'contains' | 'and' | 'or' | 'not';
  value: string | string[] | Date;
}

interface Filter {
  id: string;
  name: string;
  conditions: FilterCondition[];
  logic: 'and' | 'or';
  isActive: boolean;
}

// Search Models
interface SearchRequest {
  query?: string;
  tags?: string[];
  tagOperator?: 'and' | 'or';
  dateRange?: {
    start: Date;
    end: Date;
  };
  sortBy?: 'relevance' | 'created_at' | 'updated_at';
  limit?: number;
  offset?: number;
}
```

### Filter Implementation Logic

```typescript
// Filter Expression Examples
const filters = {
  // Single tag
  { tags: ['work'], operator: 'equals' },

  // Multiple tags AND
  { tags: ['work', 'urgent'], operator: 'and' },

  // Multiple tags OR
  { tags: ['work', 'personal'], operator: 'or' },

  // Complex combination
  {
    conditions: [
      { field: 'tags', operator: 'or', value: ['work', 'project'] },
      { field: 'tags', operator: 'equals', value: ['urgent'] },
      { field: 'content', operator: 'contains', value: 'deadline' }
    ],
    logic: 'and'
  },

  // Tag exclusion
  {
    tags: ['work'],
    excludeTags: ['archived', 'completed'],
    operator: 'and'
  }
};
```

### Database Schema Enhancements

```sql
-- Add tag statistics columns
ALTER TABLE tags ADD COLUMN note_count INTEGER DEFAULT 0;
ALTER TABLE tags ADD COLUMN usage_count INTEGER DEFAULT 0;
ALTER TABLE tags ADD COLUMN last_used TIMESTAMP;

-- Create indexes for performance
CREATE INDEX idx_tags_name_lower ON tags(LOWER(name));
CREATE INDEX idx_tags_note_count ON tags(note_count DESC);
CREATE INDEX idx_note_tags_note_id ON note_tags(note_id);
CREATE INDEX idx_note_tags_tag_id ON note_tags(tag_id);
CREATE INDEX idx_notes_created_at ON notes(created_at DESC);
CREATE INDEX idx_notes_updated_at ON notes(updated_at DESC);

-- Create materialized view for tag statistics
CREATE MATERIALIZED VIEW tag_stats AS
SELECT
  t.id,
  t.name,
  COUNT(nt.note_id) as note_count,
  MAX(n.updated_at) as last_used,
  COUNT(*) as usage_count
FROM tags t
LEFT JOIN note_tags nt ON t.id = nt.tag_id
LEFT JOIN notes n ON nt.note_id = n.id
GROUP BY t.id, t.name;

-- Create refresh function for materialized view
CREATE OR REPLACE FUNCTION refresh_tag_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY tag_stats;
END;
$$ LANGUAGE plpgsql;
```

### Search Algorithm Enhancement

```go
// Enhanced Search with Tag Integration
func (s *SearchService) SearchNotesWithTags(req *SearchNotesRequest) (*SearchResult, error) {
    // 1. Parse search query for hashtags
    tags := extractHashtags(req.Query)

    // 2. Remove hashtags from text search query
    textQuery := removeHashtags(req.Query)

    // 3. Build search conditions
    var conditions []Condition

    if textQuery != "" {
        conditions = append(conditions, TextSearchCondition(textQuery))
    }

    if len(tags) > 0 {
        if req.TagOperator == "and" {
            conditions = append(conditions, AllTagsCondition(tags))
        } else {
            conditions = append(conditions, AnyTagsCondition(tags))
        }
    }

    // 4. Execute search with ranking
    results, err := s.database.Search(conditions, req.SortBy, req.Limit, req.Offset)
    if err != nil {
        return nil, err
    }

    // 5. Highlight matching terms
    for i := range results {
        results[i].Content = highlightText(results[i].Content, textQuery, tags)
    }

    return &SearchResult{
        Notes: results,
        Total: len(results),
        Query: req.Query,
        Tags: tags,
    }, nil
}
```

## Performance Optimization Strategy

### Database Optimization
- **Indexing Strategy**: Composite indexes for common filter combinations
- **Query Optimization**: Use EXISTS for tag filtering instead of JOINs
- **Caching Layer**: Redis cache for popular tags and frequent queries
- **Materialized Views**: Pre-computed tag statistics for analytics

### Frontend Optimization
- **Virtual Scrolling**: For large tag lists and note results
- **Debounced Search**: Reduce API calls during typing
- **Tag Caching**: Cache tag lists and suggestions locally
- **Lazy Loading**: Load tag clouds and analytics on demand

### API Optimization
- **Batch Operations**: Single API calls for multiple tag operations
- **Field Selection**: Allow clients to request only needed fields
- **Compression**: gzip compression for large tag lists
- **Pagination**: Consistent pagination across all tag endpoints

## Testing Strategy

### Backend Tests
- **Unit Tests**: Tag service business logic and validation
- **Integration Tests**: Tag API endpoints with authentication
- **Performance Tests**: Tag filtering with large datasets
- **Database Tests**: Tag relationship integrity and constraints

### Frontend Tests
- **Component Tests**: Tag components with React Testing Library
- **Integration Tests**: Tag filtering and search functionality
- **E2E Tests**: Complete tag management workflows
- **Performance Tests**: Large tag collections and complex filters

### Search Tests
- **Query Tests**: Complex search expressions and edge cases
- **Ranking Tests**: Search result relevance and ordering
- **Highlighting Tests**: Proper highlighting of matches
- **Autocomplete Tests**: Tag suggestion accuracy and performance

## Success Metrics

### Functional Requirements
- ✅ Users can create, edit, and delete tags
- ✅ Tags automatically extract from note content
- ✅ Advanced filtering works with Boolean logic
- ✅ Search integrates seamlessly with tags
- ✅ Tag management tools are powerful and intuitive

### Performance Requirements
- ✅ Tag filtering response time < 300ms
- ✅ Tag autocomplete suggestions < 100ms
- ✅ Complex filter combinations < 500ms
- ✅ Tag loading and display < 200ms
- ✅ Search with tag filtering < 400ms

### User Experience Requirements
- ✅ Tag creation is automatic and effortless
- ✅ Filter interface is powerful yet approachable
- ✅ Tag discovery provides useful recommendations
- ✅ Visual design maintains brutalist principles
- ✅ Interface remains responsive with large tag sets

### Technical Requirements
- ✅ Test coverage > 90% for new functionality
- ✅ No performance regression with large datasets
- ✅ Tag relationships remain consistent
- ✅ Database queries optimized for tag operations
- ✅ Frontend components accessible and responsive

## Dependencies and Prerequisites

### Phase 3 Completion Requirements
- ✅ Note CRUD operations fully functional
- ✅ Frontend React components working
- ✅ Local storage and sync operational
- ✅ Tag model with validation complete
- ✅ Authentication system stable

### New Dependencies for Phase 4

```json
// Frontend additions
{
  "fuse.js": "^7.0.0",           // Fuzzy search for autocomplete
  "react-virtualized": "^9.22.0", // Virtual scrolling for large lists
  "react-select": "^5.7.0",       // Advanced select component
  "date-fns": "^2.30.0",          // Date utilities for filtering
  "lodash.debounce": "^4.0.8"     // Debounced search
}
```

```go
// Backend additions
// Minimal - primarily using existing dependencies
// May add specialized search libraries if needed for advanced features
```

## Risks and Mitigations

### Technical Risks
1. **Performance with Large Tag Sets**: Implement virtual scrolling and caching
2. **Complex Filter Logic**: Create comprehensive test suite and clear documentation
3. **Tag Name Conflicts**: Implement tag merging and normalization
4. **Search Result Relevance**: Continuously tune ranking algorithms

### User Experience Risks
1. **Feature Overload**: Maintain brutalist simplicity despite powerful features
2. **Filter Complexity**: Provide filter presets and tutorials
3. **Tag Sprawl**: Implement tag cleanup and analytics tools
4. **Learning Curve**: Create comprehensive documentation and examples

## Future Preparation

Phase 4 sets up the foundation for:
- **Phase 5**: Rich text features with tag-aware formatting
- **Enhanced Analytics**: Deeper tag usage insights and patterns
- **Collaboration Features**: Tag sharing and organization standards
- **AI-Powered Features**: Smart tag suggestions and auto-categorization

The hashtag system implemented in Phase 4 will become the organizational backbone of the entire note-taking system, enabling powerful search, filtering, and discovery capabilities while maintaining the brutalist design philosophy of simplicity and functionality.