# CLAUDE.md - Project Documentation for Silence Notes

## Project Overview

**Silence Notes** is a Chrome extension for note-taking similar to Google Keep, featuring hashtag filtering, Google authentication, and persistent backend storage. The project follows Test-Driven Development (TDD) methodology and implements a brutalist UI design.

### Key Features
- Chrome Extension (Manifest V3) with React + TypeScript
- Note creation, editing, and management with hashtag support
- Google OAuth 2.0 authentication
- Go REST API backend with PostgreSQL database
- Real-time sync between extension and backend
- Brutalist UI design with high contrast and bold typography

## Project Structure

This is currently a **planning and documentation phase** project. The actual implementation has not begun yet - we have comprehensive plans and documentation ready.

### Current State
- ✅ Project initialized with documentation
- ✅ Comprehensive implementation plan created
- ✅ Phase 1 detailed plan established
- ✅ UI style guide defined
- ⏳ Awaiting implementation start

### Planned Project Structure

```
my-notes/
├── backend/                    # Go API server
│   ├── cmd/server/
│   │   └── main.go
│   ├── internal/
│   │   ├── config/
│   │   ├── models/
│   │   ├── handlers/
│   │   ├── middleware/
│   │   ├── database/
│   │   └── services/
│   ├── pkg/
│   ├── migrations/
│   ├── tests/
│   ├── go.mod
│   ├── go.sum
│   └── Dockerfile
├── extension/                  # Chrome Extension
│   ├── manifest.json
│   ├── public/
│   ├── src/
│   │   ├── popup/
│   │   ├── background/
│   │   ├── components/
│   │   ├── types/
│   │   └── utils/
│   ├── tests/
│   ├── package.json
│   ├── tsconfig.json
│   └── webpack.config.js
├── docs/
├── IMPLEMENTATION_PLAN.md
├── PHASE_1_PLAN.md
├── UI_STYLE_GUIDE.md
└── README.md
```

## Architecture

### Technology Stack
- **Frontend**: React + TypeScript (Chrome Extension Manifest V3)
- **Backend**: Go with standard library and minimal dependencies
- **Database**: PostgreSQL with Redis for caching
- **Authentication**: Google OAuth 2.0 with JWT tokens
- **UI**: Tailwind CSS with brutalist design principles
- **Testing**: Jest (frontend), Go testing package (backend)
- **Deployment**: Docker containers

### Data Flow
1. Chrome Extension frontend ↔️ Go REST API ↔️ PostgreSQL Database
2. Google OAuth flow for authentication
3. Redis for session management and caching
4. Local storage in extension for offline capability

## Documentation Summary

### IMPLEMENTATION_PLAN.md
7-week comprehensive implementation plan covering:
- **Phase 1**: Foundation & Core Data Models (Week 1)
- **Phase 2**: Authentication & User Management (Week 2)
- **Phase 3**: Core Note Functionality (Week 3)
- **Phase 4**: Hashtag System & Filtering (Week 4)
- **Phase 5**: Enhanced Features & Polish (Week 5)
- **Phase 6**: Testing & Quality Assurance (Week 6)
- **Phase 7**: Deployment & Release (Week 7)

### PHASE_1_PLAN.md
Detailed day-by-day breakdown for Phase 1:
- **Day 1**: Project Structure & Development Environment
- **Day 2**: Database Schema Design
- **Day 3**: Basic API Structure
- **Day 4**: Configuration Management
- **Day 5**: Database Connection & Pool Management
- **Day 6**: Comprehensive Testing Setup
- **Day 7**: Integration & Documentation

### UI_STYLE_GUIDE.md
Comprehensive design system including:
- **Color Palette**: High-contrast brutalist theme (#FF4D00 primary, #0A0A0A black, #FFFFFF white)
- **Typography**: Archivo (headings) + Inter (body) with dramatic scale
- **Components**: Buttons, inputs, cards with minimal, functional design
- **Spacing**: 4px base unit system
- **Responsive Design**: Mobile-first approach with clear breakpoints

## Development Approach

### Test-Driven Development (TDD)
- All features to be developed with tests first
- >90% code coverage requirement
- Unit tests, integration tests, and end-to-end tests
- Automated testing in CI/CD pipeline

### Development Environment
- Hot reload for both frontend and backend
- Docker Compose for local development
- Automated linting and formatting
- Pre-commit hooks for code quality

## Database Schema (Planned)

### Core Tables
```sql
Users:
- id (UUID, Primary Key)
- google_id (String, Unique)
- email (String, Unique)
- name (String)
- avatar_url (String)
- created_at/updated_at (Timestamps)

Notes:
- id (UUID, Primary Key)
- user_id (UUID, Foreign Key)
- title (String)
- content (Text)
- created_at/updated_at (Timestamps)
- version (Integer for optimistic locking)

Tags:
- id (UUID, Primary Key)
- name (String, Unique)
- created_at (Timestamp)

NoteTags:
- note_id (UUID, Foreign Key)
- tag_id (UUID, Foreign Key)
- created_at (Timestamp)
```

## API Endpoints (Planned)

```
Authentication:
POST /api/auth/google
POST /api/auth/refresh
DELETE /api/auth/logout

Notes:
GET /api/notes
POST /api/notes
GET /api/notes/:id
PUT /api/notes/:id
DELETE /api/notes/:id

Tags:
GET /api/tags
POST /api/tags
GET /api/tags/suggestions

Search:
GET /api/search/notes
GET /api/search/tags
```

## Chrome Extension Features

### Core Functionality
- **Popup Interface**: Quick note creation and viewing
- **Background Script**: Sync and notification handling
- **Content Script**: Page content selection and note creation
- **Options Page**: Settings and preferences management
- **Storage**: Local storage for offline capability

### User Experience
- **Brutalist Design**: High contrast, bold typography, minimal UI
- **Keyboard Shortcuts**: Quick access to common actions
- **Hashtag System**: Simple and powerful organization
- **Search**: Full-text search with hashtag filtering
- **Sync**: Real-time synchronization with backend

## Security Considerations

### Authentication & Authorization
- Google OAuth 2.0 implementation
- JWT token management with refresh tokens
- Secure token storage in Chrome extension
- CORS configuration for Chrome extension origin

### Data Protection
- Input validation and sanitization
- SQL injection prevention
- XSS protection in note content
- HTTPS-only communication
- Environment-based configuration management

## Performance Requirements

### Response Times
- API responses < 500ms
- Search queries < 300ms
- Extension startup < 1 second
- Sync completion < 3 seconds

### Scalability
- Pagination for large note collections
- Database query optimization
- Connection pooling
- Caching strategies

## Next Steps

### Immediate Actions
1. **Set up development environment** - Initialize Go and TypeScript projects
2. **Create database schema** - Implement migration system
3. **Build basic API server** - Health check and basic routing
4. **Set up testing infrastructure** - Test utilities and CI/CD

### Phase 1 Implementation
Following the detailed day-by-day plan in PHASE_1_PLAN.md:
- Day 1: Project initialization and development tools
- Day 2: Database design and migrations
- Day 3: Basic Go API server
- Day 4: Configuration management
- Day 5: Database connection handling
- Day 6: Testing infrastructure
- Day 7: Integration and documentation

## Development Commands (Planned)

### Backend (Go)
```bash
# Development
go run cmd/server/main.go
air  # Hot reload

# Testing
go test ./...
go test -coverprofile=coverage.out ./...

# Quality
go fmt ./...
golangci-lint run
```

### Frontend (Chrome Extension)
```bash
# Development
npm run dev
npm run build

# Testing
npm test
npm run test:coverage

# Linting
npm run lint
npm run type-check
```

### Database
```bash
# Migrations
migrate up
migrate down

# Test database
docker-compose up -d postgres
```

## Contributing Guidelines

### Code Standards
- Follow Go conventions for backend code
- Use TypeScript strict mode for frontend
- Write tests before implementation (TDD)
- Maintain >90% code coverage
- Use conventional commit messages

### Pull Request Process
1. Create feature branch from main
2. Implement tests and functionality
3. Ensure all tests pass
4. Update documentation
5. Submit pull request with detailed description

---

**Note**: This project is currently in the planning phase. All code examples, commands, and structures in this document represent the intended implementation plan rather than current working code.