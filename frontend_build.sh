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
echo -e "${BLUE}  Silence Notes - Frontend Build${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if extension directory exists
if [ ! -d "$EXTENSION_DIR" ]; then
    echo -e "${RED}Error: Extension directory not found at $EXTENSION_DIR${NC}"
    exit 1
fi

# Clean previous build
echo -e "${YELLOW}Cleaning previous build...${NC}"
npm run --prefix extension clean 2>/dev/null || rm -rf "$EXTENSION_DIR/dist"
echo -e "${GREEN}Clean complete${NC}"
echo ""

# Run build (default to dev mode for local development)
echo -e "${YELLOW}Building extension (dev mode)...${NC}"
echo -e "${YELLOW}Use 'npm run --prefix extension build' for production build${NC}"
if npm run --prefix extension build:dev; then
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  Build Completed Successfully!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo -e "${BLUE}Build output location:${NC} $EXTENSION_DIR/dist"
    echo ""
    echo -e "${BLUE}To load in Chrome:${NC}"
    echo -e "  1. Open Chrome and navigate to ${YELLOW}chrome://extensions/${NC}"
    echo -e "  2. Enable ${YELLOW}'Developer mode'${NC} (toggle in top-right)"
    echo -e "  3. Click ${YELLOW}'Load unpacked'${NC} button"
    echo -e "  4. Select the folder: ${YELLOW}$EXTENSION_DIR/dist${NC}"
    echo ""
    echo -e "${BLUE}To reload after rebuild:${NC}"
    echo -e "  - Go to ${YELLOW}chrome://extensions/${NC}"
    echo -e "  - Click the refresh icon on the extension card"
    echo ""
else
    echo ""
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}  Build Failed!${NC}"
    echo -e "${RED}========================================${NC}"
    exit 1
fi
