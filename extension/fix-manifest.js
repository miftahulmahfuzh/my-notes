#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Fix manifest after build
const manifestPath = path.join(__dirname, 'dist', 'manifest.json');

try {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  // Keep icons section (required for Chrome Web Store)

  // Remove type: module from background (not supported in Manifest V3 service workers)
  if (manifest.background && manifest.background.type === 'module') {
    delete manifest.background.type;
  }

  // Write fixed manifest
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log('✅ Manifest fixed successfully');
} catch (error) {
  console.error('❌ Error fixing manifest:', error);
  process.exit(1);
}