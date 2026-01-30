# Package: handlers

**Location**: `backend/internal/handlers`
**Last Updated**: 2025-01-30

## Overview

The `handlers` package provides HTTP request handlers for the Silence Notes REST API. This package serves as the presentation layer, translating HTTP requests into service layer calls and formatting responses according to the API specification. It implements handlers for authentication, note management, tag management, and health checks.

**Key Responsibilities:**
- Handle HTTP request/response lifecycle for all API endpoints
- Extract and validate user authentication from request context
- Parse and validate request bodies and query parameters
- Format responses using standard API response structures
- Provide Chrome extension-specific authentication flow
- Support both keyword and semantic search for notes

## Exported API

### Types

#### Handlers
```go
type Handlers struct {
    Health     *HealthHandler
    Auth       *AuthHandler
    ChromeAuth *ChromeAuthHandler
    Notes      *NotesHandler
    Tags       *TagsHandler
}
```

Purpose: Container for all API handlers, initialized with deferred dependency injection.

Methods:
- `NewHandlers() *Handlers` - Creates new handlers instance with nil auth/notes/tags handlers
- `(h *Handlers) SetAuthHandlers(*AuthHandler, *ChromeAuthHandler)` - Sets auth handlers after service creation
- `(h *Handlers) SetNotesHandler(*NotesHandler)` - Sets notes handler after service creation
- `(h *Handlers) SetTagsHandler(*TagsHandler)` - Sets tags handler after service creation

#### HealthHandler
```go
type HealthHandler struct{}
```

Purpose: Handles health check endpoint for service monitoring.

Methods:
- `NewHealthHandler() *HealthHandler` - Creates new health handler
- `(*HealthHandler) HealthCheck(w http.ResponseWriter, r *http.Request)` - Returns service health status

#### AuthHandler
```go
type AuthHandler struct {
    tokenService *auth.TokenService
    userService  services.UserServiceInterface
    blacklist    BlacklistAdder // optional
}
```

Purpose: Handles token refresh, logout, and token validation operations.

Fields:
- `tokenService` - JWT token generation and validation (required)
- `userService` - User data access (required)
- `blacklist` - Token revocation via blacklist (optional)

Methods:
- `NewAuthHandler(*auth.TokenService, services.UserServiceInterface) *AuthHandler` - Constructor
- `(*AuthHandler) SetBlacklist(BlacklistAdder)` - Optional: set blacklist for token revocation
- `(*AuthHandler) RefreshToken(w, r)` - POST /api/v1/auth/refresh - Exchange refresh token for new access token
- `(*AuthHandler) Logout(w, r)` - DELETE /api/v1/auth/logout - Invalidate current token
- `(*AuthHandler) ValidateToken(w, r)` - GET /api/v1/auth/validate - Return user info for valid token

#### ChromeAuthHandler
```go
type ChromeAuthHandler struct {
    tokenService *auth.TokenService
    userService  services.UserServiceInterface
}
```

Purpose: Handles Chrome Identity API token exchange for extension authentication.

Methods:
- `NewChromeAuthHandler(*auth.TokenService, services.UserServiceInterface) *ChromeAuthHandler` - Constructor
- `(*ChromeAuthHandler) ExchangeChromeToken(w, r)` - POST /api/v1/auth/chrome - Exchange Chrome token for JWT tokens

#### NotesHandler
```go
type NotesHandler struct {
    noteService          services.NoteServiceInterface
    semanticSearchService *services.SemanticSearchService
    prettifyService      *services.PrettifyService
}
```

Purpose: Handles all note CRUD operations, search, sync, and batch operations.

Fields:
- `noteService` - Note data access (required)
- `semanticSearchService` - AI-powered semantic search (optional)
- `prettifyService` - LLM-powered note formatting (optional)

Methods:
- `NewNotesHandler(services.NoteServiceInterface, *services.SemanticSearchService, *services.PrettifyService) *NotesHandler` - Constructor
- `(*NotesHandler) CreateNote(w, r)` - POST /api/v1/notes - Create new note
- `(*NotesHandler) ListNotes(w, r)` - GET /api/v1/notes - List notes with pagination
- `(*NotesHandler) GetNote(w, r)` - GET /api/v1/notes/{id} - Get single note
- `(*NotesHandler) UpdateNote(w, r)` - PUT /api/v1/notes/{id} - Update note with optimistic locking
- `(*NotesHandler) DeleteNote(w, r)` - DELETE /api/v1/notes/{id} - Delete note
- `(*NotesHandler) SearchNotes(w, r)` - GET /api/v1/search/notes - Keyword or semantic search
- `(*NotesHandler) GetNotesByTag(w, r)` - GET /api/v1/notes/tags/{tag} - Filter notes by hashtag
- `(*NotesHandler) SyncNotes(w, r)` - GET /api/v1/notes/sync - Incremental sync with conflict detection
- `(*NotesHandler) BatchCreateNotes(w, r)` - POST /api/v1/notes/batch - Create up to 50 notes
- `(*NotesHandler) BatchUpdateNotes(w, r)` - PUT /api/v1/notes/batch - Update up to 50 notes
- `(*NotesHandler) GetNoteStats(w, r)` - GET /api/v1/notes/stats - Get user statistics
- `(*NotesHandler) PrettifyNote(w, r)` - POST /api/v1/notes/{id}/prettify - AI-powered note formatting

#### TagsHandler
```go
type TagsHandler struct {
    tagService services.TagServiceInterface
}
```

Purpose: Handles tag listing operations.

Methods:
- `NewTagsHandler(services.TagServiceInterface) *TagsHandler` - Constructor
- `(*TagsHandler) GetTags(w, r)` - GET /api/v1/tags - List all user tags with pagination

### Request/Response Types

#### ChromeAuthRequest
```go
type ChromeAuthRequest struct {
    Token string `json:"token" validate:"required"`
}
```

#### ChromeAuthResponse
```go
type ChromeAuthResponse struct {
    User         models.UserResponse `json:"user"`
    AccessToken  string              `json:"access_token"`
    RefreshToken string              `json:"refresh_token"`
    TokenType    string              `json:"token_type"`
    ExpiresIn    int                 `json:"expires_in"`
    SessionID    string              `json:"session_id"`
}
```

#### HealthResponse
```go
type HealthResponse struct {
    Status    string           `json:"status"`
    Timestamp time.Time        `json:"timestamp"`
    Version   string           `json:"version"`
    Uptime    string           `json:"uptime"`
    Checks    map[string]Check `json:"checks,omitempty"`
}
```

#### Check
```go
type Check struct {
    Status  string `json:"status"`
    Message string `json:"message,omitempty"`
}
```

### Interfaces

#### BlacklistAdder
```go
type BlacklistAdder interface {
    AddToken(ctx context.Context, tokenID, userID, sessionID string, expiresAt time.Time, reason string) error
}
```

Purpose: Interface for token revocation. Allows AuthHandler to add tokens to blacklist without direct dependency on blacklist service implementation.

### Functions

#### respondWithError
```go
func respondWithError(w http.ResponseWriter, code int, message string)
```

Purpose: Sends standardized error response with proper error code mapping.

Parameters:
- `code` - HTTP status code
- `message` - Error message, optionally with ": " separator for details

Side effects: Writes JSON to response writer, sets Content-Type header

Thread-safety: Not thread-safe (writes directly to http.ResponseWriter)

#### respondWithJSON
```go
func respondWithJSON(w http.ResponseWriter, code int, payload interface{})
```

Purpose: Sends successful JSON response wrapped in standard API format.

Parameters:
- `code` - HTTP status code
- `payload` - Response data (will be wrapped in models.APIResponse)

Side effects: Writes JSON to response writer, sets Content-Type header

Thread-safety: Not thread-safe (writes directly to http.ResponseWriter)

### Constants

```go
const (
    ErrCodeBadRequest    = "BAD_REQUEST"
    ErrCodeUnauthorized  = "UNAUTHORIZED"
    ErrCodeForbidden     = "FORBIDDEN"
    ErrCodeNotFound      = "NOT_FOUND"
    ErrCodeConflict      = "CONFLICT"
    ErrCodeInternalError = "INTERNAL_ERROR"
)
```

Purpose: Standard error codes for API error responses. Mapped from HTTP status codes in `respondWithError`.

## Internal Architecture

### Key Internal Functions

#### (*NotesHandler) handleSemanticSearch
```go
func (h *NotesHandler) handleSemanticSearch(w http.ResponseWriter, r *http.Request, user *models.User, query string)
```

Purpose: Internal handler for semantic search requests. Delegates to SemanticSearchService and formats response with duration metadata.

#### (*NotesHandler) generateSyncToken
```go
func (h *NotesHandler) generateSyncToken(userID string, timestamp time.Time) string
```

Purpose: Generates unique sync token for tracking sync sessions. Uses MD5 hash of userID:timestamp:sync.

#### (*NotesHandler) getConflictStatus
```go
func (h *NotesHandler) getConflictStatus(note models.Note, conflicts []models.NoteConflict) string
```

Purpose: Determines conflict status for a note during sync operations. Returns "conflict", "needs_review", or "clean".

#### (*ChromeAuthHandler) validateChromeToken
```go
func (h *ChromeAuthHandler) validateChromeToken(token string) (*auth.GoogleUserInfo, error)
```

Purpose: Validates Chrome Identity API token with Google's tokeninfo endpoint. Handles lenient validation for Chrome extensions (email_verified may be missing).

#### (*ChromeAuthHandler) getOrCreateUser
```go
func (h *ChromeAuthHandler) getOrCreateUser(googleUserInfo *auth.GoogleUserInfo) (*models.User, error)
```

Purpose: Retrieves existing user or creates new one from Google user info using UserService.

### Data Flow

**Request Processing:**
1. HTTP request received → Handler method
2. Extract user from context (set by auth middleware)
3. Parse request body/query parameters
4. Validate input
5. Call service layer method
6. Format response using `respondWithJSON` or `respondWithError`

**Chrome Authentication:**
1. Chrome extension sends token → `ExchangeChromeToken`
2. Validate token with Google tokeninfo endpoint
3. Get or create user from database
4. Check for existing Chrome extension session
5. Reuse session or create new one
6. Generate JWT tokens with session ID
7. Return tokens + user info to extension

## Dependencies

### External Packages
- `github.com/gorilla/mux` - HTTP request router and URL parameter extraction
- `encoding/json` - JSON encoding/decoding for request/response bodies

### Internal Packages
- `github.com/gpd/my-notes/internal/auth` - TokenService, Claims, GoogleUserInfo, RefreshTokenRequest
- `github.com/gpd/my-notes/internal/models` - User, Note, API response types, request types
- `github.com/gpd/my-notes/internal/services` - UserServiceInterface, NoteServiceInterface, TagServiceInterface, SemanticSearchService, PrettifyService

### Standard Library
- `context` - Request context and cancellation
- `crypto/md5` - Sync token generation
- `encoding/json` - JSON marshaling/unmarshaling
- `fmt` - String formatting
- `io` - I/O operations (reading response bodies)
- `log` - Logging (especially in PrettifyNote)
- `net/http` - HTTP server and types
- `strconv` - String to number conversion (pagination parameters)
- `strings` - String manipulation (tag parsing, error checking)
- `time` - Timestamp handling and duration measurement

## Reverse Dependencies

### Primary Consumers
- `backend/internal/server` - Uses all handler types for route registration and dependency injection. Creates handlers in `initializeServices()` and registers routes in `setupRoutes()`.

- `backend/cmd/server` - Entry point that creates Handlers instance via `handlers.NewHandlers()` and passes to server initialization.

### Secondary Consumers (Test Files)
- `backend/tests/handlers/refresh_test.go` - Tests AuthHandler.RefreshToken
- `backend/tests/handlers/notes_integration_test.go` - Tests NotesHandler methods
- `backend/tests/handlers/mocks.go` - Mock setup for handler testing
- `backend/tests/server_test.go` - Integration tests using full handler stack
- `backend/tests/integration/logout_test.go` - Tests logout flow with AuthHandler
- `backend/tests/integration/auth_flow_test.go` - Tests authentication flow

## Concurrency

This package is **not designed for concurrent use** at the handler level. Each handler method is designed to be called by the HTTP server, which manages concurrency via goroutines per request.

Thread-safety characteristics:
- **Handler instances**: Safe for concurrent use (read-only fields after construction)
- **Service layer**: Thread safety depends on service implementations
- **respondWithJSON/respondWithError**: Not thread-safe per call, but safe when called by different goroutines with different http.ResponseWriter instances

Concurrency primitives used:
- None directly (relies on Go's http.Server for request goroutine management)

## Error Handling

Custom error types:
- None defined in this package (uses errors from service layer)

Sentinel errors:
- None (error strings compared directly, e.g., `"note not found"`, `"version mismatch"`)

Error wrapping:
- Yes - uses `fmt.Errorf` with `%w` in `validateChromeToken` and `getOrCreateUser`
- Service layer errors are passed through without additional wrapping

Error propagation:
- Handler methods check service errors and map to appropriate HTTP status codes
- Common patterns: `"note not found"` → 404, `"version mismatch"` → 409, validation errors → 400

Panics:
- None (all errors returned, not panicked)

## Performance

Allocation patterns:
- **Moderate** - Handlers allocate request/response structs for each HTTP request
- Tag extraction in note handlers creates new slices

Expensive operations:
- `validateChromeToken` - Makes HTTP request to Google tokeninfo endpoint (external API call)
- `PrettifyNote` - Calls LLM service (potentially slow AI processing)
- `handleSemanticSearch` - Calls semantic search service (embeddings + similarity search)
- Batch operations - Process up to 50 notes in a single request

Optimization notes:
- Pagination enforced with configurable limits (default 20-100 depending on endpoint)
- Batch operations capped at 50 items
- Tag extraction done after service calls to avoid redundant work

Benchmark coverage:
- No benchmark files in this package

## Usage

### Initialization

```go
// Create handlers container (before services exist)
handlers := handlers.NewHandlers()

// After services are created, set auth handlers
authHandler := handlers.NewAuthHandler(tokenService, userService)
authHandler.SetBlacklist(blacklistService)
chromeAuthHandler := handlers.NewChromeAuthHandler(tokenService, userService)
handlers.SetAuthHandlers(authHandler, chromeAuthHandler)

// Set notes handler
notesHandler := handlers.NewNotesHandler(noteService, semanticSearchService, prettifyService)
handlers.SetNotesHandler(notesHandler)

// Set tags handler
tagsHandler := handlers.NewTagsHandler(tagService)
handlers.SetTagsHandler(tagsHandler)
```

### Common Patterns

**Pattern 1: Authenticated endpoint with user context**
```go
func (h *Handler) Method(w http.ResponseWriter, r *http.Request) {
    user, ok := r.Context().Value("user").(*models.User)
    if !ok {
        respondWithError(w, http.StatusUnauthorized, "User not authenticated")
        return
    }

    // Use user.ID.String() for service calls
    result, err := h.service.Method(user.ID.String(), params)
    if err != nil {
        respondWithError(w, http.StatusInternalServerError, err.Error())
        return
    }

    respondWithJSON(w, http.StatusOK, result)
}
```

**Pattern 2: URL parameter extraction**
```go
vars := mux.Vars(r)
noteID := vars["id"]
if noteID == "" {
    respondWithError(w, http.StatusBadRequest, "Note ID is required")
    return
}
```

**Pattern 3: Query parameter parsing with defaults**
```go
limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
if limit <= 0 {
    limit = 20  // default
}
if limit > 100 {
    limit = 100  // max
}
```

**Pattern 4: Request body parsing**
```go
var request models.RequestType
decoder := json.NewDecoder(r.Body)
if err := decoder.Decode(&request); err != nil {
    respondWithError(w, http.StatusBadRequest, "Invalid request payload")
    return
}
defer r.Body.Close()
```

### Gotchas

- **User context**: Always check `ok` when extracting user from context - middleware may not have run
- **Tag extraction**: Must call `note.ExtractHashtags()` after service calls - tags aren't automatically populated
- **Chrome session reuse**: ChromeAuthHandler reuses existing Chrome extension sessions to avoid session proliferation
- **Batch limits**: Batch operations are capped at 50 items - enforce before calling services
- **Conflict detection**: Update operations return 409 on version mismatch - client should handle this
- **Semantic search optional**: `semanticSearchService` can be nil - always check before using
- **Prettify service optional**: `prettifyService` can be nil - returns 503 Service Unavailable
- **Error message format**: Use `"message: detail"` format for structured error details in `respondWithError`
- **Sync token generation**: Uses MD5 (not cryptographically secure) but acceptable for sync tokens

## Notes

### Documentation Created: 2025-01-30

### Design Decisions

- **Deferred initialization**: Handlers created before services due to circular dependency with server initialization. Setters used to inject services after creation.
- **Optional dependencies**: Semantic search and prettify services are optional - handlers gracefully handle their absence (feature degrades gracefully).
- **Chrome-specific auth**: Chrome extension has dedicated authentication flow that reuses sessions and handles lenient token validation (Chrome Identity API doesn't always return all fields).
- **Optimistic locking**: Note updates use version field for conflict detection - returns 409 on concurrent modifications.
- **Extensive logging**: PrettifyNote has detailed logging for debugging LLM integration issues.

### Future Considerations

- Health check TODOs mention adding database and Redis health checks
- Sync token validation is incomplete (only acknowledges received token)
- Session management for Chrome extensions could be improved (currently uses simple fallback if CreateSession fails)
