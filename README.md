# Silence Notes

A brutalist Chrome extension for note-taking with hashtag filtering, Google authentication, and persistent backend storage.

## Overview

**Silence Notes** is a modern note-taking application that combines simplicity with power. Built with a brutalist design philosophy, it offers:

- **Chrome Extension** (Manifest V3) with React + TypeScript
- **Go REST API** backend with PostgreSQL database
- **Google OAuth 2.0** authentication via Chrome Identity API
- **Hashtag-based organization** with powerful filtering
- **Real-time sync** between extension and backend
- **Offline capability** with automatic conflict resolution
- **Comprehensive keyboard shortcuts** for power users

## Features

### Core Functionality
- Create, edit, and delete notes with rich text support
- Automatic hashtag extraction and organization
- Full-text search with tag filtering
- Google authentication via Chrome Identity API
- Real-time synchronization with backend
- Offline capability with local storage

### User Experience
- **Brutalist Design** - High contrast, bold typography, minimal UI
- **32 Keyboard Shortcuts** - Quick access to all actions
- **Markdown Support** - Full markdown rendering with syntax highlighting
- **Virtual Scrolling** - Handle large note lists efficiently
- **Auto-save** - Never lose your work

## Quick Start

### Prerequisites
- **Go** 1.21 or higher
- **Node.js** 18 or higher
- **PostgreSQL** 13 or higher (or Docker)
- **Chrome/Edge browser** (for extension)

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/my-notes.git
   cd my-notes
   ```

2. **Install dependencies**
   ```bash
   # Frontend dependencies
   npm install --prefix extension

   # Backend dependencies (go mod download happens automatically)
   ```

3. **Set up database**
   ```bash
   # Using Docker (recommended for development)
   docker run --name my-notes-postgres \
     -e POSTGRES_DB=my_notes_test \
     -e POSTGRES_USER=test_user \
     -e POSTGRES_PASSWORD=test_password \
     -p 5432:5432 \
     -d postgres:15
   ```

4. **Configure environment**
   ```bash
   # Backend .env (optional, has defaults)
   export DB_NAME=my_notes_test
   export DB_USER=test_user
   export DB_PASSWORD=test_password
   export DB_HOST=localhost
   export DB_PORT=5432
   export DB_SSLMODE=disable
   ```

5. **Build and run**
   ```bash
   # Build backend
   ./backend_build.sh

   # Build frontend
   ./frontend_build.sh

   # Or deploy backend with database
   ./deploy_backend.sh
   ```

6. **Load extension in Chrome**
   - Navigate to `chrome://extensions/`
   - Enable **Developer mode** (top-right toggle)
   - Click **Load unpacked**
   - Select `extension/dist/` folder
   - Silence Notes icon appears in toolbar

### Development Workflow

```bash
# Build commands
./frontend_build.sh          # Build extension
./backend_build.sh           # Build Go backend

# Test commands
./test_frontend.sh           # Run frontend tests
USE_POSTGRE_DURING_TEST=true ./test_backend.sh  # Run backend tests with PostgreSQL

# Deploy
./deploy_backend.sh          # Start backend with Docker PostgreSQL
```

## Bash Scripts Reference

All scripts are located in the project root directory.

| Script | Purpose | Usage |
|--------|---------|-------|
| `frontend_build.sh` | Build Chrome extension | `./frontend_build.sh` |
| `test_frontend.sh` | Run frontend tests with coverage | `./test_frontend.sh` |
| `test_backend.sh` | Run backend tests | `./test_backend.sh` or `USE_POSTGRE_DURING_TEST=true ./test_backend.sh` |
| `backend_build.sh` | Build Go backend binary | `./backend_build.sh` |
| `deploy_backend.sh` | Deploy backend with Docker PostgreSQL | `./deploy_backend.sh` |

### Script Details

**frontend_build.sh**
- Cleans `extension/dist/`
- Runs `npm run build` in extension directory
- Outputs to `extension/dist/` (load this in Chrome)

**test_frontend.sh**
- Installs dependencies if needed
- Runs `npm run test:coverage`
- Generates coverage report at `extension/coverage/index.html`

**test_backend.sh**
- Runs all backend test suites
- Skips PostgreSQL tests unless `USE_POSTGRE_DURING_TEST=true`
- Test suites: Notes, Auth, Services, JWT, Middleware, Integration, Migrations

**backend_build.sh**
- Compiles Go binary to `backend/server`
- Ready to run with `./backend/server`

**deploy_backend.sh**
- Starts PostgreSQL in Docker
- Kills existing process on port 8080
- Sets environment variables
- Starts backend server in background

## Architecture

### Technology Stack

**Frontend:**
- React 18 with TypeScript
- Chrome Extension Manifest V3
- Tailwind CSS (brutalist design system)
- Chrome APIs (Identity, Storage, Runtime)

**Backend:**
- Go 1.21+ with standard library
- PostgreSQL for data storage
- JWT tokens for authentication
- Gorilla Mux for routing

### Project Structure

```
my-notes/
├── extension/                 # Chrome Extension
│   ├── src/
│   │   ├── popup/            # Main popup UI
│   │   ├── background/       # Service worker
│   │   ├── content/          # Content scripts
│   │   ├── options/          # Settings page
│   │   ├── components/       # React components
│   │   ├── types/            # TypeScript types
│   │   ├── utils/            # Utilities
│   │   ├── api.ts            # API service layer
│   │   └── auth.ts           # Chrome Identity auth
│   ├── dist/                 # Build output (load this)
│   └── package.json
│
├── backend/                   # Go API Server
│   ├── cmd/server/           # Entry point
│   ├── internal/
│   │   ├── handlers/         # HTTP handlers
│   │   ├── services/         # Business logic
│   │   ├── models/           # Data models
│   │   ├── middleware/       # HTTP middleware
│   │   ├── database/         # Database layer
│   │   ├── config/           # Configuration
│   │   └── auth/             # JWT/auth logic
│   ├── migrations/           # Database migrations
│   ├── tests/                # Test suites
│   └── go.mod
│
├── frontend_build.sh         # Build extension
├── backend_build.sh          # Build backend
├── test_frontend.sh          # Test frontend
├── test_backend.sh           # Test backend
└── deploy_backend.sh         # Deploy backend
```

### Frontend Codebase Structure

```
extension/src/
├── api.ts                    # API service (all backend communication)
├── auth.ts                   # Chrome Identity API integration
├── manifest.json             # Extension manifest
│
├── popup/
│   ├── index.tsx            # Main popup application
│   ├── popup.css            # Brutalist design styles
│   └── popup.html           # Popup template
│
├── components/
│   ├── LoginForm.tsx        # Google OAuth login
│   ├── NoteEditor.tsx       # Note editing interface
│   ├── NoteView.tsx         # Note viewing interface
│   ├── MarkdownPreview.tsx  # Markdown renderer
│   ├── SimpleUserProfile.tsx # User profile display
│   ├── Settings.tsx         # Settings modal
│   └── *.css                # Component styles
│
├── types/
│   ├── index.ts             # Core types (Note, User, etc.)
│   ├── shortcuts.ts         # Keyboard shortcut types
│   └── storage.ts           # Chrome storage types
│
├── utils/
│   ├── config.ts            # Configuration constants
│   ├── contentUtils.ts      # Hashtag/content utilities
│   ├── markdown.ts          # Markdown processing
│   └── shortcuts.ts         # Keyboard shortcut handlers
│
├── background/
│   └── index.ts             # Background service worker
│
├── content/
│   └── index.ts             # Content scripts
│
└── options/
    ├── index.tsx            # Options page
    ├── options.css
    └── options.html
```

### Backend Codebase Structure

```
backend/
├── cmd/server/main.go       # Application entry point
│
├── internal/
│   ├── handlers/
│   │   ├── chrome_auth.go   # Chrome Identity API handler
│   │   ├── auth.go          # Standard OAuth handlers
│   │   ├── notes.go         # Note CRUD endpoints
│   │   ├── health.go        # Health check
│   │   └── handlers.go      # Handler registry
│   │
│   ├── services/
│   │   ├── note_service.go  # Note business logic
│   │   ├── tag_service.go   # Tag management
│   │   └── user_service.go  # User management
│   │
│   ├── models/
│   │   ├── note.go          # Note model with validation
│   │   ├── tag.go           # Tag model
│   │   └── user.go          # User model
│   │
│   ├── middleware/
│   │   ├── auth.go          # JWT validation
│   │   ├── session.go       # Session management
│   │   ├── security.go      # Security headers
│   │   ├── rate_limiting.go # Rate limiting
│   │   └── middleware.go    # Core middleware
│   │
│   ├── database/
│   │   ├── database.go      # Connection management
│   │   └── migrate.go       # Migration runner
│   │
│   ├── auth/
│   │   ├── jwt.go           # JWT generation/validation
│   │   └── google_user.go   # Google auth helper
│   │
│   ├── config/
│   │   ├── config.go        # Configuration
│   │   └── security.go      # Security config
│   │
│   ├── security/
│   │   └── monitor.go       # Security monitoring
│   │
│   └── server/
│       └── server.go        # HTTP server setup
│
├── migrations/              # Database schema migrations
│   ├── 001_create_users_table.*
│   ├── 002_create_notes_table.*
│   ├── 002_create_user_sessions.*
│   ├── 003_create_tags_table.*
│   └── 004_create_note_tags_table.*
│
├── tests/                   # Test suites
│   ├── auth/                # Auth tests
│   ├── handlers/            # Handler tests
│   ├── integration/         # Integration tests
│   ├── middleware/          # Middleware tests
│   └── services/            # Service tests
│
└── docs/api/
    └── openapi.yaml         # API specification
```

## Frontend Features and API Endpoints

### Authentication

**Components:** `auth.ts`, `LoginForm.tsx`

**Backend Endpoints:**
- `POST /api/v1/auth/chrome` - Exchange Chrome Identity token for JWT
- `POST /api/v1/auth/refresh` - Refresh access token
- `DELETE /api/v1/auth/logout` - Logout and invalidate session
- `GET /api/v1/health` - Health check

**Flow:**
1. User clicks "Sign in with Google"
2. `chrome.identity.getAuthToken()` retrieves OAuth token
3. Token exchanged with backend for JWT tokens
4. Tokens stored in Chrome storage
5. Automatic token refresh before expiry

### Note Management

**Components:** `NoteEditor.tsx`, `NoteView.tsx`, `popup/index.tsx`

**Backend Endpoints:**
- `GET /api/v1/notes` - List notes with pagination
- `POST /api/v1/notes` - Create note
- `GET /api/v1/notes/:id` - Get specific note
- `PUT /api/v1/notes/:id` - Update note
- `DELETE /api/v1/notes/:id` - Delete note
- `GET /api/v1/notes/sync` - Delta synchronization
- `POST /api/v1/notes/batch` - Batch create
- `PUT /api/v1/notes/batch` - Batch update
- `GET /api/v1/notes/stats` - Statistics
- `GET /api/v1/notes/tags/:tag` - Notes by tag

**Features:**
- Auto-generated titles from content
- Character/word count
- Keyboard shortcuts (Ctrl+S to save, Tab for indent)
- Auto-save functionality
- Optimistic UI updates
- Conflict resolution via version field

### Search and Filtering

**Components:** `popup/index.tsx`, `contentUtils.ts`

**Backend Endpoints:**
- `GET /api/v1/search/notes` - Full-text search
- `GET /api/v1/tags` - List all tags

**Features:**
- Debounced search input
- Local filtering for immediate feedback
- Clickable hashtags for filtering
- Search by content and tags

### Keyboard Shortcuts

**Components:** `utils/shortcuts.ts`, `types/shortcuts.ts`

**32 Built-in Shortcuts:**

**Navigation:**
- `j` / `k` - Navigate up/down
- `Enter` - Open selected note
- `Escape` - Cancel/close

**Note Actions:**
- `n` - Create new note
- `e` - Edit current note
- `d` - Delete current note
- `Ctrl+S` - Save note

**Search:**
- `/` - Focus search box
- `Ctrl+F` - Find in note
- `#` - Quick tag filter

**View:**
- `p` - Toggle markdown preview
- `Ctrl+1/2/3` - Switch view modes

**Text Formatting:**
- `Ctrl+B` - Bold
- `Ctrl+I` - Italic
- `Ctrl+K` - Insert link

**Application:**
- `Ctrl+/` - Show help
- `Ctrl+Shift+/` - Show shortcuts reference

### Markdown Rendering

**Components:** `MarkdownPreview.tsx`, `utils/markdown.ts`

**Features:**
- Full markdown support
- Syntax highlighting for code blocks
- Table of contents generation
- Active section tracking
- XSS protection

### Offline Capability

**Components:** `types/storage.ts`, Chrome Storage API

**Features:**
- All notes stored locally
- Operations work offline
- Sync queue for background upload
- Automatic conflict resolution

### User Profile

**Components:** `SimpleUserProfile.tsx`

**Features:**
- Display user avatar with initials
- Member since date
- Logout confirmation

### Settings

**Components:** `Settings.tsx`

**Features:**
- General settings display
- Theme options
- Sync status

## Database Schema

### Users Table
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    google_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Notes Table
```sql
CREATE TABLE notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500),
    content TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    version INTEGER NOT NULL DEFAULT 1
);
```

### Tags Table
```sql
CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Note Tags Junction Table
```sql
CREATE TABLE note_tags (
    note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (note_id, tag_id)
);
```

### User Sessions Table
```sql
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_hash TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## API Endpoints Reference

### Public Endpoints (no authentication)
```
GET  /api/v1/health              # Health check
POST /api/v1/auth/chrome         # Chrome Identity token exchange
POST /api/v1/auth/refresh        # Refresh access token
```

### Protected Endpoints (require authentication)
```
DELETE /api/v1/auth/logout       # Logout

# Notes
GET    /api/v1/notes             # List notes
POST   /api/v1/notes             # Create note
GET    /api/v1/notes/:id         # Get note
PUT    /api/v1/notes/:id         # Update note
DELETE /api/v1/notes/:id         # Delete note
GET    /api/v1/notes/sync        # Sync notes
POST   /api/v1/notes/batch       # Batch create
PUT    /api/v1/notes/batch       # Batch update
GET    /api/v1/notes/stats       # Statistics
GET    /api/v1/notes/tags/:tag   # Notes by tag

# Search
GET    /api/v1/search/notes      # Search notes

# Tags
GET    /api/v1/tags              # List tags
```

## Brutalist Design System

### Design Principles
- **High Contrast** - Bold black and white with orange accents
- **Bold Typography** - Archivo (headings) + Inter (body)
- **Minimal UI** - No unnecessary decorations
- **Sharp Edges** - No rounded corners, thick borders
- **Functional** - Every element serves a purpose

### Color Palette
```css
:root {
  --primary-color: #FF4D00;  /* Bold orange */
  --black: #0A0A0A;           /* Deep black */
  --white: #FFFFFF;           /* Pure white */
  --gray-light: #F5F5F5;      /* Light gray */
  --gray-medium: #999999;     /* Medium gray */
}
```

### Typography
- **Headings:** Archivo (900, 700, 400 weights)
- **Body:** Inter (600, 400 weights)
- **Scale:** 36px → 28px → 24px → 18px → 16px → 14px

## Testing

### Frontend Tests
```bash
./test_frontend.sh
```
Runs Jest tests with coverage. Report available at `extension/coverage/index.html`.

### Backend Tests
```bash
# Quick tests (no database)
./test_backend.sh

# Full tests with PostgreSQL
USE_POSTGRE_DURING_TEST=true ./test_backend.sh
```

Test suites include:
- Notes Integration Tests
- Auth Tests (JWT, refresh, logout)
- Service Tests (Note, Tag, User)
- Middleware Tests (Security, Session, Rate Limiting)
- Integration Tests (Auth flow, Security)
- Migration Tests

## Development

### Reloading Extension After Changes

1. Go to `chrome://extensions/`
2. Find Silence Notes card
3. Click refresh icon (circular arrow)
4. Reopen popup from toolbar

### Backend Hot Reload

The backend does not have hot reload. Rebuild after changes:
```bash
./backend_build.sh
./backend/server
```

### Frontend Watch Mode

For development with automatic rebuilds:
```bash
cd extension
npm run dev
```

## Deployment

### Production Build

```bash
# Frontend
cd extension
npm run build

# Backend
cd backend
go build -o server ./cmd/server/main.go
```

### Environment Variables

**Backend (.env):**
```bash
# Server
SERVER_PORT=8080
SERVER_HOST=0.0.0.0

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=my_notes
DB_USER=postgres
DB_PASSWORD=password
DB_SSLMODE=disable

# JWT
JWT_SECRET=your-secret-key
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# CORS
CORS_ALLOWED_ORIGINS=chrome-extension://*

# Rate Limiting
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=1m
```

## Contributing

### Development Workflow
1. Create feature branch from `main`
2. Follow Test-Driven Development (TDD)
3. Ensure all tests pass
4. Update documentation
5. Submit pull request

### Code Standards
- **Go:** Standard conventions, `gofmt` formatting
- **TypeScript:** Strict mode, ESLint
- **Tests:** >90% coverage required
- **Commits:** Conventional commit messages

## License

MIT License - see LICENSE file for details.

---

**Built with ❤️ using Test-Driven Development and brutalist design principles.**
