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
ZIP_NAME="silence-notes.zip"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Silence Notes - Production Build${NC}"
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

# Run production build
echo -e "${YELLOW}Building extension (PRODUCTION mode)...${NC}"
echo -e "${YELLOW}API: https://my-notes-api-7bnrhx3mka-uc.a.run.app/api/v1${NC}"
if npm run --prefix extension build; then
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  Build Completed Successfully!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
else
    echo ""
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}  Build Failed!${NC}"
    echo -e "${RED}========================================${NC}"
    exit 1
fi

# Generate icons for Chrome Web Store
echo -e "${YELLOW}Generating icons for Chrome Web Store...${NC}"
node -e "
const sharp = require('/tmp/icon-gen/node_modules/sharp');
const sizes = [16, 48, 128];

(async () => {
  for (const size of sizes) {
    const svg = \`<?xml version=\"1.0\" encoding=\"UTF-8\"?>
<svg width=\"\${size}\" height=\"\${size}\" viewBox=\"0 0 \${size} \${size}\" xmlns=\"http://www.w3.org/2000/svg\">
  <rect width=\"\${size}\" height=\"\${size}\" fill=\"#000000\"/>
  <text x=\"\${size/2}\" y=\"\${size/2 + (size*0.05)}\"
        font-family=\"Arial, sans-serif\"
        font-size=\"\${Math.floor(size * 0.7)}\"
        font-weight=\"bold\"
        fill=\"#FFFFFF\"
        text-anchor=\"middle\"
        dominant-baseline=\"middle\">S</text>
</svg>\`;

    await sharp(Buffer.from(svg))
      .resize(size, size)
      .png()
      .toFile(\`$EXTENSION_DIR/dist/icon\${size}.png\`);
  }
  console.log('✅ Icons generated');
})();
" 2>/dev/null || echo -e "${YELLOW}Warning: Icons not generated (sharp not found). Copy manually if needed.${NC}"
echo ""

# Copy icons to dist if not already there
if [ ! -f "$EXTENSION_DIR/dist/icon16.png" ] || [ ! -f "$EXTENSION_DIR/dist/icon48.png" ] || [ ! -f "$EXTENSION_DIR/dist/icon128.png" ]; then
    echo -e "${YELLOW}Warning: Icons missing. Please ensure icons exist in dist/${NC}"
fi

# Create ZIP package for Chrome Web Store
echo -e "${YELLOW}Creating ZIP package for Chrome Web Store...${NC}"
cd "$EXTENSION_DIR/dist"
rm -f "../$ZIP_NAME"
zip -r "../$ZIP_NAME" *.js *.json *.html *.css *.png >/dev/null 2>&1
cd "$PROJECT_ROOT"

if [ -f "$EXTENSION_DIR/$ZIP_NAME" ]; then
    ZIP_SIZE=$(du -h "$EXTENSION_DIR/$ZIP_NAME" | cut -f1)
    echo -e "${GREEN}✅ ZIP created: $EXTENSION_DIR/$ZIP_NAME ($ZIP_SIZE)${NC}"
else
    echo -e "${RED}❌ Failed to create ZIP${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Production Build Complete!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${BLUE}Build output:${NC} $EXTENSION_DIR/dist"
echo -e "${BLUE}ZIP for Chrome Web Store:${NC} $EXTENSION_DIR/$ZIP_NAME"
echo ""
echo -e "${BLUE}To test locally:${NC}"
echo -e "  1. Open Chrome: ${YELLOW}chrome://extensions/${NC}"
echo -e "  2. Enable ${YELLOW}'Developer mode'${NC}"
echo -e "  3. Click ${YELLOW}'Load unpacked'${NC}"
echo -e "  4. Select: ${YELLOW}$EXTENSION_DIR/dist${NC}"
echo ""
echo -e "${BLUE}To submit to Chrome Web Store:${NC}"
echo -e "  1. Go to: ${YELLOW}https://chrome.google.com/webstore/devconsole${NC}"
echo -e "  2. Upload: ${YELLOW}$EXTENSION_DIR/$ZIP_NAME${NC}"
echo ""
