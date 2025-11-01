# PostgreSQL Setup and Management Guide

This guide covers how to set up, manage, and test with PostgreSQL using Docker for the Silence Notes application.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Docker PostgreSQL Setup](#docker-postgresql-setup)
3. [Database Management](#database-management)
4. [Database Inspection](#database-inspection)
5. [Testing with PostgreSQL](#testing-with-postgresql)
6. [Troubleshooting](#troubleshooting)
7. [Advanced Operations](#advanced-operations)

## Quick Start

```bash
# Start PostgreSQL container
docker run --name my-notes-postgres \
  -e POSTGRES_DB=my_notes_test \
  -e POSTGRES_USER=test_user \
  -e POSTGRES_PASSWORD=test_password \
  -p 5432:5432 \
  -d postgres:15

# Run tests
export TEST_DB_HOST=localhost \
  TEST_DB_PORT=5432 \
  TEST_DB_USER=test_user \
  TEST_DB_PASSWORD=test_password
go -C backend test -v ./tests
```

## Docker PostgreSQL Setup

### Initial Setup

The application uses PostgreSQL 15 running in a Docker container. Here's how to set it up:

```bash
# Pull and start PostgreSQL container
docker run --name my-notes-postgres \
  -e POSTGRES_DB=my_notes_test \
  -e POSTGRES_USER=test_user \
  -e POSTGRES_PASSWORD=test_password \
  -p 5432:5432 \
  -d postgres:15
```

**Container Configuration:**
- **Container Name**: `my-notes-postgres`
- **Database Name**: `my_notes_test`
- **User**: `test_user`
- **Password**: `test_password`
- **Port**: `5432` (mapped to host)
- **PostgreSQL Version**: `15`

### Environment Variables

Create a `.env` file in the `backend/` directory:

```bash
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=my_notes_test
DB_USER=test_user
DB_PASSWORD=test_password
DB_SSLMODE=disable

# Test Database Configuration (for tests)
TEST_DB_HOST=localhost
TEST_DB_PORT=5432
TEST_DB_NAME=my_notes_test
TEST_DB_USER=test_user
TEST_DB_PASSWORD=test_password
TEST_DB_SSLMODE=disable
```

### Container Management Commands

```bash
# Check if container is running
docker ps | grep my-notes-postgres

# Start container (if stopped)
docker start my-notes-postgres

# Stop container
docker stop my-notes-postgres

# Restart container
docker restart my-notes-postgres

# Remove container (will delete all data)
docker rm my-notes-postgres

# View container logs
docker logs my-notes-postgres

# Follow container logs in real-time
docker logs -f my-notes-postgres
```

### Data Persistence

For development, you might want to persist data:

```bash
# Create a volume for data persistence
docker volume create my-notes-postgres-data

# Start container with persistent volume
docker run --name my-notes-postgres \
  -e POSTGRES_DB=my_notes_test \
  -e POSTGRES_USER=test_user \
  -e POSTGRES_PASSWORD=test_password \
  -p 5432:5432 \
  -v my-notes-postgres-data:/var/lib/postgresql/data \
  -d postgres:15
```

## Database Management

### Connecting to PostgreSQL

#### Using Docker Exec (Recommended)

```bash
# Connect to the database directly
docker exec -it my-notes-postgres psql -U test_user -d my_notes_test

# Connect without interactive mode
docker exec my-notes-postgres psql -U test_user -d my_notes_test -c "SELECT version();"
```

#### Using External Tools

You can also connect using GUI tools like DBeaver, pgAdmin, or DataGrip:

- **Host**: `localhost`
- **Port**: `5432`
- **Database**: `my_notes_test`
- **Username**: `test_user`
- **Password**: `test_password`

### Basic Database Operations

```bash
# List all databases
docker exec my-notes-postgres psql -U test_user -d postgres -c "\l"

# Connect to a specific database
docker exec -it my-notes-postgres psql -U test_user -d my_notes_test

# List all tables in current database
docker exec my-notes-postgres psql -U test_user -d my_notes_test -c "\dt"

# List all tables with details
docker exec my-notes-postgres psql -U test_user -d my_notes_test -c "\dt+"

# Show table structure
docker exec my-notes-postgres psql -U test_user -d my_notes_test -c "\d users"
docker exec my-notes-postgres psql -U test_user -d my_notes_test -c "\d notes"
docker exec my-notes-postgres psql -U test_user -d my_notes_test -c "\d tags"
docker exec my-notes-postgres psql -U test_user -d my_notes_test -c "\d note_tags"

# Show all schemas
docker exec my-notes-postgres psql -U test_user -d my_notes_test -c "\dn"

# Show migration status
docker exec my-notes-postgres psql -U test_user -d my_notes_test -c "SELECT * FROM schema_migrations ORDER BY version;"
```

## Database Inspection

### Checking Application Tables

The Silence Notes application creates the following tables:

```bash
# Check if all tables exist
docker exec my-notes-postgres psql -U test_user -d my_notes_test -c "
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
"

# Check table structures
echo "=== Users Table ==="
docker exec my-notes-postgres psql -U test_user -d my_notes_test -c "\d users"

echo "=== Notes Table ==="
docker exec my-notes-postgres psql -U test_user -d my_notes_test -c "\d notes"

echo "=== Tags Table ==="
docker exec my-notes-postgres psql -U test_user -d my_notes_test -c "\d tags"

echo "=== Note Tags Table ==="
docker exec my-notes-postgres psql -U test_user -d my_notes_test -c "\d note_tags"
```

### Checking Data and Constraints

```bash
# Check row counts in all tables
docker exec my-notes-postgres psql -U test_user -d my_notes_test -c "
SELECT
    schemaname,
    tablename,
    n_tup_ins as total_inserts,
    n_tup_upd as total_updates,
    n_tup_del as total_deletes,
    n_live_tup as live_rows,
    n_dead_tup as dead_rows
FROM pg_stat_user_tables
ORDER BY tablename;
"

# Check foreign key constraints
docker exec my-notes-postgres psql -U test_user -d my_notes_test -c "
SELECT
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY';
"

# Check indexes
docker exec my-notes-postgres psql -U test_user -d my_notes_test -c "\di"

# Check triggers
docker exec my-notes-postgres psql -U test_user -d my_notes_test -c "SELECT tgname FROM pg_trigger WHERE tgname LIKE '%version%';"
```

### Sample Data Inspection

```bash
# Insert sample data for testing
docker exec my-notes-postgres psql -U test_user -d my_notes_test -c "
-- Insert sample user
INSERT INTO users (id, google_id, email, name, created_at, updated_at)
VALUES (
    gen_random_uuid(),
    'google_test_123',
    'test@example.com',
    'Test User',
    NOW(),
    NOW()
) ON CONFLICT (google_id) DO NOTHING;

-- Insert sample note
INSERT INTO notes (id, user_id, title, content, version, created_at, updated_at)
SELECT
    gen_random_uuid(),
    id,
    'Test Note',
    'This is a test note with #hashtag content',
    1,
    NOW(),
    NOW()
FROM users
WHERE google_id = 'google_test_123'
LIMIT 1;

-- Check the data
SELECT 'Users:' as table_name;
SELECT id, email, name, created_at FROM users WHERE google_id = 'google_test_123';

SELECT 'Notes:' as table_name;
SELECT id, title, content, version, created_at FROM notes ORDER BY created_at DESC LIMIT 5;
"
```

## Testing with PostgreSQL

### Running Application Tests

The application tests create temporary databases for each test run:

```bash
# Set up environment variables for testing
export TEST_DB_HOST=localhost \
  TEST_DB_PORT=5432 \
  TEST_DB_USER=test_user \
  TEST_DB_PASSWORD=test_password

# Run all tests
go -C backend test -v ./tests

# Run specific test suites
go -C backend test -v ./tests -run TestMigrationsUp
go -C backend test -v ./tests -run TestModels
go -C backend test -v ./tests -run TestConfig

# Run tests with coverage
go -C backend test -v -cover ./tests
```

### Test Database Behavior

The testing framework automatically:

1. **Creates unique test databases** with names like `_test_[timestamp]`
2. **Runs migrations** on each test database
3. **Cleans up** databases after tests complete

You can monitor this process:

```bash
# Watch test databases being created and dropped
watch "docker exec my-notes-postgres psql -U test_user -d postgres -c \"SELECT datname FROM pg_database WHERE datname LIKE '_test_%' ORDER BY datname;\""

# Check active connections
docker exec my-notes-postgres psql -U test_user -d postgres -c "
SELECT
    datname as database,
    usename as username,
    application_name,
    state,
    query_start
FROM pg_stat_activity
WHERE datname LIKE '%test%'
ORDER BY query_start;
"
```

### Manual Database Testing

You can manually test database operations:

```bash
# Create a test table
docker exec my-notes-postgres psql -U test_user -d my_notes_test -c "
CREATE TABLE IF NOT EXISTS test_table (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
"

# Insert test data
docker exec my-notes-postgres psql -U test_user -d my_notes_test -c "
INSERT INTO test_table (name) VALUES ('Test Entry 1'), ('Test Entry 2');
"

# Query test data
docker exec my-notes-postgres psql -U test_user -d my_notes_test -c "
SELECT * FROM test_table ORDER BY created_at DESC;
"

# Clean up test table
docker exec my-notes-postgres psql -U test_user -d my_notes_test -c "DROP TABLE IF EXISTS test_table;"
```

## Troubleshooting

### Common Issues

#### Connection Refused

```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Check if port is accessible
telnet localhost 5432

# Restart PostgreSQL container
docker restart my-notes-postgres
```

#### Authentication Failed

```bash
# Check credentials
docker exec my-notes-postgres psql -U test_user -d my_notes_test -c "SELECT current_user, current_database();"

# Reset password if needed
docker exec my-notes-postgres psql -U postgres -d postgres -c "ALTER USER test_user PASSWORD 'test_password';"
```

#### Database Not Found

```bash
# List all databases
docker exec my-notes-postgres psql -U test_user -d postgres -c "\l"

# Create database if missing
docker exec my-notes-postgres psql -U test_user -d postgres -c "CREATE DATABASE my_notes_test;"
```

#### Permission Issues

```bash
# Grant permissions to user
docker exec my-notes-postgres psql -U postgres -d postgres -c "
GRANT ALL PRIVILEGES ON DATABASE my_notes_test TO test_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO test_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO test_user;
"
```

### Container Issues

#### Container Won't Start

```bash
# Check container logs
docker logs my-notes-postgres

# Remove and recreate container
docker rm -f my-notes-postgres
docker run --name my-notes-postgres \
  -e POSTGRES_DB=my_notes_test \
  -e POSTGRES_USER=test_user \
  -e POSTGRES_PASSWORD=test_password \
  -p 5432:5432 \
  -d postgres:15
```

#### Out of Disk Space

```bash
# Check container disk usage
docker system df

# Clean up unused containers and images
docker system prune -a

# Check PostgreSQL disk usage
docker exec my-notes-postgres psql -U test_user -d my_notes_test -c "
SELECT
    pg_size_pretty(pg_database_size(current_database())) as database_size,
    pg_size_pretty(pg_total_relation_size('users')) as users_size,
    pg_size_pretty(pg_total_relation_size('notes')) as notes_size,
    pg_size_pretty(pg_total_relation_size('tags')) as tags_size;
"
```

## Advanced Operations

### Backup and Restore

```bash
# Create backup
docker exec my-notes-postgres pg_dump -U test_user my_notes_test > backup.sql

# Restore from backup
docker exec -i my-notes-postgres psql -U test_user my_notes_test < backup.sql

# Create compressed backup
docker exec my-notes-postgres pg_dump -U test_user my_notes_test | gzip > backup.sql.gz

# Restore from compressed backup
gunzip -c backup.sql.gz | docker exec -i my-notes-postgres psql -U test_user my_notes_test
```

### Performance Monitoring

```bash
# Check active queries
docker exec my-notes-postgres psql -U test_user -d my_notes_test -c "
SELECT
    pid,
    now() - pg_stat_activity.query_start AS duration,
    query,
    state
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes'
ORDER BY duration DESC;
"

# Check table sizes
docker exec my-notes-postgres psql -U test_user -d my_notes_test -c "
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as index_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
"

# Check query statistics
docker exec my-notes-postgres psql -U test_user -d my_notes_test -c "
SELECT
    query,
    calls,
    total_time,
    mean_time,
    rows
FROM pg_stat_statements
ORDER BY total_time DESC
LIMIT 10;
"
```

### Database Maintenance

```bash
# Analyze table statistics
docker exec my-notes-postgres psql -U test_user -d my_notes_test -c "ANALYZE;"

# Vacuum tables
docker exec my-notes-postgres psql -U test_user -d my_notes_test -c "VACUUM ANALYZE;"

# Reindex database
docker exec my-notes-postgres psql -U test_user -d my_notes_test -c "REINDEX DATABASE my_notes_test;"

# Check for bloat
docker exec my-notes-postgres psql -U test_user -d my_notes_test -c "
SELECT
    current_database(),
    schemaname,
    tablename,
    ROUND(
        (100 * (heap_blks_hit::float / nullif(heap_blks_hit + heap_blks_read, 0)))::numeric, 3
    ) AS cache_hit_ratio
FROM pg_statio_user_tables
ORDER BY heap_blks_hit DESC;
"
```

## Environment Configuration

### Development Environment

For local development, use the provided `.env.example` as a template:

```bash
# Copy example configuration
cp backend/.env.example backend/.env

# Edit configuration
nano backend/.env
```

### Test Environment

Tests use environment variables or fall back to defaults:

```bash
# Set test environment variables
export TEST_DB_HOST=localhost
export TEST_DB_PORT=5432
export TEST_DB_USER=test_user
export TEST_DB_PASSWORD=test_password

# Or use a separate test database
export TEST_DB_NAME=my_notes_test_separate
docker exec my-notes-postgres psql -U test_user -d postgres -c "CREATE DATABASE my_notes_test_separate;"
```

### Production Considerations

For production deployment, consider:

1. **Use secrets management** instead of environment variables
2. **Enable SSL/TLS** connections
3. **Use connection pooling** (PgBouncer)
4. **Set up regular backups**
5. **Monitor performance metrics**
6. **Implement proper logging**

## Quick Reference Commands

```bash
# Start PostgreSQL
docker run --name my-notes-postgres -e POSTGRES_DB=my_notes_test -e POSTGRES_USER=test_user -e POSTGRES_PASSWORD=test_password -p 5432:5432 -d postgres:15

# Connect to database
docker exec -it my-notes-postgres psql -U test_user -d my_notes_test

# List tables
docker exec my-notes-postgres psql -U test_user -d my_notes_test -c "\dt"

# Run tests
export TEST_DB_HOST=localhost TEST_DB_PORT=5432 TEST_DB_USER=test_user TEST_DB_PASSWORD=test_password && go -C backend test -v ./tests

# Check logs
docker logs -f my-notes-postgres

# Stop container
docker stop my-notes-postgres
```

This guide should help you manage PostgreSQL effectively for the Silence Notes application. If you encounter any issues not covered here, please check the [PostgreSQL documentation](https://www.postgresql.org/docs/) or [Docker PostgreSQL documentation](https://hub.docker.com/_/postgres).