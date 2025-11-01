# Silence Notes

A brutalist Chrome extension for note-taking with hashtag filtering, Google authentication, and persistent backend storage.

## 🚀 Project Overview

**Silence Notes** is a modern note-taking application that brings simplicity and power together. Built with a brutalist design philosophy, it offers:

- **Chrome Extension** (Manifest V3) with React + TypeScript
- **Go REST API** backend with PostgreSQL database
- **Google OAuth 2.0** authentication
- **Hashtag-based organization** with powerful filtering
- **Real-time sync** between extension and backend
- **Test-Driven Development** with comprehensive test coverage

## 📋 Features

### Core Functionality
- ✅ Create, edit, and delete notes
- ✅ Hashtag extraction and automatic organization
- ✅ Search notes by content and hashtags
- ✅ Google authentication with secure token management
- ✅ Real-time synchronization
- ✅ Offline capability with local storage

### User Experience
- 🎨 **Brutalist Design** - High contrast, bold typography, minimal UI
- ⌨️ **Keyboard Shortcuts** - Quick access to common actions
- 🔍 **Powerful Search** - Full-text search with hashtag filtering
- 📱 **Responsive Design** - Works across different screen sizes
- 🔄 **Auto-sync** - Seamless background synchronization

## 🏗️ Architecture

### Technology Stack
- **Frontend**: React + TypeScript (Chrome Extension)
- **Backend**: Go with standard library
- **Database**: PostgreSQL with Redis for caching
- **Authentication**: Google OAuth 2.0 with JWT tokens
- **UI**: Tailwind CSS with brutalist design principles
- **Testing**: Jest (frontend), Go testing (backend)

### Project Structure
```
my-notes/
├── backend/                    # Go API server
│   ├── cmd/server/            # Main application entry point
│   ├── internal/              # Private application code
│   │   ├── config/           # Configuration management
│   │   ├── database/         # Database connections and migrations
│   │   ├── handlers/         # HTTP request handlers
│   │   ├── middleware/       # HTTP middleware
│   │   ├── models/           # Data models and validation
│   │   └── server/           # HTTP server setup
│   ├── migrations/           # Database migration files
│   ├── tests/               # Test files
│   └── go.mod               # Go module definition
├── extension/                # Chrome Extension
│   ├── src/                 # TypeScript source code
│   │   ├── popup/          # Extension popup interface
│   │   ├── background/     # Background service worker
│   │   ├── content/        # Content scripts
│   │   ├── options/        # Options page
│   │   ├── components/     # Reusable React components
│   │   ├── types/          # TypeScript type definitions
│   │   └── utils/          # Utility functions
│   ├── public/             # Static assets
│   ├── tests/             # Test files
│   └── package.json       # npm dependencies
├── docs/                  # Documentation
├── scripts/               # Development and deployment scripts
├── docker-compose.dev.yml # Development Docker setup
└── Makefile              # Development commands
```

## 🚀 Quick Start

### Prerequisites
- **Go** 1.21 or higher
- **Node.js** 18 or higher
- **PostgreSQL** 13 or higher
- **Redis** (optional, for caching)
- **Docker** (optional, for development)

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/my-notes.git
   cd my-notes
   ```

2. **Run the setup script**
   ```bash
   make setup
   # or
   ./scripts/setup-dev.sh
   ```

3. **Configure environment variables**
   ```bash
   cp backend/.env.example backend/.env
   # Edit backend/.env with your configuration
   ```

4. **Start development environment**
   ```bash
   # Start databases with Docker
   make docker-up

   # Start backend server
   make dev-backend

   # Build extension
   make dev-extension
   ```

5. **Load the extension in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select `extension/dist`
   - The Silence Notes icon should appear in your toolbar

### Development Commands

```bash
# Setup and dependencies
make setup              # Run full setup
make deps              # Install dependencies

# Development
make dev               # Start both backend and build extension
make dev-backend       # Start backend with hot reload
make dev-extension     # Build extension in watch mode

# Building
make build             # Build both projects
make build-backend     # Build backend binary
make build-extension   # Build extension for production

# Testing
make test              # Run all tests
make test-backend      # Run backend tests
make test-extension    # Run extension tests
make coverage          # Generate coverage reports

# Quality
make lint              # Run linting for both projects
make format            # Format all code

# Docker
make docker-up         # Start development containers
make docker-down       # Stop development containers
make docker-logs       # Show container logs

# Cleanup
make clean             # Clean build artifacts
```

## 🧪 Testing

### Backend Tests
```bash
cd backend
go test ./...                           # Run all tests
go test -v ./...                        # Run with verbose output
go test -coverprofile=coverage.out ./... # Generate coverage
go tool cover -html=coverage.out        # View coverage in browser
```

### Frontend Tests
```bash
cd extension
npm test                                 # Run tests
npm run test:coverage                   # Run with coverage
npm run lint                           # Run linting
```

### Test Database
The project automatically creates isolated test databases for testing. No manual database setup required for tests.

## 📊 Database Schema

### Core Tables

#### Users
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

#### Notes
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

#### Tags
```sql
CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### NoteTags (Junction Table)
```sql
CREATE TABLE note_tags (
    note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (note_id, tag_id)
);
```

## 🔌 API Endpoints

### Health Check
- `GET /api/v1/health` - Check API health status

### Authentication (Phase 2)
- `POST /api/v1/auth/google` - Google OAuth login
- `POST /api/v1/auth/refresh` - Refresh access token
- `DELETE /api/v1/auth/logout` - Logout user

### Notes (Phase 3)
- `GET /api/v1/notes` - Get user's notes
- `POST /api/v1/notes` - Create new note
- `GET /api/v1/notes/{id}` - Get specific note
- `PUT /api/v1/notes/{id}` - Update note
- `DELETE /api/v1/notes/{id}` - Delete note

### Tags (Phase 4)
- `GET /api/v1/tags` - Get user's tags
- `POST /api/v1/tags` - Create new tag
- `GET /api/v1/tags/suggestions` - Get tag suggestions

### Search (Phase 4)
- `GET /api/v1/search/notes` - Search notes
- `GET /api/v1/search/tags` - Search tags

## 🎨 UI Design

### Brutalist Design Principles
- **High Contrast**: Bold black and white with orange accents
- **Bold Typography**: Archivo (headings) + Inter (body)
- **Minimal UI**: No unnecessary decorations
- **Sharp Edges**: No rounded corners, thick borders
- **Functional**: Every element serves a purpose

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
- **Headings**: Archivo (900, 700, 400 weights)
- **Body**: Inter (600, 400 weights)
- **Dramatic scale**: 36px → 28px → 24px → 18px → 16px → 14px

## 🔒 Security

### Authentication & Authorization
- Google OAuth 2.0 implementation
- JWT tokens with refresh mechanism
- Secure token storage in Chrome extension
- CORS configuration for Chrome extension origins

### Data Protection
- Input validation and sanitization
- SQL injection prevention
- XSS protection in note content
- HTTPS-only communication
- Environment-based configuration management

## 📈 Performance

### Response Times
- API responses < 500ms
- Search queries < 300ms
- Extension startup < 1 second
- Sync completion < 3 seconds

### Optimization Strategies
- Database query optimization
- Connection pooling
- Pagination for large datasets
- Lazy loading
- Caching strategies

## 🐳 Docker Development

### Development Environment
```bash
# Start development containers
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f

# Stop containers
docker-compose -f docker-compose.dev.yml down
```

### Container Services
- **PostgreSQL**: Database server
- **Redis**: Caching and session storage
- **Backend**: Go API server with hot reload

## 📚 Documentation

- [**Implementation Plan**](./IMPLEMENTATION_PLAN.md) - 7-week development roadmap
- [**Phase 1 Plan**](./PHASE_1_PLAN.md) - Detailed breakdown of initial development
- [**UI Style Guide**](./UI_STYLE_GUIDE.md) - Comprehensive design system
- [**API Documentation**](./docs/api.md) - API reference
- [**Development Guide**](./docs/development.md) - Development setup and workflows

## 🗺️ Roadmap

### Phase 1: Foundation ✅
- [x] Project structure and development environment
- [x] Database schema with migrations
- [x] Basic API server with middleware
- [x] Configuration management
- [x] Database connection management
- [x] Testing infrastructure

### Phase 2: Authentication & User Management (Next)
- [ ] Google OAuth integration
- [ ] Chrome extension authentication
- [ ] User profile management
- [ ] Token management

### Phase 3: Core Note Functionality
- [ ] Note CRUD operations
- [ ] Basic frontend interface
- [ ] Local storage and sync
- [ ] Offline capability

### Phase 4: Hashtag System & Filtering
- [ ] Hashtag extraction and storage
- [ ] Advanced filtering UI
- [ ] Search functionality
- [ ] Tag management

### Phase 5: Enhanced Features & Polish
- [ ] Rich text with markdown support
- [ ] Keyboard shortcuts
- [ ] User experience enhancements
- [ ] Performance optimization

### Phase 6: Testing & Quality Assurance
- [ ] Comprehensive testing suite
- [ ] Security review
- [ ] Error handling and monitoring
- [ ] Documentation

### Phase 7: Deployment & Release
- [ ] Backend deployment
- [ ] Chrome extension release
- [ ] Post-launch support
- [ ] Analytics and monitoring

## 🤝 Contributing

### Development Workflow
1. Create feature branch from main
2. Follow Test-Driven Development (TDD)
3. Ensure all tests pass (>90% coverage)
4. Update documentation
5. Submit pull request with detailed description

### Code Standards
- Follow Go conventions for backend
- Use TypeScript strict mode for frontend
- Write tests before implementation
- Maintain high code coverage
- Use conventional commit messages

### Pull Request Process
1. Fork the repository
2. Create feature branch
3. Implement tests and functionality
4. Ensure quality checks pass
5. Update documentation
6. Submit PR with comprehensive description

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Google Chrome Extension API** for extension capabilities
- **Gorilla Mux** for HTTP routing
- **PostgreSQL** for reliable data storage
- **React** for component-based UI
- **Tailwind CSS** for utility-first styling

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/your-username/my-notes/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-username/my-notes/discussions)
- **Email**: your-email@example.com

---

**Built with ❤️ using Test-Driven Development and brutalist design principles.**