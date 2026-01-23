# Silence Notes Backend API

A comprehensive, secure, and scalable REST API for the Silence Notes Chrome extension, built with Go and PostgreSQL.

## 🚀 Features

### Core Functionality
- **🔐 Google OAuth 2.0 Authentication** with PKCE support
- **🎫 JWT Token System** with access/refresh token pattern
- **👥 User Management** with profile and preferences
- **📝 Note Management** with hashtag support
- **🔒 Security-First Design** with comprehensive protection

### Security Features
- **🛡️ Rate Limiting**: Token bucket algorithm with global and per-user limits
- **🌐 CORS Protection**: Configured for Chrome extension and web origins
- **🔒 Security Headers**: CSP, HSTS, XSS protection, frame options
- **📊 Security Monitoring**: Real-time event logging and alerting
- **🔄 Session Management**: Concurrency limits and activity tracking
- **✅ Input Validation**: Comprehensive request validation and sanitization

### Performance & Reliability
- **⚡ High Performance**: Optimized database queries and connection pooling
- **📈 Monitoring**: Built-in metrics and health checks
- **🔄 Graceful Shutdown**: Proper cleanup and connection management
- **📋 Comprehensive Testing**: Unit, integration, and performance tests

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [API Documentation](#api-documentation)
3. [Development Setup](#development-setup)
4. [Configuration](#configuration)
5. [Database Setup](#database-setup)
6. [Testing](#testing)
7. [Deployment](#deployment)
8. [Security](#security)
9. [Monitoring](#monitoring)
10. [Contributing](#contributing)

## 🚀 Quick Start

### Prerequisites

- **Go 1.21+**
- **PostgreSQL 13+**
- **Redis 6+** (optional, for caching)

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/gpd/my-notes.git
cd my-notes/backend
```

2. **Install dependencies**
```bash
go mod download
```

3. **Set up environment**
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Set up database**
```bash
# Create PostgreSQL database
createdb silence_notes

# Run migrations (auto-applied on server start in dev/test mode)
go run cmd/server/main.go
```

5. **Start the server**
```bash
# Development mode
go run cmd/server/main.go

# Or build and run
go build -o silence-notes-server cmd/server/main.go
./silence-notes-server
```

The API will be available at `http://localhost:8080`

### Health Check

```bash
curl http://localhost:8080/api/v1/health
```

## 📚 API Documentation

### Endpoints

#### Authentication
- `POST /api/v1/auth/google` - Initiate Google OAuth flow
- `POST /api/v1/auth/exchange` - Exchange authorization code for tokens
- `POST /api/v1/auth/refresh` - Refresh access token
- `DELETE /api/v1/auth/logout` - Logout and invalidate tokens

#### User Management
- `GET /api/v1/user/profile` - Get user profile
- `PUT /api/v1/user/profile` - Update user profile
- `GET /api/v1/user/preferences` - Get user preferences
- `PUT /api/v1/user/preferences` - Update user preferences
- `GET /api/v1/user/sessions` - Get user sessions
- `DELETE /api/v1/user/sessions/{id}` - Delete user session

#### Security
- `GET /api/v1/security/rate-limit` - Get rate limit information
- `GET /api/v1/security/session-info` - Get current session information
- `GET /api/v1/security/metrics` - Get security metrics (admin only)

#### System
- `GET /api/v1/health` - Health check endpoint

### Interactive Documentation

- **Swagger UI**: Available at `/api/v1/docs` when running locally
- **OpenAPI Spec**: See [docs/api/openapi.yaml](docs/api/openapi.yaml)
- **Postman Collection**: Available in [docs/api/](docs/api/)

### Authentication

The API uses **Bearer Token** authentication:

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     https://api.silencenotes.com/api/v1/user/profile
```

## 🛠️ Development Setup

### Local Development

```bash
# Install development dependencies
go install github.com/cosmtrek/air@latest

# Run with hot reload
air

# Or run manually
go run cmd/server/main.go
```

### Project Structure

```
backend/
├── cmd/                    # Application entry points
│   └── server/            # Main server application (auto-runs migrations in dev/test)
├── internal/              # Private application code
│   ├── auth/             # Authentication logic
│   ├── config/           # Configuration management
│   ├── database/         # Database connection and pooling
│   ├── handlers/         # HTTP request handlers
│   ├── middleware/       # HTTP middleware
│   ├── models/           # Data models
│   └── services/         # Business logic services
├── pkg/                   # Public library code
├── tests/                 # Test files
│   ├── unit/            # Unit tests
│   ├── integration/     # Integration tests
│   └── performance/     # Performance tests
├── docs/                  # Documentation
├── migrations/            # Database migrations
├── go.mod                 # Go module file
├── go.sum                 # Go module checksums
├── Dockerfile             # Docker configuration
├── docker-compose.yml     # Docker Compose configuration
└── README.md              # This file
```

### Development Workflow

1. **Create feature branch**
```bash
git checkout -b feature/new-feature
```

2. **Write tests first** (TDD)
```bash
go test ./tests/unit/yourpackage
```

3. **Implement functionality**

4. **Run tests**
```bash
go test ./...
```

5. **Run linter**
```bash
golangci-lint run
```

6. **Commit and push**
```bash
git add .
git commit -m "feat: add new feature"
git push origin feature/new-feature
```

## ⚙️ Configuration

### Environment Variables

The application can be configured using environment variables or a `.env` file:

#### Application
```bash
APP_ENVIRONMENT=development          # development, test, production
APP_DEBUG=true                       # Enable debug mode
APP_LOG_LEVEL=info                   # error, warn, info, debug
```

#### Server
```bash
SERVER_HOST=localhost                 # Server host
SERVER_PORT=8080                     # Server port
SERVER_READ_TIMEOUT=30               # Read timeout (seconds)
SERVER_WRITE_TIMEOUT=30              # Write timeout (seconds)
SERVER_IDLE_TIMEOUT=60               # Idle timeout (seconds)
```

#### Database
```bash
DB_HOST=localhost                    # Database host
DB_PORT=5432                        # Database port
DB_NAME=silence_notes              # Database name
DB_USER=postgres                    # Database user
DB_PASSWORD=your_password           # Database password
DB_SSL_MODE=disable                 # SSL mode
```

#### Authentication
```bash
AUTH_GOOGLE_CLIENT_ID=your_client_id
AUTH_GOOGLE_CLIENT_SECRET=your_client_secret
AUTH_JWT_SECRET=your_jwt_secret       # Use a strong, random secret
AUTH_TOKEN_EXPIRY=1                  # Access token expiry (hours)
AUTH_REFRESH_EXPIRY=24               # Refresh token expiry (hours)
```

#### CORS
```bash
CORS_ALLOWED_ORIGINS=http://localhost:3000,chrome-extension://*
CORS_ALLOWED_METHODS=GET,POST,PUT,DELETE,OPTIONS
CORS_ALLOWED_HEADERS=Content-Type,Authorization,X-Request-ID
CORS_MAX_AGE=86400                    # Preflight cache (seconds)
```

### Configuration File

You can also use a YAML configuration file:

```yaml
# config.yaml
app:
  environment: development
  debug: true
  log_level: info

server:
  host: localhost
  port: 8080
  read_timeout: 30
  write_timeout: 30
  idle_timeout: 60

database:
  host: localhost
  port: 5432
  name: silence_notes
  user: postgres
  password: your_password
  ssl_mode: disable

auth:
  google_client_id: your_google_client_id
  google_client_secret: your_google_client_secret
  jwt_secret: your_jwt_secret
  token_expiry: 1
  refresh_expiry: 24
```

## 🗄️ Database Setup

### PostgreSQL Installation

#### Ubuntu/Debian
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

#### macOS
```bash
brew install postgresql
brew services start postgresql
```

#### Windows
```bash
# Download and install from https://www.postgresql.org/download/windows/
```

### Database Setup

1. **Create database**
```bash
sudo -u postgres createdb silence_notes
```

2. **Create user**
```sql
CREATE USER silence_notes_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE silence_notes TO silence_notes_user;
```

3. **Run migrations**
```bash
# Migrations are auto-applied on server start in dev/test mode
# For production, use golang-migrate or similar:
migrate -path migrations -database "postgres://user:password@localhost/silence_notes" up
```

### Schema Overview

```sql
-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    google_id TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    avatar_url TEXT,
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User sessions table
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ip_address INET NOT NULL,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Token blacklist table
CREATE TABLE token_blacklist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## 🧪 Testing

### Running Tests

```bash
# Run all tests
go test ./...

# Run with coverage
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out

# Run specific test package
go test ./tests/unit/auth

# Run with verbose output
go test -v ./...

# Run integration tests
go test -tags=integration ./tests/integration

# Run benchmarks
go test -bench=. ./tests/performance
```

### Test Structure

```
tests/
├── unit/                   # Unit tests (>90% coverage)
│   ├── auth/              # Authentication tests
│   ├── handlers/          # HTTP handler tests
│   ├── middleware/        # Middleware tests
│   ├── models/            # Model tests
│   └── services/          # Service tests
├── integration/            # Integration tests
│   ├── auth_flow_test.go  # Complete auth flow
│   └── security_test.go   # Security tests
└── performance/            # Performance tests
    └── load_test.go       # Load testing
```

### Test Coverage

- **Unit Tests**: >90% line coverage required
- **Integration Tests**: >80% coverage
- **Security Tests**: 100% coverage for security components
- **Performance Tests**: Load testing and benchmarks

## 🚀 Deployment

### Docker Deployment

1. **Build image**
```bash
docker build -t silence-notes-api .
```

2. **Run with Docker Compose**
```bash
docker-compose up -d
```

3. **Check logs**
```bash
docker-compose logs -f app
```

### Production Deployment

1. **Build binary**
```bash
GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o silence-notes-server cmd/server/main.go
```

2. **Systemd service**
```bash
sudo cp scripts/silence-notes.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable silence-notes
sudo systemctl start silence-notes
```

3. **Nginx reverse proxy**
```bash
sudo cp nginx/silence-notes.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/silence-notes /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Environment-Specific Configurations

- **Development**: Relaxed security, verbose logging, high rate limits
- **Testing**: Isolated database, mocked services, fast configuration
- **Production**: Strict security, minimal logging, optimized rate limits

## 🔒 Security

### Security Features

- **🔐 Authentication**: Google OAuth 2.0 with PKCE
- **🎫 JWT Tokens**: Secure token generation and validation
- **🛡️ Rate Limiting**: Token bucket algorithm with multiple limits
- **🌐 CORS Protection**: Strict origin validation
- **📋 Security Headers**: CSP, HSTS, XSS protection, frame options
- **📊 Security Monitoring**: Event logging and alerting
- **🔄 Session Management**: Concurrency limits and activity tracking
- **✅ Input Validation**: Comprehensive request validation

### Security Best Practices

1. **Use HTTPS** in production
2. **Strong JWT secrets** (32+ characters)
3. **Regular updates** of dependencies
4. **Security monitoring** and alerting
5. **Rate limiting** on all endpoints
6. **Input validation** and sanitization
7. **Database security** with proper permissions

### Security Headers

```http
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains
Referrer-Policy: strict-origin-when-cross-origin
Content-Security-Policy: default-src 'self'; script-src 'self'; ...
```

### Rate Limiting

- **Global**: 100 requests/second
- **Per User**: 60 requests/minute, 1000 requests/hour
- **Auth endpoints**: 10 requests/minute
- **Profile endpoints**: 30 requests/minute
- **Search endpoints**: 20 requests/minute

## 📊 Monitoring

### Health Checks

- **Basic**: `/api/v1/health`
- **Detailed**: `/api/v1/health/detailed`
- **Readiness**: `/api/v1/health/ready`
- **Liveness**: `/api/v1/health/live`

### Metrics

The application provides metrics for:

- **Request rates** and response times
- **Authentication events** (success/failure)
- **Rate limiting violations**
- **Security events**
- **Database performance**
- **Error rates**

### Logging

Structured logging with levels:
- **Error**: Critical errors
- **Warn**: Warning messages
- **Info**: General information
- **Debug**: Detailed debugging information

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Process

1. Fork the repository
2. Create a feature branch
3. Write tests first (TDD)
4. Implement your changes
5. Ensure all tests pass
6. Update documentation
7. Submit a pull request

### Code Standards

- **Go formatting**: `go fmt ./...`
- **Linting**: `golangci-lint run`
- **Testing**: >90% coverage required
- **Documentation**: Update for public APIs

### Pull Request Process

1. **Description**: Clear description of changes
2. **Tests**: All tests must pass
3. **Coverage**: Maintain >90% coverage
4. **Documentation**: Update relevant documentation
5. **Review**: At least one code review required

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [https://docs.silencenotes.com](https://docs.silencenotes.com)
- **GitHub Issues**: [https://github.com/gpd/my-notes/issues](https://github.com/gpd/my-notes/issues)
- **Discussions**: [https://github.com/gpd/my-notes/discussions](https://github.com/gpd/my-notes/discussions)
- **Email**: support@silenzenotes.com

## 🗺️ Roadmap

### Version 1.0 (Current)
- ✅ Google OAuth 2.0 authentication
- ✅ JWT token system
- ✅ User management
- ✅ Security middleware
- ✅ Rate limiting
- ✅ Session management

### Version 1.1 (Planned)
- 🔄 Note management endpoints
- 🔄 Hashtag system
- 🔄 Search functionality
- 🔄 File upload support

### Version 1.2 (Planned)
- 🔄 Real-time notifications
- 🔄 Data export/import
- 🔄 Advanced analytics
- 🔄 Multi-tenant support

## 📊 Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Chrome Extension │────│   Backend API    │────│    PostgreSQL   │
│                 │    │                 │    │                 │
│ - React UI       │    │ - Go HTTP       │    │ - Users        │
│ - OAuth Flow     │────│ - JWT Auth       │────│ - Notes         │
│ - Token Storage  │    │ - Rate Limiting  │    │ - Sessions      │
│                 │    │ - Security      │    │ - Tags          │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Technology Stack

- **Backend**: Go 1.21+
- **Database**: PostgreSQL 13+
- **Cache**: Redis 6+ (optional)
- **Authentication**: Google OAuth 2.0 + JWT
- **HTTP**: Gorilla Mux
- **Testing**: Go testing + Testify
- **Documentation**: OpenAPI 3.0
- **Containerization**: Docker
- **Monitoring**: Prometheus + Grafana

## 🔗 Related Projects

- **[Chrome Extension](../extension/)** - Frontend Chrome extension
- **[API Documentation](./docs/api/openapi.yaml)** - Complete API specification
- **[Database Schema](./migrations/)** - Database migrations and schema
- **[Deployment Guide](./docs/DEPLOYMENT.md)** - Production deployment instructions
- **[Testing Guide](./docs/TESTING.md)** - Comprehensive testing documentation

---

**Built with ❤️ for the Silence Notes community**