# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-01-28

### Added
- **Complete Chrome Extension (Manifest V3)** with React + TypeScript
- **Go REST API backend** with PostgreSQL database
- **Google OAuth 2.0 authentication** via Chrome Identity API
- **JWT-based session management** with automatic token refresh
- **Comprehensive note management system** (CRUD operations with versioning)
- **Hashtag-based tagging system** with clickable filters
- **Real-time search** with debounced input and local filtering
- **Full markdown support** with syntax highlighting (highlight.js)
- **Brutalist design system** with high contrast UI
- **Keyboard shortcuts** (Ctrl+S save, Ctrl+C clear search, Ctrl+F focus search, Ctrl+N new note, Ctrl+B back)
- **Offline capability** with Chrome Storage API and sync queue
- **Virtual scrolling** for large note lists
- **Comprehensive test suites** for frontend and backend
- **Database migrations** with automatic rollback support
- **Security middleware** with rate limiting, CORS, and session management
- **API documentation** (OpenAPI specification)
- **Deployment infrastructure** (Docker, Cloud Run templates)
- **CI/CD pipeline** for backend testing
- **Help page** with comprehensive keyboard shortcuts documentation
- **Lazy loading** for NoteView, NoteEditor, and MarkdownPreview components
- **Code splitting** configuration in webpack
- **Tree-shaking optimization** for lucide-react icons
- **Navigation state tracking** with history management
- **Lucide-react icons** replacing emoji icons
- **Strip hashtags from copied content** feature
- **Copy button** on notes list items
- **Chrome Web Store deployment documentation**
- **Automated migrations** and environment-aware builds
- **Persistent volume** for PostgreSQL data (Docker)

### Changed
- **Moved markdown processing from backend to client-side**
- **Replaced react-syntax-highlighter with highlight.js** for better performance
- **Standardized API response format** across all endpoints
- **Improved navigation state tracking** and view consistency
- **Refactored keyboard shortcuts** to purge unused infrastructure
- **Restructured and expanded documentation** (README.md, CLAUDE.md)
- **Removed export/import feature** from codebase
- **Removed Template feature** (complete purge)
- **Removed UserPreferences feature** from backend
- **Removed SecurityHandler and security endpoints** from backend
- **Removed username/name field** from User model and database
- **Removed auto-save functionality** to restore Enter key behavior in editor
- **Removed confirmation dialogs** for instant note deletion

### Fixed
- **Authentication error handling** in LoginForm
- **Mac platform shortcuts** formatting and normalization
- **SimpleUserProfile** ensuring onLogout callback is called even when logout fails
- **Trailing spaces** after hashtag removal
- **React warnings** by wrapping state updates in act()
- **Chrome extension session reuse** to prevent 429 errors
- **API response parsing** for template application
- **PostgreSQL array handling** for tags
- **Authentication context mismatch** preventing template usage
- **Template duplication** issues
- **Template application response structure parsing**
- **ESLint configuration** for CI/CD
- **Package-lock.json** dependency conflicts
- **CI/CD cache directories** and Node.js caching
- **Migration rollback safety** with idempotency
- **Rate limiter** IP parsing and thread safety
- **CORS handling** with better response headers
- **Mock authentication support** for testing
- **Test TypeScript compilation errors** across all test suites
- **Chrome storage mocks** to use Promise-based API
- **Jest configuration** for Chrome extension testing
- **JavaScript heap memory issues** in Chrome extension auth tests
- **Background service worker** listener registration tests
- **Content script test failures**
- **Duplicate declarations** causing compilation failures
- **Integration test** auth flow adaptations to new API response format
- **Zip export buffer usage**
- **Backend stale code** and debug logging removal

### Security
- **Environment-based configuration** with secrets management
- **Rate limiting middleware** with thread-safe implementation
- **Security middleware** with session management and CORS
- **JWT token validation** with proper expiry checking
- **Chrome Identity API** for secure authentication
- **XSS protection** in markdown rendering
- **Security monitoring** with request logging
- **IP-based rate limiting** to prevent abuse

### Refactor
- **Removed over-engineered mock-factories** and simplified sync tests
- **Streamlined sync tests** and improved API design
- **Overhauled Jest configuration** and reorganized test infrastructure
- **Cleaned up middleware chain** and removed unused code
- **Purged failed OAuth implementation**, kept Chrome Identity API
- **Replaced deprecated ioutil with os** in backend
- **Removed standalone migrate CLI**, use auto-migrations
- **Simplified backend binary output path**
- **Streamlined CLAUDE.md** and fixed build system organization
- **Purged unused Redis and DatabaseSecurity config structures**
- **Removed dead code** from src and src_backup directories
- **Removed unused API utility file**
- **Removed stale code and unused route files** from handlers
- **Removed dead code from AuthHandler**
- **Optimized lucide-react imports** for tree-shaking
- **Converted icon test to TSX** and improved test runner

### Testing
- **Added comprehensive frontend test suite** with React Testing Library
- **Enhanced integration tests** with real PostgreSQL database
- **Improved PostgreSQL integration test infrastructure**
- **Added migrations to service tests**
- **Fixed test isolation** with proper rate limiter cleanup
- **Improved CORS and security middleware test accuracy**
- **Added comprehensive backend test suites** (Notes, Auth, Services, JWT, Middleware, Integration, Migrations)
- **Added test helpers** and setup utilities
- **Improved console output filtering** for tests

### Documentation
- **Added comprehensive project documentation** (CLAUDE.md, README.md)
- **Added Phase 1 implementation plan**
- **Added Phase 5 implementation plan** for enhanced features
- **Added comprehensive Google OAuth 2.0 and JWT setup guide**
- **Added API documentation** (OpenAPI specification)
- **Added deployment documentation** (Cloud Run, Chrome Web Store)
- **Added testing instructions**
- **Added user guide**
- **Added development documentation**
- **Added PostgreSQL documentation**
- **Added tag system roadmap** with API endpoints
- **Added note detail/edit implementation plan**
- **Restructured and expanded README** with comprehensive architecture details
- **Added template feature analysis documentation**
- **Split deployment guide** and prepare for Chrome Web Store
- **Added backend build commands** in CLAUDE.md

### Deployment
- **Added Cloud Run deployment infrastructure** and automation
- **Added automated migrations** and environment-aware builds
- **Added persistent volume** for PostgreSQL data
- **Added backend deploy script** with Docker PostgreSQL
- **Kill existing process on port 8080** before starting backend
- **Run backend server in background** with PID tracking

### Build
- **Added TypeScript preset to Babel configuration**
- **Added code splitting configuration** in webpack
- **Simplified CI/CD workflow** to basic test configuration
- **Removed frontend test pipeline** from CI/CD

### Dependencies
- **Added highlight.js dependency**
- **Bumped eslint-plugin-react-hooks** from 4.6.0 to 4.6.2
- **Updated dependencies** and cleaned up code style

### CI/CD
- **Simplified workflow** to basic test configuration
- **Removed frontend jobs** and focus on backend testing
- **Fixed cache directories** and Node.js caching paths
- **Added package-lock.json to extension directory**
- **Resolved ESLint configuration** issues

### Chore
- **Updated gitignore** and refactor todos file organization
- **Add coverage directories to gitignore**
- **Remove analysis doc** and add backend deploy script
- **Update gitignore** with coverage directories
- **Add sample todos file** for reference

### Workflow
- **Added project management workflows** and task tracking
- **Updated with completed CI/CD package-lock.json fix**

### Removed
- **Export/import feature** from codebase
- **Template feature** - complete purge from codebase
- **UserPreferences feature** from backend
- **SecurityHandler and security endpoints** from backend
- **Unused Google OAuth implementation files**
- **Imaginary TagHandler** and unused TagService methods
- **Unused enhanced tag methods** from NoteService
- **Name field from User model** and database
- **Username/name field references** from handlers and middleware
- **Auto-save functionality** from editor
- **Confirmation dialogs** for note deletion
- **Unused components, workflows, and e2e tests**
- **Standalone migrate CLI** in favor of auto-migrations
- **Over-engineered mock-factories** from sync tests
- **Obsolete TypeScript test files**
- **Dead code from src and src_backup directories**
- **Unused API utility file**
- **Stale code and unused route files** from handlers
- **Dead code and debug logging** from auth handlers
- **Dead code from AuthHandler**
- **Stale code from backend**, replaced deprecated ioutil with os
- **Unused Redis and DatabaseSecurity config structures**
- **Failed OAuth implementation** (kept Chrome Identity API)
- **Unused code** from auth, added security validations
- **Unused keyboard shortcuts infrastructure**
- **Note Service Enhanced Tests** - imaginary code
- **UserHandler** - unused imaginary code
- **Name field** from test files
