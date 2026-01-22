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

## Database Schema

```sql
Users:      id, google_id, email, name, avatar_url
Notes:      id, user_id, title, content, created_at, updated_at
Tags:       id, name
NoteTags:   note_id, tag_id
```

## API Endpoints

```
POST   /api/auth/google        # OAuth login
GET    /api/notes              # List notes
POST   /api/notes              # Create note
PUT    /api/notes/:id          # Update note
DELETE /api/notes/:id          # Delete note
GET    /api/tags               # List tags
GET    /api/search/notes       # Search notes
```

## Development Commands

### Backend (Go)
```bash
go run cmd/server/main.go      # Run server
go test ./...                   # Run tests
```

### Frontend (Extension)
```bash
cd extension
npm run dev                     # Watch mode
npm run build                   # Production build
npm test                        # Run tests
npm run lint                    # Lint code
```

## Code Standards

- Go: standard conventions
- TypeScript: strict mode
- TDD: write tests first
- >90% code coverage
- Conventional commit messages
