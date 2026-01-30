# Todos: handlers

**Package Path**: `backend/internal/handlers`

**Package Code**: HD

**Last Updated**: 2026-01-30 11:15:00

**Total Active Tasks**: 9

## Quick Stats
- P0 Critical: 1
- P1 High: 2
- P2 Medium: 4
- P3 Low: 3
- P4 Backlog: 0
- Blocked: 0
- Completed: 8

---

## Active Tasks

### [P0] Critical

### [P1] High
- [ ] **P1-HD-A002** Add caching mechanism for validateChromeToken
  - **Difficulty**: NORMAL
  - **Context**: Makes HTTP request to Google tokeninfo endpoint on every auth. No caching - consider short-lived token cache to reduce external API calls.
  - **Identified**: 2026-01-30 (analysis_report.md)
  - **Status**: active
  - **Related**: See "Performance Notes" section in analysis_report.md:43-46
  - **Location**: chrome_auth.go:148-149

- [ ] **P1-HD-A003** Extract sync complexity from SyncNotes
  - **Difficulty**: HARD
  - **Context**: 93-line function with complexity 8 handles multiple responsibilities. Should extract sync token validation and conflict detection logic.
  - **Identified**: 2026-01-30 (analysis_report.md)
  - **Status**: active
  - **Related**: See "Refactoring Opportunities" section in analysis_report.md:23-26
  - **Location**: notes.go:373

### [P2] Medium
- [ ] **P2-HD-A004** Reduce extensive logging in PrettifyNote
  - **Difficulty**: EASY
  - **Context**: 77-line function has 20+ log statements that clutter business logic. Consider extracting logging to middleware or wrapper.
  - **Identified**: 2026-01-30 (analysis_report.md)
  - **Status**: active
  - **Related**: See "Refactoring Opportunities" section in analysis_report.md:27-30
  - **Location**: notes.go:645

- [ ] **P2-HD-A005** Extract common batch handling logic from BatchUpdateNotes
  - **Difficulty**: NORMAL
  - **Context**: 67-line function (complexity 5) has similar pattern to BatchCreateNotes. Consider extracting common batch handling logic.
  - **Identified**: 2026-01-30 (analysis_report.md)
  - **Status**: active
  - **Related**: See "Refactoring Opportunities" section in analysis_report.md:35-38
  - **Location**: notes.go:523

- [ ] **P2-HD-A006** Simplify validateChromeToken tokeninfo response struct
  - **Difficulty**: NORMAL
  - **Context**: 79-line function (complexity 5) has large tokeninfo response struct. Lenient validation logic could be better documented.
  - **Identified**: 2026-01-30 (analysis_report.md)
  - **Status**: active
  - **Related**: See "Refactoring Opportunities" section in analysis_report.md:32-35
  - **Location**: chrome_auth.go:134

- [ ] **P2-HD-A007** Optimize tag extraction pattern
  - **Difficulty**: NORMAL
  - **Context**: Tag extraction pattern repeated in CreateNote, GetNote, UpdateNote, BatchCreateNotes, BatchUpdateNotes, handleSemanticSearch, SyncNotes, GetNotesByTag. Consider adding to service layer or ToResponse() method.
  - **Identified**: 2026-01-30 (analysis_report.md)
  - **Status**: active
  - **Related**: See "Code Quality Issues" section in analysis_report.md:232-237
  - **Location**: Multiple locations in notes.go

### [P3] Low
- [ ] **P3-HD-A000** Extract constants for magic numbers
  - **Difficulty**: EASY
  - **Context**: Batch size limit (50), pagination defaults (20, 100, 1000) should be constants. Would benefit from MaxBatchSize, DefaultLimit, MaxLimit, SyncLimit constants.
  - **Identified**: 2026-01-30 (analysis_report.md)
  - **Status**: active
  - **Related**: See "Code Quality Issues" section in analysis_report.md:245-255
  - **Location**: notes.go (multiple locations)

- [ ] **P3-HD-A001** Extract batch validation pattern to helper
  - **Difficulty**: EASY
  - **Context**: BatchCreateNotes and BatchUpdateNotes both check len == 0 and len > 50. Consider extracting to validateBatchSize helper.
  - **Identified**: 2026-01-30 (analysis_report.md)
  - **Status**: active
  - **Related**: See "Code Quality Issues" section in analysis_report.md:239-243
  - **Location**: notes.go:487-494, 546-553

- [ ] **P3-HD-A002** Implement database and Redis health checks
  - **Difficulty**: NORMAL
  - **Context**: HealthCheck has TODO comments for database/Redis health checks (health.go:51-53). Current implementation only returns basic service info.
  - **Identified**: 2026-01-30 (analysis_report.md)
  - **Status**: active
  - **Related**: See "TODO Comments" section in analysis_report.md:266-268
  - **Location**: health.go:51-53

### [P4] Backlog
- *No backlog tasks identified*

### 🚫 Blocked
- *No blocked tasks identified*

---

## Completed Tasks

### Recently Completed
- [x] **P1-HD-A001** Extract duplicate token generation logic in ExchangeChromeToken
  - **Completed**: 2026-01-30 11:15:00
  - **Method**: Extracted duplicate token generation and response building code into sendAuthResponse helper method
  - **Files Modified**: chrome_auth.go (lines 81-84, 100-103, added sendAuthResponse method at line 200)
  - **Impact**: Reduced ExchangeChromeToken from 84 lines to ~56 lines, eliminated duplicate code blocks for existing and new session token generation

- [x] **P0-HD-A000** Add timeout to HTTP client in validateChromeToken
  - **Completed**: 2026-01-30 (during execution)
  - **Method**: Added 10-second timeout to HTTP client
  - **Files Modified**: chrome_auth.go:148-151
  - **Impact**: HTTP client now has 10-second timeout, preventing indefinite hangs if Google tokeninfo endpoint is slow

- [x] **P1-HD-A006** Implement GET /api/v1/tags endpoint for autocomplete
  - **Completed**: 2026-01-28 12:15:00
  - **Method**: Direct implementation
  - **Files Modified**: backend/internal/services/tag_service.go, backend/internal/handlers/tags.go, backend/internal/handlers/handlers.go, backend/internal/server/server.go, backend/internal/models/tag.go
  - **Impact**: GET /api/v1/tags endpoint now returns all tags for current user with pagination and note counts

- [x] **P2-HD-A005** Remove stale handler code and unused route files
  - **Completed**: 2026-01-23 15:05:00
  - **Method**: Dead code removal
  - **Files Modified**: backend/internal/routes/tags.go (DELETED), backend/internal/routes/user.go (DELETED), backend/internal/handlers/security.go, backend/internal/handlers/health.go, backend/internal/handlers/user.go, backend/internal/handlers/markdown.go, backend/tests/handlers/user_test.go
  - **Impact**: ~250 lines of stale code removed

- [x] **P3-HD-A004** Remove stale code from chrome_auth.go and auth.go
  - **Completed**: 2025-01-23 14:40:00
  - **Method**: Code cleanup
  - **Files Modified**: backend/internal/handlers/chrome_auth.go, backend/internal/handlers/auth.go
  - **Impact**: 63 lines of stale/debug code removed

- [x] **P2-HD-A003** Remove dead code from auth.go
  - **Completed**: 2025-01-23 14:15:00
  - **Method**: Dead code removal
  - **Files Modified**: backend/internal/handlers/auth.go, backend/internal/server/server.go, backend/tests/handlers/refresh_test.go, backend/docs/TESTING.md
  - **Impact**: 46 lines removed, cleaner AuthHandler struct

- [x] **P1-HD-A001** Implement robust Chrome extension session reuse
  - **Completed**: 2025-11-02 15:50:00
  - **Method**: Session reuse logic implementation
  - **Files Modified**: backend/internal/handlers/chrome_auth.go, backend/internal/middleware/session.go, backend/internal/config/security.go
  - **Impact**: Eliminates 429 session limit errors for Chrome extension users

- [x] **P1-HD-A007** Create comprehensive package documentation
  - **Completed**: 2026-01-30 10:49:40
  - **Method**: Documentation generation
  - **Files Modified**: backend/internal/handlers/.workflows/package_readme.md
  - **Impact**: Full package documentation with Exported API, Internal Architecture, Dependencies, Usage patterns

---

## Archive

### 2026-01
P1-HD-A112: Old task from last month
