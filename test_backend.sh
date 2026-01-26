#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Silence Notes - Backend Tests${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if backend directory exists
if [ ! -d "$BACKEND_DIR" ]; then
    echo -e "${RED}Error: Backend directory not found at $BACKEND_DIR${NC}"
    exit 1
fi

# Change to backend directory
cd "$BACKEND_DIR" || exit 1

# Function to run a test suite
run_test_suite() {
    local test_name="$1"
    local test_path="$2"
    local skip_env_check="$3"

    echo -e "${YELLOW}Running: $test_name${NC}"
    echo -e "${BLUE}Path: $test_path${NC}"

    # Check if PostgreSQL tests should be skipped
    if [ "$skip_env_check" != "skip" ] && [ "$USE_POSTGRE_DURING_TEST" != "true" ]; then
        echo -e "${YELLOW}Skipping (requires USE_POSTGRE_DURING_TEST=true)${NC}"
        echo ""
        return 0
    fi

    if go test -v $test_path; then
        echo -e "${GREEN}✓ $test_name PASSED${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗ $test_name FAILED${NC}"
        ((TESTS_FAILED++))
    fi
    ((TESTS_RUN++))
    echo ""
}

# ============================================================================
# FRONTEND-RELATED BACKEND TESTS
# ============================================================================
# Based on API endpoints called by frontend:
# - Auth: POST /api/v1/auth/chrome, POST /api/v1/auth/refresh, DELETE /api/v1/auth/logout
# - Notes: GET/POST/PUT/DELETE /api/v1/notes
# - Search: GET /api/v1/search/notes
# - Templates: GET /api/v1/templates, GET /api/v1/templates/built-in, POST /api/v1/templates/{id}/apply
# - Export/Import: GET/POST /api/v1/export, /api/v1/import
# - Health: GET /api/v1/health
# - Stats: GET /api/v1/notes/stats, GET /api/v1/notes/sync
# ============================================================================

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Handler Tests (Frontend Endpoints)${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Notes Handler Tests (handles GET/POST/PUT/DELETE /api/v1/notes, GET /api/v1/search/notes, GET /api/v1/notes/stats, GET /api/v1/notes/sync)
run_test_suite "Notes Integration Tests" "./tests/handlers/notes_integration_test.go" ""

# Auth Handler Tests (handles POST /api/v1/auth/refresh, DELETE /api/v1/auth/logout)
run_test_suite "Auth Refresh Token Tests" "./tests/handlers/refresh_test.go ./tests/handlers/mocks.go" "skip"

# User Handler Tests (handles GET/PUT /api/v1/user/profile, /api/v1/user/preferences, /api/v1/user/sessions)
run_test_suite "User Handler Tests" "./tests/handlers/user_test.go ./tests/handlers/mocks.go" "skip"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Service Tests${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Note Service Tests (business logic for notes)
run_test_suite "Note Service Tests" "./internal/services/note_service_test.go" ""

# Note Service Enhanced Tests
run_test_suite "Note Service Enhanced Tests" "./internal/services/note_service_enhanced_test.go" ""

# Tag Service Tests (business logic for tags, used by notes)
run_test_suite "Tag Service Tests" "./internal/services/tag_service_test.go" ""

# Tags Handler Tests
run_test_suite "Tags Handler Tests" "./internal/handlers/tags_test.go" "skip"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Template Tests${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Template Service Tests (handles template management)
run_test_suite "Template Tests" "./tests/template/template_test.go" ""

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Authentication Tests${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# JWT Token Tests (handles JWT generation/validation for Chrome auth)
run_test_suite "JWT Tests" "./tests/auth/jwt_test.go" "skip"

# JWT Validation Tests
run_test_suite "JWT Validation Tests" "./tests/auth/jwt_validation_test.go ./tests/auth/jwt_test.go" "skip"

# OAuth Service Tests (handles Google OAuth integration)
run_test_suite "OAuth Service Tests" "./tests/auth/oauth_service_test.go" "skip"

# PKCE Tests (OAuth flow)
run_test_suite "PKCE Tests" "./tests/auth/pkce_test.go" "skip"

# Google Config Tests
run_test_suite "Google Config Tests" "./tests/auth/google_config_test.go" "skip"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Middleware Tests${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Security Middleware Tests (handles auth middleware for protected routes)
run_test_suite "Security Middleware Tests" "./tests/middleware/security_test.go" "skip"

# Session Middleware Tests (handles session management)
run_test_suite "Session Middleware Tests" "./tests/middleware/session_test.go" "skip"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Integration Tests${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Auth Flow Integration Tests
run_test_suite "Auth Flow Integration Tests" "./tests/integration/auth_flow_test.go" ""

# Security Integration Tests
run_test_suite "Security Integration Tests" "./tests/integration/security_test.go" ""

# Server Tests
run_test_suite "Server Tests" "./tests/server_test.go" "skip"

# Migrations Tests
run_test_suite "Migrations Tests" "./tests/migrations_test.go" ""

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Test Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "Total Tests Run:    ${BLUE}$TESTS_RUN${NC}"
echo -e "Tests Passed:       ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed:       ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  All Tests Passed!${NC}"
    echo -e "${GREEN}========================================${NC}"
    exit 0
else
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}  Some Tests Failed!${NC}"
    echo -e "${RED}========================================${NC}"
    exit 1
fi
