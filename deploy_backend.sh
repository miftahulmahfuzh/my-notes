#!/bin/bash

# Stop existing container
docker container stop my-notes-postgres

# Remove existing container
docker container rm my-notes-postgres

# Run new PostgreSQL container with persistent volume
docker run --name my-notes-postgres \
  -e POSTGRES_DB=my_notes_test \
  -e POSTGRES_USER=test_user \
  -e POSTGRES_PASSWORD=test_password \
  -p 5432:5432 \
  -v my_notes_postgres_data:/var/lib/postgresql/data \
  -d postgres:15

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to start..."
until docker exec my-notes-postgres pg_isready -U test_user -d my_notes_test > /dev/null 2>&1; do
  sleep 1
done
echo "PostgreSQL is ready!"

# Export database connection variables for the backend
export DB_NAME=my_notes_test
export DB_USER=test_user
export DB_PASSWORD=test_password
export DB_HOST=localhost
export DB_PORT=5432
export DB_SSLMODE=disable

# Start backend server
echo "Starting backend server on :8080..."
./backend/server &
SERVER_PID=$!
echo "Backend server started in background. PID: $SERVER_PID"
