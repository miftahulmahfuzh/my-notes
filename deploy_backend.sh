#!/bin/bash

# Use local PostgreSQL instead of Docker
echo "Using local PostgreSQL (PostgreSQL 16)"

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
until pg_isready -h localhost -p 5433 > /dev/null 2>&1; do
  sleep 1
done
echo "PostgreSQL is ready!"

# Kill existing process on port 8080
echo "Checking for existing process on port 8080..."
if lsof -t -i:8080 > /dev/null 2>&1; then
  kill -9 $(lsof -t -i:8080)
  echo "Killed existing process on port 8080"
else
  echo "No existing process found on port 8080"
fi

# Export database connection variables for the backend
export DB_NAME=my_notes_test
export DB_USER=test_user
export DB_PASSWORD=test_password
export DB_HOST=localhost
export DB_PORT=5433
export DB_SSLMODE=disable

# Start backend server
echo "Starting backend server on :8080..."
./backend/server &
SERVER_PID=$!
echo "Backend server started in background. PID: $SERVER_PID"
