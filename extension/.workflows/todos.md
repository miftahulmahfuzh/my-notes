# Todos: Chrome Extension Restoration

**Package Path**: `extension/`

**Package Code**: CN

**Last Updated**: 2026-01-28T22:43:00Z

**Total Active Tasks**: 2

**Total Archived Tasks**: 15

## Quick Stats
- P0 Critical: 0
- P1 High: 1
- P2 Medium: 1
- P3 Low: 0
- P4 Backlog: 0
- Blocked: 0
- Completed Today: 1
- Completed This Week: 1
- Completed This Month: 1

---

## Active Tasks

### [P1] High
- [x] **P1-CN-A027** Fix horizontal scrollbar in Chrome extension popup
  - **Completed**: 2026-01-28
  - **Method**: /implement from code analyzer
  - **Files Modified**: extension/src/popup/popup.css
  - **Impact**: Width reduced from 800px to 760px, providing 40px buffer for browser chrome/scrollbars. Horizontal scrollbar eliminated.
  - **Plan**: `.workflows/plan/P1-CN-A027.md`
- [x] **P1-CN-A026** Fix tag autocomplete missing in new note page (Ctrl+N)
  - **Completed**: 2026-01-28
  - **Method**: /implement from code analyzer
  - **Files Modified**: extension/src/popup/index.tsx
  - **Impact**: Ctrl+N now opens NoteEditor in create mode with full tag autocomplete support (typing # triggers suggestions)
  - **Plan**: `.workflows/plan/P1-CN-A026.md`

- [x] **P1-CN-A025** Fix logout endpoint 401 Unauthorized error
  - **Completed**: 2026-01-28
  - **Method**: /implement from code analyzer
  - **Files Modified**: extension/src/auth.ts
  - **Impact**: Logout request now includes Authorization header, resolving 401 error
  - **Plan**: `.workflows/plan/P1-CN-A025.md`

- [ ] **P1-CN-A015** Fix non-clickable edit button in notes list
  - **Difficulty**: NORMAL
  - **Type**: Bug
  - **Context**: Edit button in notes list is visible but not clickable - no console logs appear when clicked. Delete button (adjacent) works correctly with identical structure. Root cause identified as SVG hit-testing failure due to complex path shapes.
  - **Status**: in_progress
  - **Plan**: `.workflows/plan/P1-CN-A015.md`
  - **Impact**: Users cannot edit notes from the list view, requiring workarounds to access note editor

### [P2] Medium
- [x] **P2-CN-A029** Change note list default sorting from created_at to updated_at
  - **Completed**: 2026-01-28
  - **Method**: /implement from code analyzer
  - **Files Modified**: extension/src/api.ts
  - **Impact**: Notes now sort by updated_at DESC (most recent edit first). Edited notes move to top of list.
  - **Plan**: `.workflows/plan/P2-CN-A029.md`
- [x] **P2-CN-A028** Revamp note detail page: icon-only buttons, repositioned header, removed statistics, compact metadata
  - **Completed**: 2026-01-28
  - **Method**: /implement from code analyzer
  - **Files Modified**: extension/src/components/NoteView.tsx, extension/src/popup/popup.css
  - **Impact**: Header now displays icon-only buttons in full-width row at top, title below with full width, statistics removed, metadata uses smaller fonts (0.75rem) with tighter spacing
  - **Plan**: `.workflows/plan/P2-CN-A028.md`

- [x] **P2-CN-A024** Add tag autocomplete feature to note editor
  - **Completed**: 2026-01-28
  - **Method**: Direct implementation
  - **Files Modified**: extension/src/api.ts, extension/src/components/NoteEditor.tsx, extension/src/popup/popup.css, extension/src/types/index.ts
  - **Impact**: Tag autocomplete dropdown appears when typing #, with client-side filtering, keyboard navigation (arrows/Ctrl+J/K/M/Ctrl+C), and click selection

- [x] **P2-CN-A023** Add Ctrl+C keyboard shortcut to note detail view for copying content
  - **Completed**: 2026-01-28 10:25:00
  - **Method**: Direct implementation
  - **Files Modified**: extension/src/components/NoteView.tsx, extension/src/popup/index.tsx
  - **Impact**: Ctrl+C/Cmd+C in note detail view now copies note content (hashtags stripped) to clipboard with visual feedback. Help page updated with Note Detail section.

- [ ] **P2-CN-A001** Test and verify note listing functionality end-to-end
  - **Difficulty**: NORMAL
  - **Context**: Note creation and saving to database verified, but note listing feature not yet tested
  - **Risk**: Users can create notes but may not be able to view their list of existing notes
  - **Current Status**: Backend GET /api/v1/notes endpoint exists, frontend UI needs verification
  - **Test Requirements**:
    - Verify frontend displays saved notes from database
    - Test pagination (limit/offset functionality)
    - Test sorting options (created_at, updated_at, title)
    - Verify error handling for empty note list
    - Test refresh/reload functionality
  - **Files to Test**: Frontend popup UI, API service getNotes() method
  - **Validation Method**: Create multiple test notes, verify they appear in extension UI
  - **Impact**: Complete basic note CRUD functionality restoration
  - **Status**: active
  - **Identified**: 2025-11-02 authentication fix completion

### [P3] Low
- *No low tasks identified*

### [P4] Backlog
- *No backlog tasks identified*

### 🚫 Blocked
- *No blocked tasks identified*

---

## Completed Tasks
- [x] **P2-CN-A021** Remove border from Google Sign-In button on login page
  - **Completed**: 2026-01-27 15:45:00
  - **Method**: Task reorganization
  - **Files Modified**: extension/src/popup/popup.css
  - **Impact**: Border removed from Google Sign-In button for cleaner appearance

- [x] **P2-CN-A020** Help page UI improvements: smaller fonts, reduced spacing, icon Back button, keyboard shortcuts
  - **Completed**: 2026-01-27 15:45:00
  - **Method**: Task reorganization
  - **Files Modified**: extension/src/popup/index.tsx, extension/src/popup/popup.css
  - **Impact**: Improved Help page UI with smaller fonts, icon-based back button, and keyboard shortcuts

- [x] **P2-CN-A019** Welcome page action buttons: icon-only single row layout
  - **Completed**: 2026-01-27 15:20:00
  - **Method**: Task reorganization
  - **Files Modified**: extension/src/popup/index.tsx, extension/src/popup/popup.css, extension/tests/popup/PopupApp.test.tsx
  - **Impact**: Welcome page now uses icon-only buttons in single row layout

- [x] **P2-CN-A018** Purge unused keyboard shortcuts infrastructure
  - **Completed**: 2026-01-27 10:50:00
  - **Method**: Task reorganization
  - **Files Modified**: extension/src (deleted multiple files)
  - **Impact**: Removed ~5,600 lines of unused code while preserving 2 working shortcuts

- [x] **P2-CN-A016** Add real-time search bar to notes list view
  - **Completed**: 2026-01-23 16:55:00
  - **Method**: Task reorganization
  - **Files Modified**: extension/src/popup/index.tsx, extension/src/popup/popup.css
  - **Impact**: Real-time search filtering implemented in notes list

- [x] **P2-CN-A017** Make tags clickable in note detail view for search filtering
  - **Completed**: 2026-01-23 17:46:00
  - **Method**: Task reorganization
  - **Files Modified**: extension/src/components/NoteView.tsx, extension/src/popup/index.tsx
  - **Impact**: Tags now clickable to filter notes by tag text

- [x] **P3-CN-A000** Purge dead code from frontend extension
  - **Completed**: 2026-01-23 15:40:00
  - **Method**: Task reorganization
  - **Files Modified**: extension/src (deleted ~10,600 lines)
  - **Impact**: Removed dead code, improved build times and code clarity

- [x] **P1-CN-A009** Remove confirmation dialogs from note deletion process for instant deletion
  - **Completed**: 2025-11-02 16:35:00
  - **Method**: Task reorganization
  - **Files Modified**: extension/src/components/NoteList.tsx, extension/src/popup/index.tsx, extension/src/components/NoteView.tsx, extension/src/components/DraggableNoteItem.tsx
  - **Impact**: Instant note deletion without confirmation dialogs
- [x] **P1-CN-A008** Disable auto-save functionality in NoteEditor to prevent unintended saves on Enter key
  - **Completed**: 2025-11-02 16:20:00
  - **Method**: Task reorganization
  - **Files Modified**: extension/src/components/NoteEditor.tsx
  - **Impact**: Enter key now creates new lines instead of triggering auto-save

- [x] **P1-CN-A007** Fix Chrome extension session limit exceeded error with robust session reuse
  - **Completed**: 2025-11-02 15:55:00
  - **Method**: Task reorganization
  - **Files Modified**: backend/internal/handlers/chrome_auth.go, backend/internal/middleware/session.go, backend/internal/config/security.go
  - **Impact**: Session limit errors eliminated through session reuse

- [x] **P1-CN-A006** Complete brutalist UI design system implementation and layout expansion
  - **Completed**: 2025-11-02 15:40:00
  - **Method**: Task reorganization
  - **Files Modified**: extension/src/popup/popup.css, extension/src/popup/index.tsx, extension/src/components/LoginForm.tsx, extension/src/components/SimpleUserProfile.tsx
  - **Impact**: Complete brutalist UI redesign with 800px popup width

- [x] **P1-CN-A005** Fix API response unwrapping for consistent frontend data handling
  - **Completed**: 2025-11-02 15:25:00
  - **Method**: Task reorganization
  - **Files Modified**: extension/src/api.ts
  - **Impact**: Note listing now displays correctly with proper response unwrapping

- [x] **P1-CN-A004** Fix authentication session management for Chrome extensions
  - **Completed**: 2025-11-02 14:30:00
  - **Method**: Task reorganization
  - **Files Modified**: backend/internal/handlers/chrome_auth.go, backend/internal/auth/jwt.go, backend/internal/middleware/auth.go
  - **Impact**: Authentication now works end-to-end for Chrome extensions

- [x] **P1-CN-A003** Fix API response parsing for wrapped APIResponse format
  - **Completed**: 2025-11-02 13:45:00
  - **Method**: Task reorganization
  - **Files Modified**: extension/src/auth.ts
  - **Impact**: Authentication responses now parsed correctly

- [x] **P1-CN-A002** Fix API endpoint URLs to include /v1 prefix
  - **Completed**: 2025-11-02 12:30:00
  - **Method**: Task reorganization
  - **Files Modified**: extension/src/api.ts
  - **Impact**: All API calls now reach correct backend endpoints

- [x] **P0-CN-A001** Restore basic note writing and database saving functionality
  - **Completed**: 2025-11-02 14:27:00
  - **Method**: Task reorganization
  - **Files Modified**: extension/src, backend
  - **Impact**: Basic note creation functionality fully restored and working

- [x] **P2-CN-A022** Add Copy button to notes list items
  - **Completed**: 2026-01-23 16:30:00
  - **Method**: Task reorganization (renamed from duplicate P2-CN-A002)
  - **Files Modified**: extension/src/popup/index.tsx, extension/src/popup/popup.css
  - **Impact**: Copy button added to notes list items for copying note content

---

## Archive

### 2025-11
- P0-CN-A001: Restore basic note writing and database saving functionality
- P1-CN-A002: Fix API endpoint URLs to include /v1 prefix
- P1-CN-A003: Fix API response parsing for wrapped APIResponse format
- P1-CN-A004: Fix authentication session management for Chrome extensions
- P1-CN-A005: Fix API response unwrapping for consistent frontend data handling
- P1-CN-A006: Complete brutalist UI design system implementation and layout expansion
- P1-CN-A007: Fix Chrome extension session limit exceeded error with robust session reuse
- P1-CN-A008: Disable auto-save functionality in NoteEditor to prevent unintended saves on Enter key
- P1-CN-A009: Remove confirmation dialogs from note deletion process for instant deletion
- P3-CN-A000: Purge dead code from frontend extension

### 2026-01
- P2-CN-A029: Change note list default sorting from created_at to updated_at
- P1-CN-A027: Fix horizontal scrollbar in Chrome extension popup
- P1-CN-A026: Fix tag autocomplete missing in new note page (Ctrl+N)
- P2-CN-A016: Add real-time search bar to notes list view
- P2-CN-A017: Make tags clickable in note detail view for search filtering
- P2-CN-A024: Add tag autocomplete feature to note editor
- P2-CN-A028: Revamp note detail page: icon-only buttons, repositioned header, removed statistics, compact metadata
