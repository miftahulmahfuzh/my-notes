.PHONY: help setup build test clean dev-backend dev-extension lint format

# Default target
help:
	@echo "Silence Notes Development Commands"
	@echo ""
	@echo "Setup:"
	@echo "  setup         - Set up development environment"
	@echo "  clean         - Clean build artifacts and dependencies"
	@echo ""
	@echo "Development:"
	@echo "  dev-backend   - Start backend in development mode"
	@echo "  dev-extension - Build extension in development mode"
	@echo "  dev           - Start both backend and extension"
	@echo ""
	@echo "Building:"
	@echo "  build         - Build both backend and extension"
	@echo "  build-backend - Build backend binary"
	@echo "  build-extension - Build extension for production"
	@echo ""
	@echo "Testing:"
	@echo "  test          - Run all tests"
	@echo "  test-backend  - Run backend tests"
	@echo "  test-extension - Run extension tests"
	@echo "  coverage      - Generate test coverage reports"
	@echo ""
	@echo "Quality:"
	@echo "  lint          - Run linting for both projects"
	@echo "  lint-backend  - Lint backend code"
	@echo "  lint-extension - Lint extension code"
	@echo "  format        - Format all code"
	@echo "  format-backend - Format Go code"
	@echo "  format-extension - Format TypeScript code"
	@echo ""
	@echo "Docker:"
	@echo "  docker-up     - Start development containers"
	@echo "  docker-down   - Stop development containers"
	@echo "  docker-logs   - Show container logs"

# Setup commands
setup:
	@./scripts/setup-dev.sh

# Development commands
dev-backend:
	@echo "🔧 Starting backend in development mode..."
	@cd backend && air

dev-extension:
	@echo "🔧 Building extension in development mode..."
	@cd extension && npm run dev

dev: dev-backend
	@echo "🔧 Building extension..."
	@cd extension && npm run build

# Building commands
build: build-backend build-extension

build-backend:
	@echo "🏗️ Building backend..."
	@cd backend && go build -o server ./cmd/server

build-extension:
	@echo "🏗️ Building extension..."
	@cd extension && npm run build

# Testing commands
test: test-backend test-extension

test-backend:
	@echo "🧪 Running backend tests..."
	@cd backend && go test -v ./...

test-extension:
	@echo "🧪 Running extension tests..."
	@cd extension && npm test

coverage:
	@echo "📊 Generating coverage reports..."
	@cd backend && go test -coverprofile=coverage.out ./...
	@cd extension && npm run test:coverage

# Quality commands
lint: lint-backend lint-extension

lint-backend:
	@echo "🔍 Linting backend code..."
	@cd backend && golangci-lint run

lint-extension:
	@echo "🔍 Linting extension code..."
	@cd extension && npm run lint

format: format-backend format-extension

format-backend:
	@echo "💅 Formatting Go code..."
	@cd backend && go fmt ./...

format-extension:
	@echo "💅 Formatting TypeScript code..."
	@cd extension && npm run lint:fix

# Docker commands
docker-up:
	@echo "🐳 Starting development containers..."
	@docker-compose -f docker-compose.dev.yml up -d postgres redis

docker-down:
	@echo "🐳 Stopping development containers..."
	@docker-compose -f docker-compose.dev.yml down

docker-logs:
	@echo "📋 Showing container logs..."
	@docker-compose -f docker-compose.dev.yml logs -f

# Clean commands
clean:
	@echo "🧹 Cleaning build artifacts..."
	@cd backend && rm -rf bin/ tmp/ coverage.out
	@cd extension && rm -rf dist/ coverage/
	@go clean -cache -modcache -testcache
	@npm cache clean --force

# Install dependencies
deps:
	@echo "📦 Installing dependencies..."
	@cd backend && go mod download && go mod tidy
	@cd extension && npm install