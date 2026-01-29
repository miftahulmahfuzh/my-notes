# CLAUDE.md - Silence Notes

Chrome extension for note-taking (Google Keep style) with hashtag filtering and brutalist UI.

## Tech Stack

- **Frontend**: React + TypeScript (Chrome Extension Manifest V3)
- **Backend**: Go REST API
- **Database**: PostgreSQL + Redis
- **Auth**: Google OAuth 2.0
- **UI**: Tailwind CSS (brutalist design)

## Build Commands

### Backend
```bash
./backend_build.sh
```

### Frontend
```bash
./frontend_build.sh
```

### Loading Extension in Chrome
1. Navigate to `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select `extension/dist/`

### Reloading After Changes
- Go to `chrome://extensions/`
- Click refresh icon on extension card

## Project Structure

```
my-notes/
├── backend/          # Go API server
├── extension/        # Chrome Extension (React + TypeScript)
│   └── dist/         # Build output (load this in Chrome)
├── frontend_build.sh # Build frontend
└── backend_build.sh  # Build backend
```

## Key Features

- Note creation, editing, hashtag filtering
- Google OAuth authentication
- Real-time sync with backend
- Brutalist UI (high contrast, bold typography)
- Full-text search

## Keyboard Shortcuts

### Global Shortcuts (work everywhere)
- **Ctrl+N**: Create new note
- **Ctrl+H**: Open Help page
- **Ctrl+B**: Navigate back in history

### Notes List
- **Ctrl+F**: Enable keyword search and focus search input
- **Ctrl+Shift+F**: Enable semantic search and focus search input
- **Ctrl+C**: Clear search query (when search is active)

### Note Editor
- **Ctrl+S**: Save note
- **Tab**: Insert 2 spaces for indentation

### Note Detail
- **Ctrl+C**: Copy note content (without hashtags)

## Authentication

The Silence Notes Chrome Extension uses Chrome Identity API for authentication:
- **Frontend**: `extension/src/auth.ts` - Chrome Identity API implementation
- **Backend**: `POST /api/v1/auth/chrome` - Token exchange endpoint
- **Method**: `chrome.identity.getAuthToken()` for direct token access

### Storage Format
The working auth system uses individual keys in Chrome storage:
- `access_token` - JWT access token
- `refresh_token` - JWT refresh token
- `token_expiry` - Token expiration timestamp
- `session_id` - User session identifier
- `user_info` - User profile data

## Database Schema

```sql
Users:      id, google_id, email, avatar_url, created_at, updated_at
Notes:      id, user_id, title, content, created_at, updated_at
Tags:       id, name
NoteTags:   note_id, tag_id
```

## API Endpoints

```
# Authentication
POST   /api/v1/auth/chrome     # Chrome Identity API token exchange (primary auth)
POST   /api/v1/auth/refresh    # Refresh access token
DELETE /api/v1/auth/logout     # Logout user

# Notes
GET    /api/v1/notes           # List notes
POST   /api/v1/notes           # Create note
PUT    /api/v1/notes/:id       # Update note
DELETE /api/v1/notes/:id       # Delete note

# Tags
GET    /api/v1/tags            # List tags

# Search
GET    /api/v1/search/notes    # Search notes
```

## Development Commands

### Backend (Go)
```bash
./deploy_backend.sh
USE_POSTGRE_DURING_TEST=true ./test_backend.sh  # Run tests
```

### Frontend (Extension)
```bash
./test_frontend.sh
```

## Code Standards

- Go: standard conventions
- TypeScript: strict mode
- TDD: write tests first
- >90% code coverage
- Conventional commit messages

## MCP
Always use Context7 MCP when I need library/API documentation, code generation, setup or configuration steps without me having to explicitly ask.
