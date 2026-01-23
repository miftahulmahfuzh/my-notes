# Testing Guide

This guide covers the comprehensive testing strategy for the Silence Notes backend API, including unit tests, integration tests, performance testing, and security testing.

## Table of Contents

1. [Testing Philosophy](#testing-philosophy)
2. [Test Structure](#test-structure)
3. [Running Tests](#running-tests)
4. [Unit Testing](#unit-testing)
5. [Integration Testing](#integration-testing)
6. [Performance Testing](#performance-testing)
7. [Security Testing](#security-testing)
8. [Test Data Management](#test-data-management)
9. [Continuous Integration](#continuous-integration)
10. [Test Coverage](#test-coverage)
11. [Troubleshooting Tests](#troubleshooting-tests)

## Testing Philosophy

We follow **Test-Driven Development (TDD)** with these principles:

1. **Test First**: Write tests before implementation
2. **High Coverage**: Maintain >90% code coverage
3. **Comprehensive Testing**: Unit, integration, performance, and security tests
4. **Fast Feedback**: Tests should run quickly and provide clear feedback
5. **Realistic Scenarios**: Tests should mirror real-world usage patterns

### Test Pyramid

```
    E2E Tests (5%)
   ─────────────────
  Integration Tests (15%)
 ─────────────────────────
Unit Tests (80%)
─────────────────────────────
```

## Test Structure

```
backend/
├── tests/
│   ├── unit/                   # Unit tests
│   │   ├── auth/               # Authentication tests
│   │   ├── handlers/           # HTTP handler tests
│   │   ├── middleware/         # Middleware tests
│   │   ├── models/             # Model tests
│   │   └── services/           # Service tests
│   ├── integration/            # Integration tests
│   │   ├── auth_flow_test.go  # Complete auth flow
│   │   └── security_test.go   # Security integration
│   ├── performance/            # Performance tests
│   │   └── load_test.go        # Load testing
│   ├── fixtures/               # Test data and fixtures
│   ├── mocks/                  # Mock implementations
│   └── testutils/              # Test utilities
├── go.mod
└── go.sum
```

## Running Tests

### Basic Commands

```bash
# Run all tests
go test ./...

# Run tests with verbose output
go test -v ./...

# Run tests with coverage
go test -coverprofile=coverage.out ./...

# Generate HTML coverage report
go tool cover -html=coverage.out

# Run specific test package
go test ./tests/unit/auth

# Run specific test
go test -run TestGoogleAuth ./tests/unit/auth

# Run tests with race detection
go test -race ./...

# Run tests with timeout
go test -timeout 30s ./...
```

### Advanced Commands

```bash
# Run tests with specific build tags
go test -tags=integration ./...

# Run benchmarks
go test -bench=. ./tests/performance

# Run tests and profile memory
go test -memprofile=mem.prof ./...

# Run tests and profile CPU
go test -cpuprofile=cpu.prof ./...

# Run tests with specific count
go test -count=3 ./...
```

## Unit Testing

### Test Structure

Each unit test follows this structure:

```go
func TestFunctionName_Condition_ExpectedResult(t *testing.T) {
    // Arrange
    setup := setupTest()

    // Act
    result := functionUnderTest(setup.input)

    // Assert
    assert.Equal(t, setup.expected, result)
}
```

### Example: Authentication Service Test

```go
// tests/unit/auth/service_test.go
package auth

import (
    "testing"
    "time"

    "github.com/gpd/my-notes/internal/auth"
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"
)

func TestTokenService_GenerateToken_ValidClaims_ReturnsToken(t *testing.T) {
    // Arrange
    service := auth.NewTokenService("test-secret", 15*time.Minute, 24*time.Hour, "silence-notes", "silence-notes-users")
    userID := "123e4567-e89b-12d3-a456-426614174000"

    // Act
    token, err := service.GenerateToken(userID, "session-123")

    // Assert
    require.NoError(t, err)
    assert.NotEmpty(t, token)

    // Verify token structure
    parts := strings.Split(token, ".")
    assert.Len(t, parts, 3)
}

func TestTokenService_ValidateToken_ValidToken_ReturnsClaims(t *testing.T) {
    // Arrange
    service := auth.NewTokenService("test-secret", 15*time.Minute, 24*time.Hour, "silence-notes", "silence-notes-users")
    userID := "123e4567-e89b-12d3-a456-426614174000"
    token, _ := service.GenerateToken(userID, "session-123")

    // Act
    claims, err := service.ValidateToken(token)

    // Assert
    require.NoError(t, err)
    assert.Equal(t, userID, claims.UserID)
    assert.Equal(t, "session-123", claims.SessionID)
    assert.Equal(t, "silence-notes", claims.Issuer)
    assert.Equal(t, "silence-notes-users", claims.Audience)
}

func TestTokenService_ValidateToken_InvalidToken_ReturnsError(t *testing.T) {
    // Arrange
    service := auth.NewTokenService("test-secret", 15*time.Minute, 24*time.Hour, "silence-notes", "silence-notes-users")
    invalidToken := "invalid.token.here"

    // Act
    claims, err := service.ValidateToken(invalidToken)

    // Assert
    assert.Error(t, err)
    assert.Nil(t, claims)
    assert.Contains(t, err.Error(), "invalid token")
}
```

### Mock Testing

```go
// tests/mocks/user_service_mock.go
package mocks

import (
    "github.com/gpd/my-notes/internal/models"
    "github.com/gpd/my-notes/internal/services"
    "github.com/stretchr/testify/mock"
)

type MockUserService struct {
    mock.Mock
}

func (m *MockUserService) GetByID(userID string) (*models.User, error) {
    args := m.Called(userID)
    if args.Get(0) == nil {
        return nil, args.Error(1)
    }
    return args.Get(0).(*models.User), args.Error(1)
}

func (m *MockUserService) Update(user *models.User) error {
    args := m.Called(user)
    return args.Error(0)
}

// Usage in tests
func TestAuthHandler_GetUser_ValidToken_ReturnsUser(t *testing.T) {
    // Arrange
    mockUserService := new(mocks.MockUserService)
    expectedUser := &models.User{
        ID:    uuid.New(),
        Email: "test@example.com",
        Name:  "Test User",
    }

    mockUserService.On("GetByID", expectedUser.ID.String()).Return(expectedUser, nil)

    handler := NewAuthHandler(tokenService, mockUserService)

    // Act & Assert
    // ... test implementation
}
```

### Table-Driven Tests

```go
func TestValidation_EmailValidation(t *testing.T) {
    testCases := []struct {
        name        string
        email       string
        shouldError bool
        errorMsg    string
    }{
        {
            name:        "Valid email",
            email:       "user@example.com",
            shouldError: false,
        },
        {
            name:        "Invalid email - no @",
            email:       "userexample.com",
            shouldError: true,
            errorMsg:    "invalid email format",
        },
        {
            name:        "Invalid email - empty",
            email:       "",
            shouldError: true,
            errorMsg:    "email is required",
        },
        {
            name:        "Invalid email - special chars",
            email:       "user@ex!ample.com",
            shouldError: true,
            errorMsg:    "invalid email format",
        },
    }

    for _, tc := range testCases {
        t.Run(tc.name, func(t *testing.T) {
            // Arrange & Act
            err := ValidateEmail(tc.email)

            // Assert
            if tc.shouldError {
                assert.Error(t, err)
                assert.Contains(t, err.Error(), tc.errorMsg)
            } else {
                assert.NoError(t, err)
            }
        })
    }
}
```

## Integration Testing

### Test Environment Setup

```go
// tests/integration/setup_test.go
package integration

import (
    "database/sql"
    "testing"
    "time"

    "github.com/gpd/my-notes/internal/config"
    "github.com/gpd/my-notes/internal/database"
    "github.com/gpd/my-notes/internal/handlers"
    "github.com/gpd/my-notes/internal/server"
    "github.com/stretchr/testify/require"
    "github.com/stretchr/testify/suite"
)

type IntegrationTestSuite struct {
    suite.Suite
    server   *server.Server
    db       *sql.DB
    cleanup  func()
}

func (suite *IntegrationTestSuite) SetupSuite() {
    // Setup test database
    testConfig := &config.DatabaseConfig{
        Host:     "localhost",
        Port:     5432,
        Name:     "silence_notes_test",
        User:     "test_user",
        Password: "test_password",
        SSLMode:  "disable",
    }

    db, err := database.NewConnection(*testConfig)
    require.NoError(suite.T(), err)

    // Run migrations
    migrator := database.NewMigrator(db, "tests/migrations")
    err = migrator.Up()
    require.NoError(suite.T(), err)

    // Setup server
    config := &config.Config{
        App: config.AppConfig{
            Environment: "test",
            Debug:       false,
        },
        Server: config.ServerConfig{
            Port: "0", // Random port
        },
        Database: *testConfig,
        Auth: config.AuthConfig{
            JWTSecret: "test-secret-key",
        },
    }

    handlers := handlers.NewHandlers()
    server := server.NewServer(config, handlers, db)

    suite.server = server
    suite.db = db

    // Setup cleanup function
    suite.cleanup = func() {
        // Clean up test data
        suite.db.Exec("DELETE FROM users WHERE email LIKE 'test-%'")
        suite.db.Close()
    }
}

func (suite *IntegrationTestSuite) TearDownSuite() {
    if suite.cleanup != nil {
        suite.cleanup()
    }
}

func TestIntegrationTestSuite(t *testing.T) {
    suite.Run(t, new(IntegrationTestSuite))
}
```

### Complete Authentication Flow Test

```go
// tests/integration/auth_flow_test.go
func (suite *IntegrationTestSuite) TestCompleteAuthFlow() {
    // Step 1: Initiate OAuth
    t.Run("Initiate OAuth", func(t *testing.T) {
        req := httptest.NewRequest("POST", "/api/v1/auth/google", strings.NewReader(`{
            "redirect_uri": "http://localhost:3000/auth/callback",
            "state": "test-state-123"
        }`))
        req.Header.Set("Content-Type", "application/json")
        w := httptest.NewRecorder()

        suite.server.GetRouter().ServeHTTP(w, req)

        assert.Equal(t, http.StatusOK, w.Code)

        var response map[string]interface{}
        err := json.Unmarshal(w.Body.Bytes(), &response)
        require.NoError(t, err)
        assert.NotEmpty(t, response["auth_url"])
    })

    // Step 2: Exchange code for tokens
    t.Run("Exchange Code", func(t *testing.T) {
        // Mock the OAuth response
        req := httptest.NewRequest("POST", "/api/v1/auth/exchange", strings.NewReader(`{
            "code": "mock-auth-code",
            "state": "test-state-123",
            "redirect_uri": "http://localhost:3000/auth/callback"
        }`))
        req.Header.Set("Content-Type", "application/json")
        w := httptest.NewRecorder()

        suite.server.GetRouter().ServeHTTP(w, req)

        assert.Equal(t, http.StatusOK, w.Code)

        var response map[string]interface{}
        err := json.Unmarshal(w.Body.Bytes(), &response)
        require.NoError(t, err)
        assert.NotEmpty(t, response["access_token"])
        assert.NotEmpty(t, response["refresh_token"])
    })

    // Step 3: Use protected endpoint
    t.Run("Access Protected Resource", func(t *testing.T) {
        req := httptest.NewRequest("GET", "/api/v1/user/profile", nil)
        req.Header.Set("Authorization", "Bearer mock-valid-token")
        w := httptest.NewRecorder()

        suite.server.GetRouter().ServeHTTP(w, req)

        assert.Equal(t, http.StatusOK, w.Code)

        var response map[string]interface{}
        err := json.Unmarshal(w.Body.Bytes(), &response)
        require.NoError(t, err)
        assert.NotNil(t, response["user"])
    })
}
```

## Performance Testing

### Load Testing Configuration

```go
// tests/performance/load_test.go
package performance

import (
    "testing"
    "time"

    "github.com/stretchr/testify/require"
)

func BenchmarkAPIEndpoints(b *testing.B) {
    // Setup test server
    server := setupTestServer(b)
    defer server.Close()

    loadTester := NewLoadTester(server, &LoadTestConfig{
        ConcurrentUsers: 10,
        RequestsPerUser: b.N / 10,
        Duration:        0, // Run until benchmark completes
        Endpoints: []Endpoint{
            {
                Path:           "/api/v1/health",
                Method:         "GET",
                Weight:         40,
                ExpectedStatus: http.StatusOK,
            },
            {
                Path:           "/api/v1/user/profile",
                Method:         "GET",
                Headers:        map[string]string{"Authorization": "Bearer valid-token"},
                Weight:         30,
                ExpectedStatus: http.StatusOK,
            },
            {
                Path:           "/api/v1/auth/validate",
                Method:         "GET",
                Headers:        map[string]string{"Authorization": "Bearer valid-token"},
                Weight:         30,
                ExpectedStatus: http.StatusOK,
            },
        },
    })

    b.ResetTimer()
    result := loadTester.RunLoadTest(b)
    b.StopTimer()

    // Report metrics
    b.ReportMetric(float64(result.AverageResponse.Nanoseconds())/1000, "ns/op")
    b.ReportMetric(result.RequestsPerSec, "req/s")

    // Validate performance requirements
    require.True(b, result.AverageResponse < 100*time.Millisecond,
        "Average response time should be less than 100ms")
    require.True(b, result.RequestsPerSec > 100,
        "Should handle at least 100 requests per second")
}
```

### Stress Testing

```go
func TestStressTest_HighConcurrency(t *testing.T) {
    if testing.Short() {
        t.Skip("Skipping stress test in short mode")
    }

    server := setupTestServer(t)
    defer server.Close()

    config := &LoadTestConfig{
        ConcurrentUsers: 100,
        RequestsPerUser: 50,
        Duration:        2 * time.Minute,
        RampUpTime:      30 * time.Second,
        Endpoints: []Endpoint{
            {
                Path:           "/api/v1/health",
                Method:         "GET",
                Weight:         100,
                ExpectedStatus: http.StatusOK,
            },
        },
    }

    loadTester := NewLoadTester(server, config)
    result := loadTester.RunLoadTest(t)

    // Validate stress test results
    t.Logf("Stress test results:")
    t.Logf("  Total requests: %d", result.TotalRequests)
    t.Logf("  Success rate: %.2f%%", float64(result.SuccessfulReqs)/float64(result.TotalRequests)*100)
    t.Logf("  Average response: %v", result.AverageResponse)
    t.Logf("  95th percentile: %v", result.Percentiles["p95"])
    t.Logf("  Requests/sec: %.2f", result.RequestsPerSec)

    // Performance assertions
    assert.Greater(t, result.SuccessfulReqs, result.TotalRequests*95/100,
        "Success rate should be at least 95%")
    assert.Less(t, result.Percentiles["p95"], 500*time.Millisecond,
        "95th percentile response time should be less than 500ms")
}
```

## Security Testing

### Security Test Suite

```go
// tests/integration/security_test.go
func (suite *SecurityTestSuite) TestSecurityHeaders() {
    testCases := []struct {
        name     string
        endpoint string
        expected map[string]string
    }{
        {
            name:     "Health endpoint",
            endpoint: "/api/v1/health",
            expected: map[string]string{
                "X-Content-Type-Options": "nosniff",
                "X-Frame-Options":        "DENY",
                "Referrer-Policy":        "strict-origin-when-cross-origin",
            },
        },
        {
            name:     "Protected endpoint",
            endpoint: "/api/v1/user/profile",
            expected: map[string]string{
                "X-Content-Type-Options": "nosniff",
                "X-Frame-Options":        "DENY",
                "Referrer-Policy":        "strict-origin-when-cross-origin",
            },
        },
    }

    for _, tc := range testCases {
        suite.T().Run(tc.name, func(t *testing.T) {
            req := httptest.NewRequest("GET", tc.endpoint, nil)
            w := httptest.NewRecorder()

            suite.server.GetRouter().ServeHTTP(w, req)

            for header, expected := range tc.expected {
                assert.Equal(t, expected, w.Header().Get(header),
                    "Header %s should be %s", header, expected)
            }

            assert.NotEmpty(t, w.Header().Get("X-Request-ID"))
        })
    }
}

func (suite *SecurityTestSuite) TestInputValidation() {
    testCases := []struct {
        name           string
        endpoint       string
        method         string
        body           string
        expectedStatus int
    }{
        {
            name:           "SQL injection attempt",
            endpoint:       "/api/v1/auth/google",
            method:         "POST",
            body:           `{"redirect_uri": "'; DROP TABLE users; --"}`,
            expectedStatus: http.StatusBadRequest,
        },
        {
            name:           "XSS attempt",
            endpoint:       "/api/v1/auth/google",
            method:         "POST",
            body:           `{"redirect_uri": "<script>alert('xss')</script>"}`,
            expectedStatus: http.StatusBadRequest,
        },
        {
            name:           "Oversized payload",
            endpoint:       "/api/v1/auth/google",
            method:         "POST",
            body:           `{"data": "` + strings.Repeat("A", 1000000) + `"}`,
            expectedStatus: http.StatusRequestEntityTooLarge,
        },
    }

    for _, tc := range testCases {
        suite.T().Run(tc.name, func(t *testing.T) {
            req := httptest.NewRequest(tc.method, tc.endpoint, strings.NewReader(tc.body))
            req.Header.Set("Content-Type", "application/json")
            w := httptest.NewRecorder()

            suite.server.GetRouter().ServeHTTP(w, req)

            assert.Equal(t, tc.expectedStatus, w.Code)

            // Check that error messages don't leak sensitive information
            var response map[string]interface{}
            err := json.Unmarshal(w.Body.Bytes(), &response)
            require.NoError(t, err)

            if errorMsg, ok := response["error"].(string); ok {
                assert.NotContains(t, strings.ToLower(errorMsg), "sql")
                assert.NotContains(t, strings.ToLower(errorMsg), "database")
                assert.NotContains(t, strings.ToLower(errorMsg), "internal")
            }
        })
    }
}
```

## Test Data Management

### Test Fixtures

```go
// tests/fixtures/user_fixtures.go
package fixtures

import (
    "time"

    "github.com/gpd/my-notes/internal/models"
    "github.com/google/uuid"
)

type UserFixture struct {
    User    models.User
    Session models.UserSession
}

func CreateTestUser() *UserFixture {
    userID := uuid.New()
    sessionID := uuid.New()

    return &UserFixture{
        User: models.User{
            ID:          userID,
            GoogleID:    "google-" + userID.String()[:8],
            Email:       "test-" + userID.String()[:8] + "@example.com",
            Name:        "Test User " + userID.String()[:8],
            AvatarURL:   "https://example.com/avatar/" + userID.String(),
            Preferences: models.UserPreferences{
                Theme:              "light",
                Language:           "en",
                TimeZone:           "UTC",
                EmailNotifications: true,
                AutoSave:           true,
                DefaultNoteView:    "grid",
            },
            CreatedAt: time.Now(),
            UpdatedAt: time.Now(),
        },
        Session: models.UserSession{
            ID:        sessionID.String(),
            UserID:    userID.String(),
            IPAddress: "127.0.0.1",
            UserAgent: "Test-Agent/1.0",
            IsActive:  true,
            CreatedAt: time.Now(),
            LastSeen:  time.Now(),
        },
    }
}

func (f *UserFixture) ToMap() map[string]interface{} {
    return map[string]interface{}{
        "id":          f.User.ID,
        "google_id":   f.User.GoogleID,
        "email":       f.User.Email,
        "name":        f.User.Name,
        "avatar_url":  f.User.AvatarURL,
        "preferences": f.User.Preferences,
        "created_at":  f.User.CreatedAt,
        "updated_at":  f.User.UpdatedAt,
    }
}
```

### Database Test Utilities

```go
// tests/testutils/database_test.go
package testutils

import (
    "database/sql"
    "testing"

    "github.com/gpd/my-notes/internal/database"
    "github.com/stretchr/testify/require"
)

type TestDatabase struct {
    DB     *sql.DB
    Config database.Config
}

func NewTestDatabase(t *testing.T) *TestDatabase {
    config := database.Config{
        Host:     "localhost",
        Port:     5432,
        Name:     "silence_notes_test",
        User:     "test_user",
        Password: "test_password",
        SSLMode:  "disable",
    }

    db, err := database.NewConnection(config)
    require.NoError(t, err)

    return &TestDatabase{
        DB:     db,
        Config: config,
    }
}

func (td *TestDatabase) Cleanup(t *testing.T) {
    // Clean up all test data
    tables := []string{
        "user_sessions",
        "users",
        "notes",
        "tags",
        "note_tags",
    }

    for _, table := range tables {
        _, err := td.DB.Exec("DELETE FROM " + table + " WHERE email LIKE 'test-%'")
        require.NoError(t, err)
    }
}

func (td *TestDatabase) Close() error {
    return td.DB.Close()
}

func (td *TestDatabase) CreateUser(t *testing.T, fixture *UserFixture) {
    _, err := td.DB.Exec(`
        INSERT INTO users (id, google_id, email, name, avatar_url, preferences, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `,
        fixture.User.ID,
        fixture.User.GoogleID,
        fixture.User.Email,
        fixture.User.Name,
        fixture.User.AvatarURL,
        fixture.User.Preferences,
        fixture.User.CreatedAt,
        fixture.User.UpdatedAt,
    )
    require.NoError(t, err)
}
```

## Continuous Integration

### GitHub Actions Configuration

```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test_password
          POSTGRES_USER: test_user
          POSTGRES_DB: silence_notes_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
    - name: Checkout code
      uses: actions/checkout@v3

    - name: Set up Go
      uses: actions/setup-go@v4
      with:
        go-version: '1.21'

    - name: Cache Go modules
      uses: actions/cache@v3
      with:
        path: ~/go/pkg/mod
        key: ${{ runner.os }}-go-${{ hashFiles('**/go.sum') }}
        restore-keys: |
          ${{ runner.os }}-go-

    - name: Install dependencies
      run: go mod download

    - name: Run unit tests
      run: go test -v -race -coverprofile=coverage.out ./tests/unit

    - name: Run integration tests
      run: go test -v -tags=integration ./tests/integration
      env:
        DB_HOST: localhost
        DB_PORT: 5432
        DB_NAME: silence_notes_test
        DB_USER: test_user
        DB_PASSWORD: test_password

    - name: Run security tests
      run: go test -v ./tests/integration/security_test.go

    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage.out

    - name: Run benchmarks
      run: go test -bench=. -benchmem ./tests/performance

    - name: Check for race conditions
      run: go test -race -short ./...

    - name: Lint code
      uses: golangci/golangci-lint-action@v3
      with:
        version: latest
        args: --timeout=5m

  security:
    runs-on: ubuntu-latest
    steps:
    - name: Checkout code
      uses: actions/checkout@v3

    - name: Run Gosec Security Scanner
      uses: securecodewarrior/github-action-gosec@master
      with:
        args: '-no-fail -fmt sarif -out results.sarif ./...'

    - name: Upload SARIF file
      uses: github/codeql-action/upload-sarif@v2
      with:
        sarif_file: results.sarif
```

### Local CI Script

```bash
#!/bin/bash
# scripts/ci.sh

set -e

echo "🧪 Running CI test suite..."

# Environment checks
echo "📋 Checking Go version..."
go version

echo "📋 Checking dependencies..."
go mod verify

echo "📋 Formatting code..."
test -z $(gofmt -l .) || (echo "❌ Code is not formatted" && exit 1)

echo "📋 Running linter..."
golangci-lint run

echo "🧪 Running unit tests..."
go test -v -race -coverprofile=coverage.out ./tests/unit

echo "🧪 Running integration tests..."
go test -v -tags=integration ./tests/integration

echo "🧪 Running security tests..."
go test -v ./tests/integration/security_test.go

echo "📊 Generating coverage report..."
go tool cover -html=coverage.out -o coverage.html

echo "🚀 Running benchmarks..."
go test -bench=. -benchmem ./tests/performance

echo "✅ CI test suite completed successfully!"
echo "📈 Coverage report: coverage.html"
```

## Test Coverage

### Coverage Requirements

- **Unit Tests**: >90% line coverage
- **Integration Tests**: >80% line coverage
- **Critical Paths**: 100% coverage required
- **Security Components**: 100% coverage required

### Coverage Report Generation

```bash
# Generate coverage report
go test -coverprofile=coverage.out ./...

# View coverage summary
go tool cover -func=coverage.out

# Generate HTML report
go tool cover -html=coverage.out -o coverage.html

# Check coverage by package
go test -coverprofile=pkg_coverage.out ./internal/...
go tool cover -func=pkg_coverage.out
```

### Coverage Configuration

```bash
# .coveragerc
# Coverage configuration

[coverage]
# Set coverage threshold
threshold = 80

# Exclude certain files from coverage
exclude_files = [
    "generated_*",
    "*_mock.go",
    "*_test.go",
]

# Include specific patterns
include_patterns = [
    "*.go",
]

# Exclude specific patterns
exclude_patterns = [
    "vendor/",
    "tests/",
    "docs/",
]
```

## Troubleshooting Tests

### Common Issues

#### 1. Test Database Connection Issues

```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Check connection
psql -h localhost -U test_user -d silence_notes_test

# Reset test database
dropdb -U postgres silence_notes_test
createdb -U postgres silence_notes_test
```

#### 2. Race Condition Failures

```bash
# Run with race detection enabled
go test -race ./...

# Increase timeout for slow tests
go test -timeout 30s ./...

# Run tests sequentially
go test -p 1 ./...
```

#### 3. Mock Issues

```bash
# Verify mock expectations
go test -v -run TestWithMock

# Check mock interface compatibility
go test -v ./tests/mocks
```

#### 4. Test Cleanup Issues

```bash
# Clean up test data
psql -U postgres -d silence_notes_test -c "DELETE FROM users WHERE email LIKE 'test-%'"

# Reset database schema
migrate -path migrations -database "postgres://test_user:test_password@localhost/silence_notes_test" down
migrate -path migrations -database "postgres://test_user:test_password@localhost/silence_notes_test" up
```

### Debugging Tests

#### 1. Verbose Test Output

```bash
# Run with verbose output
go test -v -run TestSpecificFunction

# Enable test debugging
go test -v -run TestSpecificFunction -test.v
```

#### 2. Test Profiling

```bash
# Profile memory usage during tests
go test -memprofile=test.mem ./...

# Profile CPU usage during tests
go test -cpuprofile=test.cpu ./...

# Analyze profiles
go tool pprof test.mem
go tool pprof test.cpu
```

#### 3. Test Logging

```go
// Enable debug logging in tests
func TestWithLogging(t *testing.T) {
    // Override log level for testing
    logger.SetLevel("debug")

    // Test implementation
    // ...
}
```

### Getting Help

If you encounter issues with tests:

1. Check the [GitHub Issues](https://github.com/gpd/my-notes/issues) for known problems
2. Review the [Test Documentation](./docs/)
3. Run tests with `-v` flag for detailed output
4. Enable race detection with `-race` flag
5. Check test database connectivity and permissions

### Contributing Tests

When contributing new features:

1. **Write tests first** (TDD approach)
2. **Ensure high coverage** (>90% for new code)
3. **Include edge cases** and error scenarios
4. **Add integration tests** for new endpoints
5. **Update documentation** for new test utilities
6. **Run full test suite** before submitting PR

## Best Practices

1. **Test Naming**: Use descriptive names: `TestFunction_Condition_ExpectedResult`
2. **Arrange-Act-Assert**: Structure tests clearly with setup, action, and assertion phases
3. **Test Independence**: Tests should not depend on each other
4. **Deterministic**: Tests should produce the same results every time
5. **Fast Feedback**: Unit tests should run in milliseconds, not seconds
6. **Clear Assertions**: Use descriptive assertion messages
7. **Mock External Dependencies**: Use mocks for external services
8. **Test Data Management**: Use fixtures and utilities for test data
9. **Error Testing**: Test both success and failure scenarios
10. **Security Testing**: Include security tests for all user input handling