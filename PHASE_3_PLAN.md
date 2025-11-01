# Phase 3 Plan: Core Note Functionality

## Overview

Phase 3 focuses on implementing the core note-taking functionality, including CRUD operations, basic frontend interface, and local storage with sync capabilities. This phase builds upon the solid authentication and data model foundation established in Phase 2.

## Week 3 Objectives

- Implement complete note CRUD operations with optimistic locking
- Create basic frontend interface with brutalist design
- Implement local storage for offline capability
- Create sync mechanism between local and remote storage
- Add comprehensive test coverage for all note operations

## Current Status from Phase 2

✅ **Completed:**
- Google OAuth 2.0 authentication system
- JWT token management with refresh capabilities
- User model and authentication handlers
- Complete Note model with validation and hashtag extraction
- Database schema and migration system
- Testing infrastructure

🔧 **Ready for Phase 3:**
- Note CRUD handlers and services
- Frontend React components for note interface
- Local storage implementation
- Sync mechanisms
- API integration with authentication

## Day-by-Day Implementation Plan

### Day 1: Note Service Layer & Business Logic

**Backend Focus:**
- Create `internal/services/note_service.go`
- Implement business logic for note operations
- Add optimistic locking with version control
- Create note validation and sanitization
- Implement note search functionality (basic)

**Tasks:**
1. Create note service interface and implementation
2. Implement CreateNote method with validation
3. Implement GetNote, UpdateNote, DeleteNote methods
4. Add version checking for optimistic locking
5. Implement ListNotes with pagination
6. Create basic search by content and title

**Files to Create:**
- `backend/internal/services/note_service.go`
- `backend/internal/services/note_service_test.go`

**Acceptance Criteria:**
- All note operations work with version control
- Comprehensive validation prevents invalid data
- Search returns relevant results
- Test coverage > 90% for service layer

### Day 2: Note Handlers & API Endpoints

**Backend Focus:**
- Create `internal/handlers/notes.go`
- Implement REST API endpoints for notes
- Add authentication middleware integration
- Implement proper HTTP status codes and error handling
- Add request/response validation

**Tasks:**
1. Create NotesHandler with authentication dependency
2. Implement POST /api/notes (create note)
3. Implement GET /api/notes (list notes with pagination)
4. Implement GET /api/notes/:id (get single note)
5. Implement PUT /api/notes/:id (update note with version check)
6. Implement DELETE /api/notes/:id (delete note)
7. Add input validation middleware
8. Implement proper error responses

**Files to Create:**
- `backend/internal/handlers/notes.go`
- `backend/internal/handlers/notes_test.go`
- Update `backend/internal/handlers/handlers.go` to include NotesHandler

**Acceptance Criteria:**
- All CRUD endpoints working with proper authentication
- Optimistic locking prevents concurrent update conflicts
- Proper HTTP status codes and error messages
- API documentation with examples
- Integration tests pass

### Day 3: Frontend Project Setup & Basic Components

**Frontend Focus:**
- Set up React development environment in extension
- Create basic component structure
- Implement routing and state management
- Set up API client with authentication
- Create basic UI components with brutalist design

**Tasks:**
1. Set up React + TypeScript project structure
2. Configure Webpack for Chrome extension
3. Create basic popup interface
4. Implement API client with JWT handling
5. Create NoteList component with brutalist styling
6. Create NoteItem component
7. Create Loading and Error components
8. Set up basic routing

**Files to Create:**
- `extension/src/popup/App.tsx`
- `extension/src/popup/components/NoteList.tsx`
- `extension/src/popup/components/NoteItem.tsx`
- `extension/src/popup/components/Loading.tsx`
- `extension/src/popup/components/ErrorBoundary.tsx`
- `extension/src/utils/api.ts`
- `extension/src/types/note.ts`
- Update `extension/manifest.json`

**Acceptance Criteria:**
- React development environment with hot reload
- Basic popup interface displays
- API client can authenticate and make requests
- Components follow brutalist design guide
- TypeScript types properly defined

### Day 4: Note Creation & Display Interface

**Frontend Focus:**
- Implement note creation interface
- Create note display components
- Add form validation and error handling
- Implement real-time preview
- Add keyboard shortcuts

**Tasks:**
1. Create NoteEditor component with brutalist design
2. Implement CreateNote form with validation
3. Add note display with proper formatting
4. Create NoteView component for reading notes
5. Add auto-save functionality
6. Implement keyboard shortcuts (Ctrl+S, Ctrl+N, Esc)
7. Add success/error notifications
8. Implement responsive design

**Files to Create:**
- `extension/src/popup/components/NoteEditor.tsx`
- `extension/src/popup/components/NoteView.tsx`
- `extension/src/popup/components/Notification.tsx`
- `extension/src/hooks/useNotes.ts`
- `extension/src/utils/keyboard.ts`

**Acceptance Criteria:**
- Users can create notes with title and content
- Form validation prevents empty notes
- Notes display correctly with proper formatting
- Auto-save works without user intervention
- Keyboard shortcuts function properly
- Mobile-responsive design

### Day 5: Local Storage & Offline Capability

**Frontend Focus:**
- Implement local storage for notes
- Create offline detection and handling
- Add conflict resolution for sync
- Implement storage quota management
- Create data migration utilities

**Tasks:**
1. Implement local storage service using Chrome storage API
2. Create offline detection utilities
3. Add automatic local backup of notes
4. Implement sync status indicators
5. Create conflict resolution strategy (last-writer-wins)
6. Add storage cleanup and optimization
7. Implement data versioning for migrations
8. Add storage quota monitoring

**Files to Create:**
- `extension/src/services/storage.ts`
- `extension/src/services/sync.ts`
- `extension/src/utils/offline.ts`
- `extension/src/types/storage.ts`
- `extension/src/hooks/useSync.ts`

**Acceptance Criteria:**
- Notes are stored locally for offline access
- App works without internet connection
- Changes sync when connection restored
- Storage doesn't exceed Chrome quota limits
- Data migrations handle schema changes

### Day 6: Sync Mechanism & Background Processing

**Full Stack Focus:**
- Implement bidirectional sync between local and remote
- Create background script for automatic sync
- Add conflict resolution algorithms
- Implement incremental sync to reduce bandwidth
- Add sync status and error handling

**Tasks:**
1. Create background script for sync processing
2. Implement incremental sync with timestamps
3. Add conflict resolution (3-way merge when possible)
4. Create sync queue for reliable operations
5. Add retry mechanism for failed syncs
6. Implement sync status reporting
7. Add manual sync trigger option
8. Create sync health monitoring

**Files to Create:**
- `extension/src/background/sync.ts`
- `extension/src/background/background.ts`
- `extension/src/services/conflict.ts`
- `extension/src/utils/timestamp.ts`
- Update `extension/src/services/sync.ts`

**Backend Updates:**
- Add GET /api/notes/sync endpoint with timestamp filtering
- Add sync metadata to note responses
- Implement conflict detection helpers

**Acceptance Criteria:**
- Automatic sync works in background
- Conflicts are resolved intelligently
- Sync is efficient with minimal data transfer
- Users can manually trigger sync
- Sync failures are handled gracefully

### Day 7: Testing, Integration & Polish

**Full Stack Focus:**
- Comprehensive testing for all Phase 3 features
- Integration testing between frontend and backend
- Performance optimization
- Error handling improvements
- Documentation updates

**Tasks:**
1. Write comprehensive unit tests for note service
2. Create integration tests for API endpoints
3. Add frontend component tests with React Testing Library
4. Create E2E tests for critical user flows
5. Add performance monitoring and optimization
6. Improve error messages and user feedback
7. Update API documentation
8. Create user guide for note features

**Tests to Create:**
- `backend/tests/services/note_service_test.go`
- `backend/tests/handlers/notes_integration_test.go`
- `extension/src/components/__tests__/NoteList.test.tsx`
- `extension/src/components/__tests__/NoteEditor.test.tsx`
- `extension/src/services/__tests__/storage.test.ts`
- `extension/src/services/__tests__/sync.test.ts`
- E2E tests with Playwright

**Acceptance Criteria:**
- Test coverage > 90% for all new code
- All integration tests pass
- E2E tests cover critical user journeys
- Performance meets requirements (API < 500ms)
- Documentation is complete and accurate

## Technical Implementation Details

### API Endpoints to Implement

```go
// Note CRUD Operations
POST   /api/notes              // Create note
GET    /api/notes              // List notes (with pagination)
GET    /api/notes/:id          // Get single note
PUT    /api/notes/:id          // Update note (with version)
DELETE /api/notes/:id          // Delete note

// Sync Support
GET    /api/notes/sync         // Get notes since timestamp
POST   /api/notes/batch        // Batch create/update notes

// Search (Basic)
GET    /api/search/notes       // Search notes by content/title
```

### Frontend Component Architecture

```
popup/
├── App.tsx                    // Main application
├── components/
│   ├── NoteList.tsx          // List of notes
│   ├── NoteItem.tsx          // Single note in list
│   ├── NoteEditor.tsx        // Note creation/editing
│   ├── NoteView.tsx          // Note display
│   ├── Loading.tsx           // Loading states
│   ├── Notification.tsx      // User feedback
│   └── ErrorBoundary.tsx     // Error handling
├── hooks/
│   ├── useNotes.ts           // Note operations
│   ├── useSync.ts            // Sync management
│   └── useAuth.ts            // Authentication state
├── services/
│   ├── api.ts                // API client
│   ├── storage.ts            // Local storage
│   └── sync.ts               // Sync logic
└── utils/
    ├── keyboard.ts           // Keyboard shortcuts
    ├── offline.ts            // Offline detection
    └── validation.ts         // Form validation
```

### Data Models

```typescript
// Frontend Note Types
interface Note {
  id: string;
  userId: string;
  title?: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  version: number;
  syncStatus: 'synced' | 'pending' | 'conflict' | 'error';
}

interface CreateNoteRequest {
  title?: string;
  content: string;
}

interface UpdateNoteRequest {
  title?: string;
  content?: string;
  version?: number;
}
```

### Sync Algorithm

1. **Background Sync** (every 30 seconds):
   - Check for local changes
   - Push pending changes to server
   - Pull remote changes since last sync
   - Resolve conflicts using 3-way merge
   - Update local storage

2. **Conflict Resolution**:
   - Compare local and remote versions
   - Use timestamp and version data
   - Apply 3-way merge when possible
   - Fall back to last-writer-wins if needed
   - Notify user of conflicts

3. **Offline Handling**:
   - Detect connection status changes
   - Queue operations when offline
   - Process queue when connection restored
   - Handle sync failures gracefully

## Testing Strategy

### Backend Tests
- **Unit Tests**: Note service business logic
- **Integration Tests**: API endpoints with authentication
- **Contract Tests**: Request/response validation
- **Performance Tests**: Sync endpoint performance

### Frontend Tests
- **Unit Tests**: Component behavior and utilities
- **Integration Tests**: API client and storage
- **Component Tests**: User interactions with React Testing Library
- **E2E Tests**: Complete user flows with Playwright

### Sync Tests
- **Offline Tests**: Sync behavior without internet
- **Conflict Tests**: Various conflict scenarios
- **Performance Tests**: Large dataset sync performance
- **Reliability Tests**: Network interruption handling

## Performance Requirements

- **API Response Time**: < 500ms for note operations
- **Sync Completion**: < 3 seconds for typical sync
- **Offline Performance**: Instant UI response
- **Storage Efficiency**: < 10MB for 1000 notes
- **Memory Usage**: < 50MB for extension

## Success Metrics

### Functional Requirements
- ✅ Users can create, read, update, and delete notes
- ✅ Notes sync reliably between local and remote storage
- ✅ Application works offline with proper sync when online
- ✅ Conflicts are resolved intelligently
- ✅ Interface follows brutalist design principles

### Technical Requirements
- ✅ Test coverage > 90% for all new code
- ✅ API response times under 500ms
- ✅ Sync completion under 3 seconds
- ✅ Zero data loss during sync conflicts
- ✅ Chrome extension performance guidelines met

### User Experience Requirements
- ✅ Intuitive note creation and editing
- ✅ Clear feedback for sync status
- ✅ Graceful handling of errors and conflicts
- ✅ Responsive design on all screen sizes
- ✅ Keyboard shortcuts for power users

## Dependencies and Prerequisites

### Phase 2 Completion Requirements
- ✅ Authentication system fully functional
- ✅ Database schema with notes table
- ✅ JWT token management working
- ✅ Note model with validation complete

### New Dependencies for Phase 3
```json
// Frontend
{
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "typescript": "^5.0.0",
  "@types/react": "^18.2.0",
  "@types/react-dom": "^18.2.0",
  "webpack": "^5.88.0",
  "babel-loader": "^9.1.0",
  "@testing-library/react": "^13.4.0",
  "@testing-library/jest-dom": "^5.16.0"
}
```

```go
// Backend (minimal additions)
// Note: Go services will primarily use existing dependencies
// May add specific libraries for advanced sync algorithms if needed
```

## Risks and Mitigations

### Technical Risks
1. **Sync Conflicts**: Implement robust 3-way merge algorithm
2. **Chrome Storage Limits**: Implement data compression and cleanup
3. **Performance Issues**: Add pagination and lazy loading
4. **Authentication Expiry**: Implement automatic token refresh

### User Experience Risks
1. **Complex Interface**: Maintain brutalist simplicity
2. **Data Loss**: Implement comprehensive backup and versioning
3. **Offline Confusion**: Clear sync status indicators
4. **Performance Degradation**: Monitor and optimize continuously

## Next Steps for Phase 4

After Phase 3 completion, the project will be ready for:
- Enhanced hashtag system implementation
- Advanced filtering and search capabilities
- Rich text and markdown support
- User experience improvements

Phase 3 establishes the core foundation that all future features will build upon, ensuring a solid, reliable note-taking experience with excellent performance and user satisfaction.