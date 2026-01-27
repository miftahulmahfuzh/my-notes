#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXTENSION_DIR="$PROJECT_ROOT/extension"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Silence Notes - Frontend Tests${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if extension directory exists
if [ ! -d "$EXTENSION_DIR" ]; then
    echo -e "${RED}Error: Extension directory not found at $EXTENSION_DIR${NC}"
    exit 1
fi

# Check if node_modules exists in extension directory
if [ ! -d "$EXTENSION_DIR/node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    cd "$EXTENSION_DIR"
    npm install
    cd "$PROJECT_ROOT"
fi

# Run tests with coverage from project root
echo -e "${YELLOW}Running tests with coverage...${NC}"
if npx jest --config="$EXTENSION_DIR/jest.config.js" --coverage; then
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  All Tests Passed!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo -e "${BLUE}Coverage report available at:${NC}"
    echo -e "  ${YELLOW}file://$EXTENSION_DIR/coverage/index.html${NC}"
    echo ""
    echo -e "${BLUE}Coverage summary:${NC}"
    cat "$EXTENSION_DIR/coverage/coverage-summary.json" | grep -o '"total"[^}]*' | head -1
    exit 0
else
    echo ""
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}  Tests Failed!${NC}"
    echo -e "${RED}========================================${NC}"
    exit 1
fi
