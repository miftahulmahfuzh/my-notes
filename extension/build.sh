#!/bin/bash

# Development build script for Silence Notes Extension
echo "🔨 Building Silence Notes Extension..."

# Clean previous build
echo "🧹 Cleaning previous build..."
rm -rf dist

# Build extension
echo "📦 Building extension..."
npm run build

# Fix manifest after build
echo "🔧 Fixing manifest configuration..."
sed -i '/icons.*{/,/}/d' dist/manifest.json
sed -i 's/"type": "module",//' dist/manifest.json

echo "✅ Build complete!"
echo ""
echo "📁 Load this extension in Chrome:"
echo "   1. Open chrome://extensions/"
echo "   2. Enable Developer Mode"
echo "   3. Click 'Load unpacked'"
echo "   4. Select the 'dist' folder"
echo ""
echo "🚀 Extension ready for testing!"