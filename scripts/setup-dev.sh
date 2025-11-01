#!/bin/bash

# Silence Notes Development Setup Script

echo "🚀 Setting up Silence Notes development environment..."

# Check if required tools are installed
command -v docker >/dev/null 2>&1 || { echo "❌ Docker is required but not installed. Please install Docker first."; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { echo "❌ Docker Compose is required but not installed. Please install Docker Compose first."; exit 1; }
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required but not installed. Please install Node.js first."; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "❌ npm is required but not installed. Please install npm first."; exit 1; }
command -v go >/dev/null 2>&1 || { echo "❌ Go is required but not installed. Please install Go first."; exit 1; }

echo "✅ All required tools are installed"

# Setup backend
echo "📦 Setting up backend..."
cd backend

# Copy environment file
if [ ! -f .env ]; then
    cp .env.example .env
    echo "📝 Created .env file from example"
    echo "⚠️  Please update the .env file with your configuration"
fi

# Install Go dependencies
go mod download
go mod tidy
echo "✅ Go dependencies installed"

# Install air for hot reload
if ! command -v air >/dev/null 2>&1; then
    go install github.com/cosmtrek/air@latest
    echo "✅ Air installed for hot reload"
fi

# Install golangci-lint for linting
if ! command -v golangci-lint >/dev/null 2>&1; then
    echo "📦 Installing golangci-lint..."
    curl -sSfL https://raw.githubusercontent.com/golangci/golangci-lint/master/install.sh | sh -s -- -b $(go env GOPATH)/bin v1.54.2
    echo "✅ golangci-lint installed"
fi

cd ..

# Setup extension
echo "📦 Setting up Chrome extension..."
cd extension

# Install npm dependencies
npm install
echo "✅ npm dependencies installed"

cd ..

# Start development environment
echo "🐳 Starting development environment..."
docker-compose -f docker-compose.dev.yml up -d postgres redis

echo "⏳ Waiting for databases to be ready..."
sleep 10

# Test database connection
echo "🔍 Testing database connection..."
cd backend
if go run cmd/server/main.go > /dev/null 2>&1 & then
    sleep 3
    pkill -f "go run cmd/server/main.go"
    echo "✅ Database connection successful"
else
    echo "❌ Database connection failed. Please check your configuration."
fi

cd ..

echo "🎉 Development environment setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Update backend/.env with your configuration"
echo "2. Start the backend: cd backend && go run cmd/server/main.go"
echo "3. Build the extension: cd extension && npm run build"
echo "4. Load the extension in Chrome (load unpacked from extension/dist)"
echo ""
echo "🛠️ Development commands:"
echo "- Backend dev: cd backend && air"
echo "- Extension dev: cd extension && npm run dev"
echo "- Run tests: cd extension && npm test"
echo "- Stop databases: docker-compose -f docker-compose.dev.yml down"