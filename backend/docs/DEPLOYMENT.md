# Deployment Guide

This guide covers the deployment of the Silence Notes backend API server in various environments.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Configuration](#configuration)
4. [Database Setup](#database-setup)
5. [Development Deployment](#development-deployment)
6. [Production Deployment](#production-deployment)
7. [Docker Deployment](#docker-deployment)
8. [Monitoring and Logging](#monitoring-and-logging)
9. [Security Considerations](#security-considerations)
10. [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements

- **Operating System**: Linux (Ubuntu 20.04+ recommended), macOS, or Windows
- **Go**: Version 1.21 or later
- **PostgreSQL**: Version 13 or later
- **Redis**: Version 6 or later (for caching and session storage)
- **Memory**: Minimum 1GB RAM, 2GB+ recommended
- **Storage**: Minimum 10GB available space
- **Network**: Stable internet connection for OAuth and database connectivity

### Required Tools

```bash
# Install Go (Ubuntu/Debian)
sudo apt update
sudo apt install golang-go

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib

# Install Redis
sudo apt install redis-server

# Install additional tools
sudo apt install curl wget git
```

## Environment Setup

### 1. Clone the Repository

```bash
git clone https://github.com/gpd/my-notes.git
cd my-notes/backend
```

### 2. Install Dependencies

```bash
# Download Go modules
go mod download

# Verify dependencies
go mod verify
```

### 3. Set Up Environment Variables

Create a `.env` file in the project root:

```bash
# Create environment file
cp .env.example .env

# Edit with your configuration
nano .env
```

## Configuration

### Environment Variables

The application can be configured using environment variables. Here are the key variables:

#### Application Configuration
```bash
APP_ENVIRONMENT=production          # Environment: development, test, production
APP_DEBUG=false                     # Enable debug mode
APP_LOG_LEVEL=info                  # Log level: error, warn, info, debug
APP_VERSION=1.0.0                  # Application version
```

#### Server Configuration
```bash
SERVER_HOST=0.0.0.0                 # Server host
SERVER_PORT=8080                    # Server port
SERVER_READ_TIMEOUT=30              # Read timeout in seconds
SERVER_WRITE_TIMEOUT=30             # Write timeout in seconds
SERVER_IDLE_TIMEOUT=60              # Idle timeout in seconds
```

#### Database Configuration
```bash
DB_HOST=localhost                    # Database host
DB_PORT=5432                        # Database port
DB_NAME=silence_notes              # Database name
DB_USER=postgres                    # Database user
DB_PASSWORD=your_secure_password    # Database password
DB_SSL_MODE=require                 # SSL mode: disable, require, verify-ca, verify-full
```

#### Redis Configuration (Optional)
```bash
REDIS_HOST=localhost                 # Redis host
REDIS_PORT=6379                     # Redis port
REDIS_PASSWORD=                     # Redis password (if required)
REDIS_DB=0                          # Redis database number
```

#### Authentication Configuration
```bash
# Google OAuth 2.0
AUTH_GOOGLE_CLIENT_ID=your_google_client_id
AUTH_GOOGLE_CLIENT_SECRET=your_google_client_secret
AUTH_GOOGLE_REDIRECT_URL=https://yourdomain.com/auth/callback

# JWT Configuration
AUTH_JWT_SECRET=your-very-secure-jwt-secret-key-at-least-32-characters
AUTH_TOKEN_EXPIRY=1                # Access token expiry in hours
AUTH_REFRESH_EXPIRY=24              # Refresh token expiry in hours
```

#### CORS Configuration
```bash
CORS_ALLOWED_ORIGINS=https://yourdomain.com,chrome-extension://*
CORS_ALLOWED_METHODS=GET,POST,PUT,DELETE,OPTIONS
CORS_ALLOWED_HEADERS=Content-Type,Authorization,X-Request-ID
CORS_MAX_AGE=86400                  # Cache preflight requests for 24 hours
```

### Configuration File (Optional)

You can also use a YAML configuration file:

```yaml
# config.yaml
app:
  environment: production
  debug: false
  log_level: info
  version: 1.0.0

server:
  host: 0.0.0.0
  port: 8080
  read_timeout: 30
  write_timeout: 30
  idle_timeout: 60

database:
  host: localhost
  port: 5432
  name: silence_notes
  user: postgres
  password: your_secure_password
  ssl_mode: require

auth:
  google_client_id: your_google_client_id
  google_client_secret: your_google_client_secret
  google_redirect_url: https://yourdomain.com/auth/callback
  jwt_secret: your-very-secure-jwt-secret-key
  token_expiry: 1
  refresh_expiry: 24

cors:
  allowed_origins:
    - https://yourdomain.com
    - chrome-extension://*
  allowed_methods:
    - GET
    - POST
    - PUT
    - DELETE
    - OPTIONS
  allowed_headers:
    - Content-Type
    - Authorization
    - X-Request-ID
  max_age: 86400
```

## Database Setup

### 1. PostgreSQL Installation and Setup

#### Ubuntu/Debian
```bash
# Install PostgreSQL
sudo apt update
sudo apt install postgresql postgresql-contrib

# Start PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database user
sudo -u postgres createuser --interactive

# Create database
sudo -u postgres createdb silence_notes
```

#### macOS
```bash
# Install with Homebrew
brew install postgresql
brew services start postgresql

# Create user and database
createuser -s postgres
createdb silence_notes
```

### 2. Database Migration

```bash
# Run database migrations using golang-migrate
migrate -path migrations -database "postgres://user:password@localhost/silence_notes?sslmode=require" up
```

### 3. Create Database User

```sql
-- Connect to PostgreSQL
sudo -u postgres psql

-- Create user with limited privileges
CREATE USER silence_notes_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE silence_notes TO silence_notes_user;

-- Exit PostgreSQL
\q
```

## Development Deployment

### 1. Local Development

```bash
# Run the server
go run cmd/server/main.go

# Or with hot reload using air
air
```

### 2. Test Environment

```bash
# Set test environment
export APP_ENVIRONMENT=test

# Run tests
go test ./...

# Run tests with coverage
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out
```

### 3. Environment-Specific Configurations

#### Development Environment
- Relaxed security settings
- Verbose logging enabled
- CORS allows localhost origins
- Higher rate limits for testing

#### Test Environment
- In-memory database or isolated test database
- Mocked external services
- Fast configuration for automated testing

#### Production Environment
- Strict security settings
- Minimal logging
- Restricted CORS origins
- Optimized rate limits

## Production Deployment

### 1. Build the Application

```bash
# Build for Linux (production)
GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o silence-notes-server cmd/server/main.go

# Build with version info
VERSION=$(git describe --tags --always --dirty)
GOOS=linux GOARCH=amd64 go build -ldflags="-s -w -X main.version=$VERSION" -o silence-notes-server cmd/server/main.go
```

### 2. Systemd Service (Linux)

Create a systemd service file:

```bash
sudo nano /etc/systemd/system/silence-notes.service
```

```ini
[Unit]
Description=Silence Notes Backend API
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=silence-notes
Group=silence-notes
WorkingDirectory=/opt/silence-notes
ExecStart=/opt/silence-notes/silence-notes-server
Restart=always
RestartSec=5
Environment=APP_ENVIRONMENT=production
Environment=GO_ENV=production

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/silence-notes/logs

# Resource limits
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start the service
sudo systemctl daemon-reload
sudo systemctl enable silence-notes
sudo systemctl start silence-notes

# Check status
sudo systemctl status silence-notes
```

### 3. Nginx Reverse Proxy

```nginx
# /etc/nginx/sites-available/silence-notes
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    # SSL configuration
    ssl_certificate /path/to/ssl/cert.pem;
    ssl_certificate_key /path/to/ssl/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req zone=api burst=20 nodelay;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }

    # Health check endpoint (no rate limiting)
    location /api/v1/health {
        proxy_pass http://127.0.0.1:8080;
        limit_req zone=api burst=100 nodelay;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/silence-notes /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Docker Deployment

### 1. Dockerfile

```dockerfile
# Dockerfile
FROM golang:1.21-alpine AS builder

# Install dependencies
RUN apk add --no-cache git ca-certificates

WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build application
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o silence-notes-server cmd/server/main.go

# Final stage
FROM alpine:latest

# Install ca-certificates for HTTPS
RUN apk --no-cache add ca-certificates

WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/silence-notes-server .

# Create non-root user
RUN addgroup -g 1001 -S silence-notes && \
    adduser -u 1001 -S silence-notes -G silence-notes

# Change ownership
RUN chown -R silence-notes:silence-notes /app

USER silence-notes

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/api/v1/health || exit 1

# Run application
CMD ["./silence-notes-server"]
```

### 2. Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "8080:8080"
    environment:
      - APP_ENVIRONMENT=production
      - DB_HOST=postgres
      - DB_PASSWORD=secure_password
      - REDIS_HOST=redis
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:8080/api/v1/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=silence_notes
      - POSTGRES_USER=silence_notes
      - POSTGRES_PASSWORD=secure_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./migrations:/docker-entrypoint-initdb.d
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U silence_notes"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - app
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

### 3. Running with Docker

```bash
# Build and run with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f app

# Scale the application
docker-compose up -d --scale app=3

# Stop and remove
docker-compose down
```

## Monitoring and Logging

### 1. Application Logging

The application uses structured logging with different levels:

```go
// Log levels: error, warn, info, debug
logger.Info("Server starting", "port", 8080, "environment", "production")
logger.Error("Database connection failed", "error", err)
```

### 2. Log Rotation

```bash
# Configure log rotation
sudo nano /etc/logrotate.d/silence-notes
```

```
/opt/silence-notes/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 silence-notes silence-notes
    postrotate
        systemctl reload silence-notes
    endscript
}
```

### 3. Monitoring with Prometheus

Add Prometheus metrics to the application:

```go
import "github.com/prometheus/client_golang/prometheus"

var (
    httpRequestsTotal = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "http_requests_total",
            Help: "Total number of HTTP requests",
        },
        []string{"method", "endpoint", "status"},
    )

    httpRequestDuration = prometheus.NewHistogramVec(
        prometheus.HistogramOpts{
            Name: "http_request_duration_seconds",
            Help: "HTTP request duration in seconds",
        },
        []string{"method", "endpoint"},
    )
)
```

### 4. Health Checks

The application provides comprehensive health check endpoints:

- `/api/v1/health` - Basic health check
- `/api/v1/health/detailed` - Detailed health with dependencies
- `/api/v1/health/ready` - Readiness probe
- `/api/v1/health/live` - Liveness probe

## Security Considerations

### 1. Production Security Checklist

- [ ] Use HTTPS with valid SSL certificates
- [ ] Enable HSTS with preload
- [ ] Configure strict CORS policies
- [ ] Use strong JWT secrets (32+ characters)
- [ ] Enable database SSL connections
- [ ] Regularly update dependencies
- [ ] Enable security headers
- [ ] Configure rate limiting
- [ ] Set up monitoring and alerting
- [ ] Regular security audits

### 2. Security Headers

The application automatically adds security headers:

```http
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains
Referrer-Policy: strict-origin-when-cross-origin
Content-Security-Policy: default-src 'self'; script-src 'self'; ...
```

### 3. Rate Limiting

Default rate limits in production:

- **Global**: 50 requests/second
- **Per User**: 30 requests/minute, 500 requests/hour, 5000 requests/day
- **Auth endpoints**: 5 requests/minute
- **Profile endpoints**: 15 requests/minute
- **Search endpoints**: 10 requests/minute

### 4. Database Security

```sql
-- Create read-only user for reporting
CREATE USER reporting_user WITH PASSWORD 'secure_password';
GRANT SELECT ON ALL TABLES IN SCHEMA public TO reporting_user;

-- Regularly rotate passwords
ALTER USER silence_notes_user WITH PASSWORD 'new_secure_password';
```

## Troubleshooting

### 1. Common Issues

#### Application Won't Start
```bash
# Check configuration
./silence-notes-server -config-file config.yaml

# Check logs
journalctl -u silence-notes -f

# Check port conflicts
sudo netstat -tlnp | grep :8080
```

#### Database Connection Issues
```bash
# Test database connection
psql -h localhost -U silence_notes_user -d silence_notes

# Check PostgreSQL status
sudo systemctl status postgresql

# Check database logs
sudo tail -f /var/log/postgresql/postgresql-15-main.log
```

#### Rate Limiting Issues
```bash
# Check current rate limits
curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://api.yourdomain.com/api/v1/security/rate-limit

# Reset rate limits (if needed)
# This requires administrative access to the rate limiting store
```

### 2. Performance Tuning

#### Database Optimization
```sql
-- Create indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_active ON user_sessions(is_active);
```

#### Application Tuning
```bash
# Adjust worker connections
export GOMAXPROCS=4

# Enable memory profiling
go tool pprof http://localhost:8080/debug/pprof/heap
```

### 3. Backup and Recovery

#### Database Backup
```bash
# Create backup
pg_dump -h localhost -U silence_notes_user silence_notes > backup.sql

# Automated backup with cron
0 2 * * * pg_dump -h localhost -U silence_notes_user silence_notes | gzip > /backups/silence-notes-$(date +\%Y\%m\%d).sql.gz
```

#### Application Backup
```bash
# Backup configuration and binaries
tar -czf silence-notes-backup-$(date +%Y%m%d).tar.gz \
    /opt/silence-notes/config.yaml \
    /opt/silence-notes/silence-notes-server \
    /etc/systemd/system/silence-notes.service
```

### 4. Monitoring Alerts

Set up alerts for:

- Application downtime (> 1 minute)
- High error rate (> 5%)
- High memory usage (> 80%)
- High CPU usage (> 80%)
- Database connection issues
- Rate limit violations
- Security events

### 5. Getting Help

If you encounter issues:

1. Check the [GitHub Issues](https://github.com/gpd/my-notes/issues)
2. Review the [API Documentation](./api/openapi.yaml)
3. Check the [Troubleshooting Guide](./TROUBLESHOOTING.md)
4. Enable debug logging for detailed information

```bash
export APP_LOG_LEVEL=debug
export APP_DEBUG=true
./silence-notes-server
```

## Support

For additional support:

- **Documentation**: [https://docs.silencenotes.com](https://docs.silencenotes.com)
- **GitHub Repository**: [https://github.com/gpd/my-notes](https://github.com/gpd/my-notes)
- **Community Forum**: [https://community.silencenotes.com](https://community.silencenotes.com)
- **Email**: support@silenzenotes.com