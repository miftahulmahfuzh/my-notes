# Phase 1 Detailed Implementation Plan: Foundation Setup & Core Data Models

## Phase Overview

**Duration**: 7 Days
**Objective**: Establish the project foundation with proper development environment, database schema, and basic API structure following TDD principles.
**Success Criteria**: All tests pass, development environment is fully functional, and basic API responds to health checks.

## Clear Objectives & Goals

### Primary Goals
1. ✅ Set up complete development environment with hot reload capabilities
2. ✅ Design and implement database schema with migration system
3. ✅ Create basic Go API server with proper structure
4. ✅ Establish testing frameworks and write initial test suite
5. ✅ Implement project structure following best practices

### Success Metrics
- [ ] Development environment starts without errors
- [ ] Database migrations run successfully
- [ ] All unit tests pass (>90% coverage)
- [ ] API health check endpoint responds correctly
- [ ] Code quality tools run without warnings
- [ ] Project follows established Go and TypeScript conventions

---

## Day 1: Project Structure & Development Environment

### Objectives
- Initialize both frontend and backend projects
- Configure development tools and hot reload
- Set up testing frameworks
- Establish project conventions

### Tasks & Implementation Steps

#### 1.1 Backend Project Setup (Go)
```
my-notes-backend/
├── cmd/
│   └── server/
│       └── main.go
├── internal/
│   ├── config/
│   ├── models/
│   ├── handlers/
│   ├── middleware/
│   ├── database/
│   └── services/
├── pkg/
├── migrations/
├── tests/
├── go.mod
├── go.sum
├── Dockerfile
└── README.md
```

#### 1.2 Frontend Project Setup (Chrome Extension)
```
my-notes-extension/
├── manifest.json
├── public/
├── src/
│   ├── popup/
│   ├── background/
│   ├── components/
│   ├── types/
│   └── utils/
├── tests/
├── package.json
├── tsconfig.json
├── webpack.config.js
└── README.md
```

#### 1.3 Development Tools Configuration
- Go: Air for hot reload, golangci-lint for linting
- TypeScript: ESLint, Prettier, Husky for git hooks
- Docker: Docker Compose for local development
- VS Code: Recommended extensions and settings

### Test Cases - Day 1

#### Test Case 1.1: Project Structure Validation
```go
// tests/structure_test.go
func TestProjectStructure(t *testing.T) {
    requiredDirs := []string{
        "cmd/server",
        "internal/config",
        "internal/models",
        "internal/handlers",
        "migrations",
        "tests",
    }

    for _, dir := range requiredDirs {
        if _, err := os.Stat(dir); os.IsNotExist(err) {
            t.Errorf("Required directory %s does not exist", dir)
        }
    }
}
```

#### Test Case 1.2: Dependencies Installation
```go
// tests/dependencies_test.go
func TestDependenciesInstalled(t *testing.T) {
    cmd := exec.Command("go", "mod", "verify")
    if err := cmd.Run(); err != nil {
        t.Errorf("Go modules verification failed: %v", err)
    }
}
```

#### Test Case 1.3: Development Tools Configuration
```javascript
// frontend/tests/config.test.ts
describe('Development Configuration', () => {
  test('TypeScript configuration is valid', () => {
    // Verify tsconfig.json is valid
  });

  test('Webpack configuration loads correctly', () => {
    // Verify webpack config compiles
  });
});
```

### Expected Behaviors
- Projects structure follows Go and TypeScript best practices
- All development tools install without errors
- Hot reload works for both frontend and backend
- Linting and formatting tools run successfully

---

## Day 2: Database Schema Design

### Objectives
- Design normalized database schema
- Create migration system
- Set up PostgreSQL database
- Design core data models

### Database Schema Design

#### Users Table
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

CREATE INDEX idx_users_google_id ON users(google_id);
CREATE INDEX idx_users_email ON users(email);
```

#### Notes Table
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

CREATE INDEX idx_notes_user_id ON notes(user_id);
CREATE INDEX idx_notes_created_at ON notes(created_at);
CREATE INDEX idx_notes_updated_at ON notes(updated_at);
```

#### Tags Table
```sql
CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_tags_name ON tags(name);
```

#### NoteTags Junction Table
```sql
CREATE TABLE note_tags (
    note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (note_id, tag_id)
);

CREATE INDEX idx_note_tags_note_id ON note_tags(note_id);
CREATE INDEX idx_note_tags_tag_id ON note_tags(tag_id);
```

### Test Cases - Day 2

#### Test Case 2.1: Migration System
```go
// tests/migrations_test.go
func TestMigrationSystem(t *testing.T) {
    db := setupTestDB(t)
    defer cleanupTestDB(t, db)

    // Test up migration
    err := MigrateUp(db, "migrations")
    assert.NoError(t, err)

    // Verify tables exist
    var tableName string
    err = db.QueryRow(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'users'
    `).Scan(&tableName)
    assert.NoError(t, err)
    assert.Equal(t, "users", tableName)
}
```

#### Test Case 2.2: Data Model Validation
```go
// tests/models_test.go
func TestUserModel(t *testing.T) {
    user := &User{
        GoogleID: "google_123",
        Email:    "test@example.com",
        Name:     "Test User",
    }

    // Test validation
    err := user.Validate()
    assert.NoError(t, err)

    // Test required fields
    user.Email = ""
    err = user.Validate()
    assert.Error(t, err)
    assert.Contains(t, err.Error(), "email is required")
}
```

#### Test Case 2.3: Database Constraints
```go
// tests/constraints_test.go
func TestDatabaseConstraints(t *testing.T) {
    db := setupTestDB(t)
    defer cleanupTestDB(t, db)

    // Test unique constraint on email
    user1 := createTestUser(t, db, "test@example.com")
    user2 := &User{Email: "test@example.com", GoogleID: "google_456", Name: "User 2"}

    err := CreateUser(db, user2)
    assert.Error(t, err) // Should fail due to unique constraint
}
```

### Expected Behaviors
- Database schema is properly normalized
- All constraints are enforced by the database
- Migration system can create and rollback schema changes
- Data models validate input correctly
- Foreign key relationships maintain data integrity

---

## Day 3: Basic API Structure

### Objectives
- Set up Go server with routing
- Implement middleware for CORS, logging, errors
- Create health check endpoint
- Establish API structure and conventions

### API Structure Design

#### Server Configuration
```go
// cmd/server/main.go
type Server struct {
    config *config.Config
    router *mux.Router
    db     *sql.DB
}

func NewServer(cfg *config.Config, db *sql.DB) *Server {
    s := &Server{
        config: cfg,
        router: mux.NewRouter(),
        db:     db,
    }

    s.setupMiddleware()
    s.setupRoutes()
    return s
}
```

#### Middleware Stack
```go
// internal/middleware/middleware.go
func (s *Server) setupMiddleware() {
    s.router.Use(s.loggingMiddleware)
    s.router.Use(s.corsMiddleware)
    s.router.Use(s.recoveryMiddleware)
    s.router.Use(s.requestIDMiddleware)
}
```

#### Routes Structure
```go
// internal/routes/routes.go
func (s *Server) setupRoutes() {
    api := s.router.PathPrefix("/api/v1").Subrouter()

    // Health check
    api.HandleFunc("/health", s.healthHandler).Methods("GET")

    // Future routes will be added here
    // api.HandleFunc("/auth/google", s.googleAuthHandler).Methods("POST")
    // api.HandleFunc("/notes", s.notesHandler).Methods("GET", "POST")
}
```

### Test Cases - Day 3

#### Test Case 3.1: Server Initialization
```go
// tests/server_test.go
func TestServerInitialization(t *testing.T) {
    config := &config.Config{
        Port:     8080,
        Database: database.TestConfig(),
    }

    db := setupTestDB(t)
    defer cleanupTestDB(t, db)

    server := NewServer(config, db)
    assert.NotNil(t, server)
    assert.NotNil(t, server.router)
    assert.Equal(t, config, server.config)
}
```

#### Test Case 3.2: Health Check Endpoint
```go
// tests/health_test.go
func TestHealthEndpoint(t *testing.T) {
    server := setupTestServer(t)
    defer server.Close()

    resp, err := http.Get(server.URL + "/api/v1/health")
    assert.NoError(t, err)
    assert.Equal(t, http.StatusOK, resp.StatusCode)

    var health HealthResponse
    err = json.NewDecoder(resp.Body).Decode(&health)
    assert.NoError(t, err)
    assert.Equal(t, "ok", health.Status)
    assert.NotEmpty(t, health.Timestamp)
}
```

#### Test Case 3.3: Middleware Functionality
```go
// tests/middleware_test.go
func TestCORSHeaders(t *testing.T) {
    server := setupTestServer(t)
    defer server.Close()

    req, _ := http.NewRequest("OPTIONS", server.URL+"/api/v1/health", nil)
    req.Header.Set("Origin", "chrome-extension://test")

    resp, err := http.DefaultClient.Do(req)
    assert.NoError(t, err)
    assert.Equal(t, http.StatusOK, resp.StatusCode)
    assert.Equal(t, "chrome-extension://test", resp.Header.Get("Access-Control-Allow-Origin"))
}
```

### Expected Behaviors
- Server starts on configured port without errors
- Health check returns 200 status with service information
- CORS headers are properly set for Chrome extension
- All requests receive unique IDs for tracing
- Errors are properly logged and formatted

---

## Day 4: Configuration Management

### Objectives
- Implement environment-based configuration
- Add configuration validation
- Support different environments (dev, test, prod)
- Secure handling of sensitive data

### Configuration Structure

#### Config File Structure
```go
// internal/config/config.go
type Config struct {
    Server   ServerConfig   `yaml:"server"`
    Database DatabaseConfig `yaml:"database"`
    Redis    RedisConfig    `yaml:"redis"`
    Auth     AuthConfig     `yaml:"auth"`
    App      AppConfig      `yaml:"app"`
}

type ServerConfig struct {
    Port         string `yaml:"port" env:"SERVER_PORT" envDefault:"8080"`
    Host         string `yaml:"host" env:"SERVER_HOST" envDefault:"localhost"`
    ReadTimeout  int    `yaml:"read_timeout" env:"READ_TIMEOUT" envDefault:"30"`
    WriteTimeout int    `yaml:"write_timeout" env:"WRITE_TIMEOUT" envDefault:"30"`
}

type DatabaseConfig struct {
    Host     string `yaml:"host" env:"DB_HOST" envDefault:"localhost"`
    Port     int    `yaml:"port" env:"DB_PORT" envDefault:"5432"`
    Name     string `yaml:"name" env:"DB_NAME" envDefault:"notes_dev"`
    User     string `yaml:"user" env:"DB_USER" envDefault:"postgres"`
    Password string `yaml:"password" env:"DB_PASSWORD" envRequired:"true"`
    SSLMode  string `yaml:"ssl_mode" env:"DB_SSLMODE" envDefault:"disable"`
}
```

### Test Cases - Day 4

#### Test Case 4.1: Configuration Loading
```go
// tests/config_test.go
func TestConfigLoading(t *testing.T) {
    // Test loading from file
    config, err := config.LoadConfig("testdata/config.yaml")
    assert.NoError(t, err)
    assert.Equal(t, "8080", config.Server.Port)
    assert.Equal(t, "notes_dev", config.Database.Name)

    // Test environment variable override
    t.Setenv("SERVER_PORT", "9000")
    config, err = config.LoadConfig("testdata/config.yaml")
    assert.NoError(t, err)
    assert.Equal(t, "9000", config.Server.Port)
}
```

#### Test Case 4.2: Configuration Validation
```go
// tests/config_validation_test.go
func TestConfigValidation(t *testing.T) {
    config := &config.Config{
        Database: config.DatabaseConfig{
            Host:     "",
            Password: "",
        },
    }

    err := config.Validate()
    assert.Error(t, err)
    assert.Contains(t, err.Error(), "database host is required")
    assert.Contains(t, err.Error(), "database password is required")
}
```

#### Test Case 4.3: Environment Detection
```go
// tests/environment_test.go
func TestEnvironmentDetection(t *testing.T) {
    t.Setenv("ENVIRONMENT", "test")

    config, err := config.LoadConfig("")
    assert.NoError(t, err)
    assert.Equal(t, "test", config.App.Environment)
    assert.True(t, config.App.IsTest())
    assert.False(t, config.App.IsProduction())
}
```

### Expected Behaviors
- Configuration loads from YAML files and environment variables
- Environment variables override file configurations
- Required fields are validated on startup
- Sensitive data is handled securely
- Different environments have appropriate defaults

---

## Day 5: Database Connection & Pool Management

### Objectives
- Implement robust database connection management
- Add connection pooling with proper configuration
- Handle database errors gracefully
- Implement connection health checks

### Database Connection Setup

#### Connection Pool Configuration
```go
// internal/database/database.go
func NewConnection(cfg config.DatabaseConfig) (*sql.DB, error) {
    dsn := fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
        cfg.Host, cfg.Port, cfg.User, cfg.Password, cfg.Name, cfg.SSLMode)

    db, err := sql.Open("postgres", dsn)
    if err != nil {
        return nil, fmt.Errorf("failed to open database: %w", err)
    }

    // Configure connection pool
    db.SetMaxOpenConns(25)
    db.SetMaxIdleConns(5)
    db.SetConnMaxLifetime(5 * time.Minute)

    // Test connection
    if err := db.Ping(); err != nil {
        return nil, fmt.Errorf("failed to ping database: %w", err)
    }

    return db, nil
}
```

### Test Cases - Day 5

#### Test Case 5.1: Database Connection
```go
// tests/database_connection_test.go
func TestDatabaseConnection(t *testing.T) {
    cfg := config.DatabaseConfig{
        Host:     "localhost",
        Port:     5432,
        User:     "test_user",
        Password: "test_pass",
        Name:     "test_db",
        SSLMode:  "disable",
    }

    db, err := database.NewConnection(cfg)
    assert.NoError(t, err)
    assert.NotNil(t, db)

    // Test connection works
    err = db.Ping()
    assert.NoError(t, err)

    db.Close()
}
```

#### Test Case 5.2: Connection Pool Configuration
```go
// tests/connection_pool_test.go
func TestConnectionPoolConfiguration(t *testing.T) {
    db := setupTestDB(t)
    defer cleanupTestDB(t, db)

    stats := db.Stats()
    assert.Equal(t, 0, stats.OpenConnections)
    assert.Equal(t, 25, stats.MaxOpenConnections)
    assert.Equal(t, 5, stats.MaxIdleConnections)

    // Test connection reuse
    conn1, err := db.Conn(context.Background())
    assert.NoError(t, err)

    conn2, err := db.Conn(context.Background())
    assert.NoError(t, err)

    conn1.Close()
    conn2.Close()
}
```

#### Test Case 5.3: Database Error Handling
```go
// tests/database_errors_test.go
func TestDatabaseErrorHandling(t *testing.T) {
    cfg := config.DatabaseConfig{
        Host:     "nonexistent",
        Port:     5432,
        User:     "test_user",
        Password: "test_pass",
        Name:     "test_db",
    }

    db, err := database.NewConnection(cfg)
    assert.Error(t, err)
    assert.Nil(t, db)
    assert.Contains(t, err.Error(), "failed to ping database")
}
```

### Expected Behaviors
- Database connections are established with proper configuration
- Connection pool limits are respected
- Failed connections are handled gracefully
- Database health is monitored continuously
- Resources are cleaned up properly

---

## Day 6: Comprehensive Testing Setup

### Objectives
- Set up complete testing infrastructure
- Implement test utilities and helpers
- Create test database management
- Establish testing best practices

### Testing Infrastructure

#### Test Database Setup
```go
// tests/setup_test.go
func setupTestDB(t *testing.T) *sql.DB {
    t.Helper()

    cfg := config.DatabaseConfig{
        Host:     "localhost",
        Port:     5432,
        User:     "test_user",
        Password: "test_pass",
        Name:     fmt.Sprintf("notes_test_%d", time.Now().UnixNano()),
        SSLMode:  "disable",
    }

    // Create test database
    db, err := database.CreateTestDatabase(cfg)
    require.NoError(t, err)

    // Run migrations
    err = MigrateUp(db, "migrations")
    require.NoError(t, err)

    return db
}

func cleanupTestDB(t *testing.T, db *sql.DB) {
    t.Helper()
    database.DropTestDatabase(db)
}
```

#### Test Utilities
```go
// tests/utils.go
func createTestUser(t *testing.T, db *sql.DB, email string) *User {
    t.Helper()

    user := &User{
        GoogleID: fmt.Sprintf("google_%d", time.Now().UnixNano()),
        Email:    email,
        Name:     "Test User",
    }

    err := CreateUser(db, user)
    require.NoError(t, err)

    return user
}

func assertJSONResponse(t *testing.T, resp *http.Response, expected interface{}) {
    t.Helper()

    body, err := io.ReadAll(resp.Body)
    require.NoError(t, err)

    expectedJSON, err := json.Marshal(expected)
    require.NoError(t, err)

    assert.JSONEq(t, string(expectedJSON), string(body))
}
```

### Test Cases - Day 6

#### Test Case 6.1: Test Database Lifecycle
```go
// tests/test_database_lifecycle_test.go
func TestTestDatabaseLifecycle(t *testing.T) {
    db := setupTestDB(t)

    // Verify database is usable
    var count int
    err := db.QueryRow("SELECT COUNT(*) FROM users").Scan(&count)
    assert.NoError(t, err)
    assert.Equal(t, 0, count)

    cleanupTestDB(t, db)

    // Verify database is cleaned up
    _, err = db.Query("SELECT COUNT(*) FROM users")
    assert.Error(t, err) // Connection should be closed
}
```

#### Test Case 6.2: Test Utilities
```go
// tests/test_utils_test.go
func TestCreateTestUser(t *testing.T) {
    db := setupTestDB(t)
    defer cleanupTestDB(t, db)

    user := createTestUser(t, db, "test@example.com")
    assert.NotEmpty(t, user.ID)
    assert.Equal(t, "test@example.com", user.Email)

    // Verify user was actually created in database
    var count int
    err := db.QueryRow("SELECT COUNT(*) FROM users WHERE email = $1", user.Email).Scan(&count)
    assert.NoError(t, err)
    assert.Equal(t, 1, count)
}
```

#### Test Case 6.3: Integration Test Structure
```go
// tests/integration/integration_test.go
func TestAPIIntegration(t *testing.T) {
    server := setupTestServer(t)
    db := setupTestDB(t)
    defer cleanupTestDB(t, db)
    defer server.Close()

    // Test complete request flow
    req, _ := http.NewRequest("GET", server.URL+"/api/v1/health", nil)
    resp, err := http.DefaultClient.Do(req)
    assert.NoError(t, err)
    assert.Equal(t, http.StatusOK, resp.StatusCode)
}
```

### Expected Behaviors
- Test databases are created and destroyed automatically
- Test utilities simplify common test scenarios
- All tests run in isolation
- Test execution is fast and reliable
- Code coverage is measured and reported

---

## Day 7: Integration & Documentation

### Objectives
- Integrate all components together
- Create comprehensive documentation
- Verify end-to-end functionality
- Prepare for Phase 2 development

### Integration Tasks

#### Complete Application Assembly
```go
// cmd/server/main.go
func main() {
    // Load configuration
    cfg, err := config.LoadConfig("")
    if err != nil {
        log.Fatalf("Failed to load config: %v", err)
    }

    // Validate configuration
    if err := cfg.Validate(); err != nil {
        log.Fatalf("Invalid config: %v", err)
    }

    // Initialize database
    db, err := database.NewConnection(cfg.Database)
    if err != nil {
        log.Fatalf("Failed to connect to database: %v", err)
    }
    defer db.Close()

    // Create server
    server := NewServer(cfg, db)

    // Start server
    log.Printf("Starting server on %s:%s", cfg.Server.Host, cfg.Server.Port)
    if err := server.Start(); err != nil {
        log.Fatalf("Failed to start server: %v", err)
    }
}
```

### Test Cases - Day 7

#### Test Case 7.1: Complete Application Startup
```go
// tests/e2e/e2e_test.go
func TestApplicationStartup(t *testing.T) {
    // Test complete application lifecycle
    cmd := exec.Command("go", "run", "cmd/server/main.go")
    cmd.Env = append(os.Environ(), "SERVER_PORT=9999")

    // Start server in background
    if err := cmd.Start(); err != nil {
        t.Fatal(err)
    }
    defer cmd.Process.Kill()

    // Wait for server to start
    time.Sleep(2 * time.Second)

    // Test health endpoint
    resp, err := http.Get("http://localhost:9999/api/v1/health")
    assert.NoError(t, err)
    assert.Equal(t, http.StatusOK, resp.StatusCode)
}
```

#### Test Case 7.2: Documentation Validation
```go
// tests/docs_test.go
func TestDocumentationExists(t *testing.T) {
    requiredFiles := []string{
        "README.md",
        "docs/api.md",
        "docs/database.md",
        "docs/development.md",
    }

    for _, file := range requiredFiles {
        if _, err := os.Stat(file); os.IsNotExist(err) {
            t.Errorf("Required documentation file %s does not exist", file)
        }
    }
}
```

#### Test Case 7.3: Quality Gates
```go
// tests/quality_test.go
func TestCodeQuality(t *testing.T) {
    // Test code formatting
    cmd := exec.Command("go", "fmt", "./...")
    if err := cmd.Run(); err != nil {
        t.Error("Code is not properly formatted")
    }

    // Test linting
    cmd = exec.Command("golangci-lint", "run")
    if err := cmd.Run(); err != nil {
        t.Error("Code linting failed")
    }

    // Test test coverage
    cmd = exec.Command("go", "test", "-coverprofile=coverage.out", "./...")
    if err := cmd.Run(); err != nil {
        t.Error("Tests failed")
    }
}
```

### Expected Behaviors
- Complete application starts without errors
- All components integrate seamlessly
- Documentation is comprehensive and accurate
- Code quality standards are met
- Development workflow is established

---

## Phase 1 Completion Criteria

### Technical Requirements
- [ ] Development environment runs without errors
- [ ] Database migrations execute successfully
- [ ] API server responds to health checks
- [ ] All tests pass with >90% coverage
- [ ] Code quality tools pass without warnings
- [ ] Documentation is complete and accurate

### Functional Requirements
- [ ] Project structure follows best practices
- [ ] Database schema is properly designed and implemented
- [ ] Configuration management works across environments
- [ ] Error handling is comprehensive
- [ ] Logging provides adequate visibility

### Quality Requirements
- [ ] Code is well-documented with comments
- [ ] Tests cover all critical paths
- [ ] Performance meets baseline expectations
- [ ] Security best practices are followed
- [ ] Development workflow is optimized

### Deliverables
1. **Backend**: Go server with basic API structure
2. **Database**: PostgreSQL with migrations and schema
3. **Testing**: Complete test suite with utilities
4. **Documentation**: README, API docs, and development guide
5. **Configuration**: Environment-based configuration system
6. **CI/CD**: Basic pipeline configuration

### Success Metrics
- ✅ Server starts in < 3 seconds
- ✅ Database connection establishes in < 1 second
- ✅ All tests execute in < 30 seconds
- ✅ Code coverage > 90%
- ✅ Zero critical vulnerabilities in dependency scan
- ✅ Documentation completeness > 95%

When all these criteria are met, Phase 1 is considered complete and we can proceed to Phase 2: Authentication & User Management.