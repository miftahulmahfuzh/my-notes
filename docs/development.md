# Development Guide

This guide covers the development workflow, coding standards, and best practices for contributing to Silence Notes.

## 🛠️ Development Environment Setup

### Prerequisites

- **Go** 1.21 or higher
- **Node.js** 18 or higher
- **PostgreSQL** 13 or higher
- **Redis** (optional, for caching)
- **Docker** (optional, for development)
- **Git** for version control

### Quick Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/my-notes.git
   cd my-notes
   ```

2. **Run automated setup**
   ```bash
   make setup
   ```
   This script will:
   - Check for required tools
   - Install Go dependencies
   - Install npm dependencies
   - Set up development tools
   - Start database containers

3. **Configure environment**
   ```bash
   cp backend/.env.example backend/.env
   # Edit backend/.env with your settings
   ```

4. **Start development servers**
   ```bash
   # Terminal 1: Backend server
   make dev-backend

   # Terminal 2: Extension build
   make dev-extension
   ```

### Manual Setup

If you prefer manual setup:

#### Backend Setup
```bash
cd backend

# Install Go dependencies
go mod download
go mod tidy

# Install development tools
go install github.com/cosmtrek/air@latest
go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest

# Copy environment file
cp .env.example .env
# Edit .env with your configuration
```

#### Frontend Setup
```bash
cd extension

# Install npm dependencies
npm install

# Run tests to verify setup
npm test
```

#### Database Setup
```bash
# Start PostgreSQL and Redis with Docker
docker-compose -f docker-compose.dev.yml up -d

# Run migrations (auto-applied on server start in dev/test mode)
go run cmd/server/main.go
```

## 📋 Development Workflow

### 1. Create Feature Branch

```bash
# From main branch
git checkout main
git pull origin main

# Create feature branch
git checkout -b feature/note-crud-operations
# or
git checkout -b fix/authentication-bug
```

### 2. Follow Test-Driven Development (TDD)

1. **Write tests first**
   ```bash
   # Backend
   cd backend
   go test ./... -run TestNewFeature

   # Frontend
   cd extension
   npm test -- --testNamePattern="NewFeature"
   ```

2. **Implement minimal code to make tests pass**
   - Write just enough code to satisfy tests
   - Keep implementation simple and focused

3. **Refactor and improve**
   - Clean up code while maintaining test coverage
   - Ensure code follows project standards

### 3. Run Quality Checks

```bash
# Backend
cd backend
go fmt ./...
go vet ./...
golangci-lint run
go test -coverprofile=coverage.out ./...

# Frontend
cd extension
npm run lint
npm run type-check
npm run test:coverage
```

### 4. Commit Changes

Follow [Conventional Commits](https://www.conventionalcommits.org/) specification:

```bash
# Feature
git commit -m "feat(notes): add note creation functionality"

# Bug fix
git commit -m "fix(auth): resolve token expiration issue"

# Documentation
git commit -m "docs(api): update authentication endpoints"

# Refactoring
git commit -m "refactor(database): optimize query performance"

# Test
git commit -m "test(notes): add unit tests for note validation"
```

### 5. Create Pull Request

1. **Push to GitHub**
   ```bash
   git push origin feature/your-feature-name
   ```

2. **Create Pull Request**
   - Use descriptive title
   - Provide detailed description
   - Link related issues
   - Include screenshots if applicable

3. **PR Checklist**
   - [ ] Tests pass (>90% coverage)
   - [ ] Code follows style guidelines
   - [ ] Documentation updated
   - [ ] Manual testing completed
   - [ ] No breaking changes (or clearly documented)

## 🏗️ Project Structure

### Backend Architecture

```
backend/
├── cmd/                    # Applications
│   └── server/            # Main API server (auto-runs migrations in dev/test)
├── internal/              # Private application code
│   ├── config/           # Configuration management
│   ├── database/         # Database connections and migrations
│   ├── handlers/         # HTTP request handlers
│   ├── middleware/       # HTTP middleware
│   ├── models/           # Data models and validation
│   ├── server/           # HTTP server setup
│   └── services/         # Business logic (future)
├── pkg/                  # Public library code
├── migrations/           # Database migration files
├── tests/               # Integration tests
├── go.mod               # Go module definition
└── Dockerfile           # Docker configuration
```

### Frontend Architecture

```
extension/
├── src/                 # TypeScript source code
│   ├── popup/          # Extension popup interface
│   ├── background/     # Background service worker
│   ├── content/        # Content scripts
│   ├── options/        # Options page
│   ├── components/     # Reusable React components
│   ├── types/          # TypeScript type definitions
│   ├── utils/          # Utility functions
│   └── styles/         # CSS/styling
├── public/             # Static assets
├── tests/             # Test files
├── package.json       # npm dependencies
└── webpack.config.js  # Build configuration
```

## 📝 Coding Standards

### Go Backend Standards

#### Code Style
- Follow [Effective Go](https://golang.org/doc/effective_go.html)
- Use `gofmt` for formatting
- Use `golangci-lint` for linting

#### Naming Conventions
```go
// Packages: lowercase, short, descriptive
package handlers

// Constants: UPPER_SNAKE_CASE
const MaxNotesPerPage = 100

// Variables: camelCase
var defaultTimeout = 30 * time.Second

// Functions: camelCase, exported if public
func CreateNote(req *CreateNoteRequest) (*Note, error) {
    // Implementation
}

// Structs: PascalCase, exported if public
type Note struct {
    ID      uuid.UUID `json:"id"`
    Content string    `json:"content"`
}

// Interfaces: PascalCase, usually -er suffix
type NoteCreator interface {
    CreateNote(*CreateNoteRequest) (*Note, error)
}
```

#### Error Handling
```go
// Always handle errors
result, err := someFunction()
if err != nil {
    return nil, fmt.Errorf("failed to create note: %w", err)
}

// Use error wrapping for context
return nil, fmt.Errorf("validation failed: %w", err)

// Create custom error types for specific errors
type ValidationError struct {
    Field   string
    Message string
}

func (e *ValidationError) Error() string {
    return fmt.Sprintf("validation error for %s: %s", e.Field, e.Message)
}
```

#### Testing
```go
// Test file naming: feature_test.go
// Test function naming: TestFunctionName
// Sub-test naming: TestFunctionName/Scenario

func TestNoteValidation(t *testing.T) {
    t.Run("valid note", func(t *testing.T) {
        note := &Note{
            Content: "Valid content",
            UserID:  uuid.New(),
        }

        err := note.Validate()
        assert.NoError(t, err)
    })

    t.Run("missing content", func(t *testing.T) {
        note := &Note{
            Content: "",
            UserID:  uuid.New(),
        }

        err := note.Validate()
        assert.Error(t, err)
        assert.Contains(t, err.Error(), "content is required")
    })
}
```

### TypeScript Frontend Standards

#### Code Style
- Use TypeScript strict mode
- Follow React best practices
- Use ESLint and Prettier for formatting

#### Naming Conventions
```typescript
// Files: kebab-case
note-card.component.tsx
storage.service.ts

// Components: PascalCase
export const NoteCard: React.FC<NoteCardProps> = ({ note }) => {
    // Implementation
};

// Variables and functions: camelCase
const maxNoteLength = 1000;
const createNote = async (content: string): Promise<Note> => {
    // Implementation
};

// Types and interfaces: PascalCase
interface Note {
    id: string;
    content: string;
    createdAt: string;
}

// Constants: UPPER_SNAKE_CASE
const API_BASE_URL = 'http://localhost:8080/api/v1';
```

#### React Best Practices
```typescript
// Use functional components with hooks
export const NoteList: React.FC<NoteListProps> = ({ notes }) => {
    const [selectedNote, setSelectedNote] = useState<Note | null>(null);

    useEffect(() => {
        // Side effects
    }, [dependency]);

    const handleNoteClick = useCallback((note: Note) => {
        setSelectedNote(note);
    }, []);

    return (
        <div className="note-list">
            {notes.map(note => (
                <NoteCard
                    key={note.id}
                    note={note}
                    onClick={handleNoteClick}
                />
            ))}
        </div>
    );
};

// Props interfaces
interface NoteListProps {
    notes: Note[];
    onNoteSelect?: (note: Note) => void;
}
```

#### Error Handling
```typescript
// Use Result types for operations that can fail
type Result<T, E = Error> = {
    success: true;
    data: T;
} | {
    success: false;
    error: E;
};

// Use try-catch with proper error types
const createNote = async (content: string): Promise<Result<Note>> => {
    try {
        const response = await api.post('/notes', { content });
        return { success: true, data: response.data };
    } catch (error) {
        if (error instanceof ValidationError) {
            return { success: false, error };
        }
        return {
            success: false,
            error: new Error('Failed to create note')
        };
    }
};
```

## 🧪 Testing Strategy

### Backend Testing

#### Unit Tests
```go
// Test individual functions and methods
func TestNote_Validate(t *testing.T) {
    tests := []struct {
        name    string
        note    *Note
        wantErr bool
    }{
        {
            name: "valid note",
            note: &Note{
                Content: "Valid content",
                UserID:  uuid.New(),
            },
            wantErr: false,
        },
        // ... more test cases
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            err := tt.note.Validate()
            if (err != nil) != tt.wantErr {
                t.Errorf("Note.Validate() error = %v, wantErr %v", err, tt.wantErr)
            }
        })
    }
}
```

#### Integration Tests
```go
func TestNoteCRUD(t *testing.T) {
    // Setup test database
    db := SetupTestDB(t)
    defer CleanupTestDB(t, db)

    // Test create
    note := CreateTestNote(t, db, userID, "Test Note", "Test content")
    assert.NotEmpty(t, note.ID)

    // Test read
    retrieved, err := GetNote(db, note.ID)
    assert.NoError(t, err)
    assert.Equal(t, note.Content, retrieved.Content)

    // Test update
    err = UpdateNote(db, note.ID, "Updated content")
    assert.NoError(t, err)

    // Test delete
    err = DeleteNote(db, note.ID)
    assert.NoError(t, err)
}
```

#### API Tests
```go
func TestCreateNoteEndpoint(t *testing.T) {
    // Setup test server
    server := SetupTestServer(t)
    defer server.Close()

    // Create request
    payload := map[string]interface{}{
        "content": "Test note content",
    }

    body, _ := json.Marshal(payload)
    req, _ := http.NewRequest("POST", server.URL+"/api/v1/notes", bytes.NewBuffer(body))
    req.Header.Set("Authorization", "Bearer "+testToken)
    req.Header.Set("Content-Type", "application/json")

    // Send request
    resp, err := http.DefaultClient.Do(req)
    require.NoError(t, err)
    defer resp.Body.Close()

    // Verify response
    assert.Equal(t, http.StatusCreated, resp.StatusCode)

    var response map[string]interface{}
    json.NewDecoder(resp.Body).Decode(&response)
    assert.True(t, response["success"].(bool))
    assert.NotNil(t, response["data"])
}
```

### Frontend Testing

#### Component Tests
```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { NoteCard } from './NoteCard';

describe('NoteCard', () => {
    const mockNote: Note = {
        id: 'test-id',
        content: 'Test content',
        createdAt: '2024-01-01T12:00:00Z',
    };

    it('renders note content', () => {
        render(<NoteCard note={mockNote} />);
        expect(screen.getByText('Test content')).toBeInTheDocument();
    });

    it('calls onClick when clicked', () => {
        const mockOnClick = jest.fn();
        render(<NoteCard note={mockNote} onClick={mockOnClick} />);

        fireEvent.click(screen.getByText('Test content'));
        expect(mockOnClick).toHaveBeenCalledWith(mockNote);
    });
});
```

#### Service Tests
```typescript
import { ApiService } from './api.service';

// Mock fetch
global.fetch = jest.fn();

describe('ApiService', () => {
    let apiService: ApiService;

    beforeEach(() => {
        apiService = new ApiService();
        (fetch as jest.Mock).mockClear();
    });

    it('creates note successfully', async () => {
        const mockResponse = {
            success: true,
            data: {
                id: 'test-id',
                content: 'Test content',
            },
        };

        (fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => mockResponse,
        });

        const result = await apiService.createNote({
            content: 'Test content',
        });

        expect(result.success).toBe(true);
        expect(result.data?.content).toBe('Test content');
    });
});
```

## 🔄 Database Development

### Migrations

Migrations are auto-applied on server start in **dev/test mode**. For production:

1. **Create new migration file manually**
   ```bash
   # Create numbered migration files in backend/migrations/
   # e.g., 009_add_note_field.up.sql and 009_add_note_field.down.sql
   ```

2. **Write migration SQL**
   ```sql
   -- 009_add_note_field.up.sql
   ALTER TABLE notes ADD COLUMN new_field VARCHAR(100);

   -- 009_add_note_field.down.sql
   ALTER TABLE notes DROP COLUMN new_field;
   ```

3. **Run migrations** (auto-applied in dev/test, use golang-migrate for production)
   ```bash
   # Install golang-migrate: https://github.com/golang-migrate/migrate
   migrate -path backend/migrations -database "postgres://user:pass@localhost/silence_notes?sslmode=disable" up
   ```

4. **Rollback if needed**
   ```bash
   migrate -path backend/migrations -database "postgres://user:pass@localhost/silence_notes?sslmode=disable" down 1
   ```

### Database Schema Changes

1. **Plan changes carefully** - Consider impact on existing data
2. **Write backwards-compatible migrations** - Allow for rollback
3. **Test migrations thoroughly** - Use test databases
4. **Document changes** - Update schema documentation

### Database Testing

```go
func TestNoteConstraints(t *testing.T) {
    db := SetupTestDB(t)
    defer CleanupTestDB(t, db)

    userID := CreateTestUser(t, db, "test@example.com")

    // Test unique constraint
    noteID1 := CreateTestNote(t, db, userID, "Title", "Content")

    // Try to create duplicate (should fail)
    _, err := db.Exec(`
        INSERT INTO notes (id, user_id, title, content, created_at, updated_at, version)
        VALUES ($1, $2, $3, $4, NOW(), NOW(), 1)
    `, noteID1, userID, "Title", "Content")

    assert.Error(t, err)
}
```

## 🚀 Deployment

### Backend Deployment

1. **Build binary**
   ```bash
   make build-backend
   ```

2. **Docker build**
   ```bash
   docker build -t silence-notes-api .
   ```

3. **Environment setup**
   - Set production environment variables
   - Configure database connections
   - Set up SSL certificates

4. **Run migrations**
   ```bash
   # Use golang-migrate CLI for production
   migrate -path backend/migrations -database "postgres://user:pass@host/silence_notes?sslmode=require" up
   ```

### Extension Deployment

1. **Build for production**
   ```bash
   make build-extension
   ```

2. **Package extension**
   - ZIP the `extension/dist` folder
   - Ensure manifest.json is included

3. **Chrome Web Store**
   - Upload to Chrome Developer Dashboard
   - Submit for review
   - Wait for approval

### CI/CD Pipeline

The project uses GitHub Actions for automated testing and deployment:

```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-go@v4
        with:
          go-version: '1.21'
      - run: make test-backend

  test-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: make test-extension
```

## 📊 Performance Optimization

### Backend Optimization

1. **Database queries**
   - Use prepared statements
   - Add appropriate indexes
   - Use connection pooling

2. **Caching**
   - Cache frequently accessed data
   - Use Redis for session storage
   - Implement HTTP caching headers

3. **API responses**
   - Use pagination for large datasets
   - Compress responses with gzip
   - Minimize JSON payload size

### Frontend Optimization

1. **Bundle size**
   - Code splitting with dynamic imports
   - Tree shaking for unused code
   - Minimize dependencies

2. **Runtime performance**
   - Use React.memo for expensive components
   - Implement virtual scrolling for large lists
   - Optimize re-renders with proper dependency arrays

3. **Network efficiency**
   - Batch API requests
   - Implement request debouncing
   - Use service workers for caching

## 🔍 Debugging

### Backend Debugging

1. **Logging**
   ```go
   log.Printf("Processing note creation for user %s", userID)

   // Structured logging
   log.WithFields(logrus.Fields{
       "user_id": userID,
       "note_id": noteID,
       "action":  "create",
   }).Info("Note created successfully")
   ```

2. **Debug endpoints**
   ```go
   // Add debug endpoint for development
   if config.IsDevelopment() {
       api.HandleFunc("/debug/config", s.debugConfigHandler).Methods("GET")
   }
   ```

3. **Database debugging**
   ```go
   // Log SQL queries in development
   if config.IsDevelopment() {
       db.SetLogger(log.New(os.Stdout, "DB: ", log.LstdFlags))
   }
   ```

### Frontend Debugging

1. **Chrome DevTools**
   - Use React Developer Tools
   - Debug service workers in Application tab
   - Monitor network requests

2. **Logging**
   ```typescript
   if (process.env.NODE_ENV === 'development') {
       console.log('Creating note:', content);
   }

   // Use proper logging library
   logger.debug('Creating note', { content, userID });
   ```

3. **Error boundaries**
   ```typescript
   class ErrorBoundary extends React.Component {
       constructor(props) {
           super(props);
           this.state = { hasError: false };
       }

       static getDerivedStateFromError(error) {
           return { hasError: true };
       }

       componentDidCatch(error, errorInfo) {
           console.error('Error caught by boundary:', error, errorInfo);
       }

       render() {
           if (this.state.hasError) {
               return <h1>Something went wrong.</h1>;
           }
           return this.props.children;
       }
   }
   ```

## 📚 Additional Resources

### Documentation
- [Go Documentation](https://golang.org/doc/)
- [React Documentation](https://react.dev/)
- [Chrome Extension API](https://developer.chrome.com/docs/extensions/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

### Tools
- [golangci-lint](https://golangci-lint.run/) - Go linting
- [ESLint](https://eslint.org/) - JavaScript/TypeScript linting
- [Prettier](https://prettier.io/) - Code formatting
- [Jest](https://jestjs.io/) - JavaScript testing
- [Testify](https://github.com/stretchr/testify) - Go testing

### Best Practices
- [12-Factor App](https://12factor.net/)
- [Clean Code](https://www.amazon.com/Clean-Code-Handbook-Software-Craftsmanship/dp/0132350884)
- [Test-Driven Development](https://www.amazon.com/Test-Driven-Development-Kent-Beck/dp/0321146530)